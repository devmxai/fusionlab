import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for system operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { job } = body;

    const results: Record<string, unknown> = { job, timestamp: new Date().toISOString() };

    // ── 1. Enforce subscription expiry ──
    if (job === "all" || job === "expire-subscriptions") {
      const { data, error } = await supabase.rpc("enforce_subscription_expiry");
      results.subscription_expiry = error ? { error: error.message } : data;
    }

    // ── 2. Cleanup stale reservations (older than 4 hours) ──
    if (job === "all" || job === "cleanup-reservations") {
      const { data, error } = await supabase.rpc("cleanup_stale_reservations", {
        p_older_than_hours: 4,
      });
      results.stale_reservations = error ? { error: error.message } : data;
    }

    // ── 3. Reconciliation check ──
    if (job === "all" || job === "reconciliation") {
      const { data, error } = await supabase.rpc("reconciliation_check");
      results.reconciliation = error ? { error: error.message } : data;
    }

    console.log("System jobs completed:", JSON.stringify(results));
    return jsonRes({ success: true, results });
  } catch (err) {
    console.error("system-jobs error:", err);
    return jsonRes({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
