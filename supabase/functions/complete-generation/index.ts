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
    // ── Auth ──
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
      return jsonRes({ success: false, error: "Missing required fields: reservationId, status" });
    }

    if (status === "success") {
      // ── Settle credits ──
      const { error: settleError } = await supabase.rpc("settle_credits", {
        p_reservation_id: reservationId,
        p_task_id: taskId || null,
      });

      if (settleError) {
        console.error("Settle error:", settleError);
        return jsonRes({ success: false, error: "settle_failed", message: settleError.message });
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
        });

        if (insertError) {
          console.error("Generation insert error:", insertError);
          // Don't fail the whole operation for this
        }
      }

      console.log("Generation completed:", JSON.stringify({ reservationId, taskId, toolId }));
      return jsonRes({ success: true, action: "settled" });

    } else if (status === "failed") {
      // ── Release credits ──
      const { error: releaseError } = await supabase.rpc("release_credits", {
        p_reservation_id: reservationId,
      });

      if (releaseError) {
        console.error("Release error:", releaseError);
        return jsonRes({ success: false, error: "release_failed", message: releaseError.message });
      }

      console.log("Generation failed, credits released:", JSON.stringify({ reservationId }));
      return jsonRes({ success: true, action: "released" });
    }

    return jsonRes({ success: false, error: "Invalid status. Use: success, failed" });
  } catch (err) {
    console.error("complete-generation error:", err);
    return jsonRes({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
