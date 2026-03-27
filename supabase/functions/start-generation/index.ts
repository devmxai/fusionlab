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
    // Service-role client for inserting job records (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const {
      toolId,
      toolName,
      model,
      apiType,
      input,
      resolution,
      quality,
      durationSeconds,
      hasAudio,
      characterCount,
      idempotencyKey,
      prompt,
      fileType,
      jobMetadata,
      ttsParams,
    } = body;

    if (!toolId || !model) {
      return jsonRes({ success: false, error: "missing_fields", message: "Missing required fields: toolId, model" });
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
        p_model: model,
        p_tool_id: toolId,
        p_resolution: resolution || null,
        p_quality: quality || null,
        p_duration_seconds: durationSeconds || null,
        p_has_audio: hasAudio ?? null,
        p_idempotency_key: idempotencyKey || null,
        p_generation_type: generationType,
        p_character_count: serverCharCount,
      }
    );

    if (reserveError) {
      console.error("validate_and_reserve error:", reserveError);
      return jsonRes({ success: false, error: "server_error", message: reserveError.message });
    }

    const resData = reserveResult as Record<string, unknown>;
    if (!resData?.success) {
      return jsonRes({
        success: false,
        error: resData?.error || "validation_failed",
        details: resData?.details || null,
        balance: resData?.balance,
        required: resData?.required,
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
          await supabase.rpc("release_credits", { p_reservation_id: reservationId });
          return jsonRes({
            success: false, error: "text_too_long",
            message: `تجاوزت الحد الأقصى (5000 حرف). عدد الأحرف: ${charCount}`,
          });
        }

        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/gemini-tts`, {
          method: "POST",
          headers: internalHeaders,
          body: JSON.stringify({ action: "synthesize", ...ttsParams }),
        });

        const ttsData = await ttsResponse.json();

        if (!ttsResponse.ok || ttsData?.error) {
          console.error("TTS provider error:", JSON.stringify(ttsData));
          await supabase.rpc("release_credits", { p_reservation_id: reservationId });
          return jsonRes({
            success: false, error: "provider_error",
            message: ttsData?.error || "TTS generation failed",
          });
        }

        return jsonRes({
          success: true, reservationId, creditsCharged,
          apiType: "tts", plan: resData.plan,
          audioBase64: ttsData.audioBase64,
          mimeType: ttsData.mimeType,
          voiceName: ttsData.voiceName,
        });
      }

      // ─── KIE.AI Routes ───
      if (!input) {
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
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify(kieBody),
      });

      const kieData = await kieResponse.json();

      if (!kieResponse.ok || (kieData?.code !== 200 && !kieData?.data?.taskId)) {
        console.error("KIE.AI provider error:", JSON.stringify(kieData));
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false, error: "provider_error",
          message: kieData?.msg || kieData?.error || "Failed to create task",
        });
      }

      const taskId = kieData?.data?.taskId;
      if (!taskId) {
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false, error: "no_task_id",
          message: "Provider did not return a task ID",
        });
      }

      // ── 4. Create persistent job record SERVER-SIDE ──
      // This is the critical fix: the job record is created here on the server
      // so it can never be lost even if the client navigates away.
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
        })
        .select("id")
        .single();

      if (jobError) {
        console.error("Failed to create job record:", jobError);
        // Don't fail the whole generation — the task is already running
      }

      console.log("Generation started:", JSON.stringify({
        taskId, reservationId, creditsCharged, model, apiType,
        jobId: jobRecord?.id || "failed_to_create",
      }));

      return jsonRes({
        success: true,
        taskId,
        reservationId,
        creditsCharged,
        apiType: apiType || "standard",
        plan: resData.plan,
        jobId: jobRecord?.id || null,
      });
    } catch (providerErr) {
      try {
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
      } catch (releaseErr) {
        console.error("Failed to release credits after provider error:", releaseErr);
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
