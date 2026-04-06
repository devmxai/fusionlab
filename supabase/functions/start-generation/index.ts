import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonRes = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── 1. Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const {
      toolId, toolName, model, apiType, input, resolution, quality,
      durationSeconds, rawDurationSeconds, hasAudio, characterCount, idempotencyKey,
      prompt, fileType, jobMetadata, ttsParams,
    } = body;

    if (!toolId || !model) {
      return jsonRes({ success: false, error: "missing_fields", message: "Missing required fields: toolId, model" });
    }

    if (
      (model === "kling/ai-avatar-standard" || model === "kling/ai-avatar-pro") &&
      typeof rawDurationSeconds === "number" &&
      rawDurationSeconds > 15
    ) {
      return jsonRes({
        success: false,
        error: "validation_failed",
        message: `مدة الصوت ${rawDurationSeconds.toFixed(1)}ث وتتجاوز الحد الأقصى لنموذج Kling Avatar (15ث).`,
      }, 400);
    }

    const generationType = apiType === "tts" ? "audio" : "default";

    // ── 2. Validate entitlement + calculate price + reserve credits ──
    let serverCharCount: number | null = null;
    if (apiType === "tts" && ttsParams?.text) {
      const ttsText = (ttsParams.text || "") as string;
      const spokenText = ttsText.replace(/\[(short pause|medium pause|long pause|whispering|shouting|sarcasm|laughing|sigh|fast|extremely fast|robotic|uhm|gasp|groan|scared|curious|bored)\]/gi, "").replace(/\s+/g, " ").trim();
      serverCharCount = spokenText.length;
    }

    const { data: reserveResult, error: reserveError } = await supabase.rpc(
      "validate_and_reserve",
      {
        p_model: model, p_tool_id: toolId, p_resolution: resolution || null,
        p_quality: quality || null, p_duration_seconds: durationSeconds || null,
        p_has_audio: hasAudio ?? null, p_idempotency_key: idempotencyKey || null,
        p_generation_type: generationType, p_character_count: serverCharCount,
      }
    );

    if (reserveError) {
      console.error("validate_and_reserve error:", reserveError);
      return jsonRes({ success: false, error: "server_error", message: reserveError.message });
    }

    const resData = reserveResult as Record<string, unknown>;
    if (!resData?.success) {
      return jsonRes({
        success: false, error: resData?.error || "validation_failed",
        details: resData?.details || null, balance: resData?.balance, required: resData?.required,
      });
    }

    const reservationId = resData.reservation_id as string;
    const creditsCharged = resData.credits_charged as number;

    const internalHeaders = {
      "Content-Type": "application/json",
      Authorization: authHeader,
      "x-internal-caller": serviceRoleKey,
    };

    // ── 3. Route to provider ──
    try {
      // ─── TTS Route ───
      if (apiType === "tts" && ttsParams) {
        const ttsText = (ttsParams.text || "") as string;
        const spokenText = ttsText.replace(/\[(short pause|medium pause|long pause|whispering|shouting|sarcasm|laughing|sigh|fast|extremely fast|robotic|uhm|gasp|groan|scared|curious|bored)\]/gi, "").replace(/\s+/g, " ").trim();
        const charCount = spokenText.length;

        if (charCount > 5000) {
          // Pre-provider failure: safe to refund
          await supabase.rpc("release_credits", { p_reservation_id: reservationId });
          return jsonRes({
            success: false, error: "text_too_long",
            message: `تجاوزت الحد الأقصى (5000 حرف). عدد الأحرف: ${charCount}`,
          });
        }

        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/gemini-tts`, {
          method: "POST", headers: internalHeaders,
          body: JSON.stringify({ action: "synthesize", ...ttsParams }),
        });

        const ttsData = await ttsResponse.json();

        if (!ttsResponse.ok || ttsData?.error) {
          console.error("TTS provider error:", JSON.stringify(ttsData));
          // TTS is synchronous — if it fails, no upstream charge happened
          await supabase.rpc("release_credits", { p_reservation_id: reservationId });
          return jsonRes({
            success: false, error: "provider_error",
            message: ttsData?.error || "TTS generation failed",
          });
        }

        return jsonRes({
          success: true, reservationId, creditsCharged,
          apiType: "tts", plan: resData.plan,
          audioBase64: ttsData.audioBase64, mimeType: ttsData.mimeType, voiceName: ttsData.voiceName,
        });
      }

      // ─── KIE.AI Routes ───
      if (!input) {
        // Pre-provider failure: safe to refund
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({ success: false, error: "missing_fields", message: "Missing input for non-TTS generation" });
      }

      let kieAction: string;
      if (apiType === "veo") kieAction = "veo-create";
      else if (apiType === "flux-kontext") kieAction = "flux-kontext-create";
      else kieAction = "create";

      const kieBody = kieAction === "create"
        ? { action: kieAction, model, input }
        : { action: kieAction, ...input };

      const kieResponse = await fetch(`${supabaseUrl}/functions/v1/kie-ai`, {
        method: "POST", headers: internalHeaders,
        body: JSON.stringify(kieBody),
      });

      const kieData = await kieResponse.json();

      if (!kieResponse.ok || (kieData?.code !== 200 && !kieData?.data?.taskId)) {
        console.error("KIE.AI provider error:", JSON.stringify(kieData));
        // Provider rejected BEFORE creating a task — safe to refund
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false, error: "provider_error",
          message: kieData?.msg || kieData?.error || "Failed to create task",
        });
      }

      const taskId = kieData?.data?.taskId;
      if (!taskId) {
        // No taskId returned — provider didn't create a task — safe to refund
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false, error: "no_task_id",
          message: "Provider did not return a task ID",
        });
      }

      // ══════════════════════════════════════════════════════════════════
      // CRITICAL POINT: taskId exists — upstream task was created.
      // From here on, NO automatic refund is allowed.
      // If job record creation fails, we mark for reconciliation instead.
      // ══════════════════════════════════════════════════════════════════

      const now = new Date().toISOString();

      const { data: jobRecord, error: jobError } = await supabaseAdmin
        .from("generation_jobs")
        .insert({
          user_id: user.id,
          task_id: taskId,
          reservation_id: reservationId,
          tool_id: toolId,
          tool_name: toolName || null,
          model,
          api_type: apiType || "standard",
          prompt: prompt || null,
          file_type: fileType || "image",
          status: "pending",
          progress: 0,
          metadata: jobMetadata || {},
          // Provider billing tracking
          provider_billing_state: "upstream_task_created",
          upstream_task_created_at: now,
          reconciliation_status: "not_required",
        })
        .select("id")
        .single();

      if (jobError) {
        console.error("CRITICAL: Failed to create job record after upstream task created:", jobError);
        // ══════════════════════════════════════════════════════════════
        // DO NOT REFUND HERE. The upstream task exists and may charge us.
        // Instead, create a reconciliation record so admin can review.
        // ══════════════════════════════════════════════════════════════

        // Attempt to create a minimal reconciliation record
        try {
          await supabaseAdmin.from("generation_jobs").insert({
            user_id: user.id,
            task_id: taskId,
            reservation_id: reservationId,
            tool_id: toolId,
            tool_name: toolName || null,
            model,
            api_type: apiType || "standard",
            prompt: prompt || null,
            file_type: fileType || "image",
            status: "failed",
            progress: 0,
            metadata: { ...(jobMetadata || {}), recovery_attempt: true, original_error: jobError.message },
            provider_billing_state: "upstream_task_created",
            upstream_task_created_at: now,
            reconciliation_status: "pending_review",
            reconciliation_notes: `Job record insert failed on first attempt. TaskId: ${taskId}. Reservation: ${reservationId}. Credits NOT refunded — upstream task may have been charged.`,
            error_message: "خطأ في إنشاء سجل المتابعة. يرجى مراجعة الإدارة.",
          });
        } catch (recoveryErr) {
          console.error("CRITICAL: Recovery insert also failed:", recoveryErr);
          // Last resort: at least the reservation exists in credit_reservations
          // Admin can reconcile via reservation_id + task_id in logs
        }

        return jsonRes({
          success: false,
          error: "job_record_failed",
          message: "حدث خطأ في إنشاء سجل المتابعة. تم تسجيل المشكلة وسيتم مراجعتها من الإدارة. الرصيد لن يُسترد تلقائياً لحين التأكد من حالة المزود.",
          taskId, // Return taskId so client can potentially track
          reservationId,
        }, 500);
      }

      console.log("Generation started:", JSON.stringify({
        taskId, reservationId, creditsCharged, model, apiType,
        jobId: jobRecord?.id, billingState: "upstream_task_created",
      }));

      return jsonRes({
        success: true, taskId, reservationId, creditsCharged,
        apiType: apiType || "standard", plan: resData.plan,
        jobId: jobRecord?.id || null,
      });

    } catch (providerErr) {
      // This catch is for network/transport errors calling the provider
      // We DON'T KNOW if the provider received our request or not
      // If we hadn't gotten a taskId yet, safe to refund
      // But since we're in the outer catch here, we haven't gotten to taskId handling
      // Safe to refund since provider call itself failed before response
      try {
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
      } catch (releaseErr) {
        console.error("Failed to release credits after provider transport error:", releaseErr);
      }
      throw providerErr;
    }
  } catch (err) {
    console.error("start-generation error:", err);
    return jsonRes({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
