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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const {
      toolId,
      model,
      apiType,
      input,
      resolution,
      quality,
      durationSeconds,
      hasAudio,
      idempotencyKey,
    } = body;

    if (!toolId || !model || !input) {
      return jsonRes({ success: false, error: "missing_fields", message: "Missing required fields: toolId, model, input" });
    }

    // ── 2. Validate entitlement + calculate price + reserve credits (atomic) ──
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

    // ── 3. Call KIE.AI provider via internal kie-ai function ──
    try {
      let kieAction: string;
      if (apiType === "veo") kieAction = "veo-create";
      else if (apiType === "flux-kontext") kieAction = "flux-kontext-create";
      else kieAction = "create";

      const kieBody =
        kieAction === "create"
          ? { action: kieAction, model, input }
          : { action: kieAction, ...input };

      const kieResponse = await fetch(
        `${supabaseUrl}/functions/v1/kie-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(kieBody),
        }
      );

      const kieData = await kieResponse.json();

      if (!kieResponse.ok || (kieData?.code !== 200 && !kieData?.data?.taskId)) {
        // Provider failed → release credits
        console.error("KIE.AI provider error:", JSON.stringify(kieData));
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false,
          error: "provider_error",
          message: kieData?.msg || kieData?.error || "Failed to create task",
        });
      }

      const taskId = kieData?.data?.taskId;
      if (!taskId) {
        await supabase.rpc("release_credits", { p_reservation_id: reservationId });
        return jsonRes({
          success: false,
          error: "no_task_id",
          message: "Provider did not return a task ID",
        });
      }

      // ── 4. Success ──
      console.log("Generation started:", JSON.stringify({ taskId, reservationId, creditsCharged, model, apiType }));

      return jsonRes({
        success: true,
        taskId,
        reservationId,
        creditsCharged,
        apiType: apiType || "standard",
        plan: resData.plan,
      });
    } catch (providerErr) {
      // Release credits on provider error
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
