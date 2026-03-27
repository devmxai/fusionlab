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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ success: false, error: "Missing authorization" }, 401);
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
      return jsonRes({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const {
      reservationId,
      status,
      taskId,
      toolId,
      toolName,
      prompt,
      fileUrl,
      fileType,
      metadata,
    } = body;

    if (!reservationId || !status) {
      return jsonRes({ success: false, error: "Missing required fields: reservationId, status" }, 400);
    }

    const now = new Date().toISOString();

    if (status === "success") {
      // ── Idempotency check ──
      const { data: existingGen } = await supabase
        .from("generations")
        .select("id")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (existingGen) {
        console.log("Idempotent hit: generation already exists for reservation", reservationId);
        return jsonRes({ success: true, action: "settled", idempotent: true });
      }

      // ── Settle credits ──
      const { data: settleData, error: settleError } = await supabase.rpc("settle_credits", {
        p_reservation_id: reservationId,
        p_task_id: taskId || null,
      });

      if (settleError) {
        console.error("Settle RPC transport error:", settleError);
        return jsonRes({ success: false, error: "settle_failed", message: settleError.message }, 500);
      }

      if (!settleData?.success) {
        const bizError = settleData?.error || "unknown_settle_error";
        console.error("Settle business failure:", JSON.stringify(settleData));
        if (bizError !== "already_processed") {
          return jsonRes({ success: false, error: bizError, details: settleData }, 422);
        }
      }

      // ── Save generation record ──
      if (fileUrl && toolId) {
        const { error: insertError } = await supabase.from("generations").insert({
          user_id: user.id,
          tool_id: toolId,
          tool_name: toolName || null,
          prompt: prompt || null,
          file_url: fileUrl,
          file_type: fileType || "image",
          metadata: metadata || {},
          reservation_id: reservationId,
        });

        if (insertError && insertError.code !== "23505") {
          console.error("Generation insert error:", insertError);
          return jsonRes({
            success: false, error: "generation_save_failed",
            message: insertError.message, settlement: "completed",
          }, 500);
        }
      }

      // ── Update job record to succeeded (server-authoritative) ──
      await supabaseAdmin
        .from("generation_jobs")
        .update({
          status: "succeeded",
          progress: 100,
          result_url: fileUrl || null,
          completed_at: now,
          updated_at: now,
        })
        .eq("reservation_id", reservationId);

      console.log("Generation completed:", JSON.stringify({ reservationId, taskId, toolId }));
      return jsonRes({ success: true, action: "settled" });

    } else if (status === "failed") {
      // ── Release credits ──
      const { data: releaseData, error: releaseError } = await supabase.rpc("release_credits", {
        p_reservation_id: reservationId,
      });

      if (releaseError) {
        console.error("Release RPC transport error:", releaseError);
        return jsonRes({ success: false, error: "release_failed", message: releaseError.message }, 500);
      }

      if (!releaseData?.success) {
        const bizError = releaseData?.error || "unknown_release_error";
        if (bizError !== "already_processed") {
          return jsonRes({ success: false, error: bizError, details: releaseData }, 422);
        }
      }

      // ── Update job record to failed ──
      await supabaseAdmin
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: body.errorMessage || "Generation failed",
          completed_at: now,
          updated_at: now,
        })
        .eq("reservation_id", reservationId);

      console.log("Generation failed, credits released:", JSON.stringify({ reservationId }));
      return jsonRes({ success: true, action: "released" });
    }

    return jsonRes({ success: false, error: "Invalid status. Use: success, failed" }, 400);
  } catch (err) {
    console.error("complete-generation error:", err);
    return jsonRes({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, 500);
  }
});
