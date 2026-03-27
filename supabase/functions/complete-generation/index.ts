import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * KIE.AI failure codes that CONFIRM no upstream charge / refund issued.
 * These are the ONLY failure states where automatic user refund is safe.
 * 
 * Based on KIE.AI API documentation:
 * - Task rejected before processing (queue rejection, validation failure)
 * - Provider explicitly confirms refund (code 531, etc.)
 */
const CONFIRMED_REFUND_FAILURE_PATTERNS = [
  // Task never started processing
  "task_not_found",
  "task_rejected",
  "invalid_task",
  "validation_failed",
  "queue_rejected",
  // Provider explicitly confirmed refund
  "refunded",
  "credits_refunded",
  "no_charge",
  "billing_reversed",
];

/**
 * Check if a failure message/code indicates a confirmed provider refund
 */
function isConfirmedProviderRefund(
  errorMessage: string | null | undefined,
  providerStatusCode: string | null | undefined,
  failState: string | null | undefined,
): boolean {
  const combined = [errorMessage, providerStatusCode, failState]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Check against known refund patterns
  for (const pattern of CONFIRMED_REFUND_FAILURE_PATTERNS) {
    if (combined.includes(pattern)) return true;
  }

  // KIE code 531 = confirmed refund
  if (providerStatusCode === "531") return true;

  return false;
}

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
      reservationId, status, taskId, toolId, toolName,
      prompt, fileUrl, fileType, metadata,
      // Provider billing fields from client polling
      providerStatusCode, providerStatusMessage, providerFailState,
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

      // ── Update job record to succeeded with billing confirmation ──
      await supabaseAdmin
        .from("generation_jobs")
        .update({
          status: "succeeded",
          progress: 100,
          result_url: fileUrl || null,
          completed_at: now,
          updated_at: now,
          provider_billing_state: "upstream_success_confirmed",
          upstream_terminal_at: now,
          provider_status_code: providerStatusCode || "success",
          provider_status_message: providerStatusMessage || null,
        })
        .eq("reservation_id", reservationId);

      console.log("Generation completed:", JSON.stringify({ reservationId, taskId, toolId, billingState: "upstream_success_confirmed" }));
      return jsonRes({ success: true, action: "settled" });

    } else if (status === "failed") {
      const errorMessage = body.errorMessage || "Generation failed";

      // ══════════════════════════════════════════════════════════════════
      // CRITICAL: Determine if this is a confirmed refund or unknown
      // ══════════════════════════════════════════════════════════════════
      const isRefundConfirmed = isConfirmedProviderRefund(
        errorMessage,
        providerStatusCode,
        providerFailState,
      );

      if (isRefundConfirmed) {
        // ── CONFIRMED REFUND: Safe to release credits ──
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

        // Update job record with confirmed refund state
        await supabaseAdmin
          .from("generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: now,
            updated_at: now,
            provider_billing_state: "upstream_failed_refunded_confirmed",
            provider_refund_confirmed_at: now,
            upstream_terminal_at: now,
            provider_status_code: providerStatusCode || null,
            provider_status_message: providerStatusMessage || null,
            reconciliation_status: "not_required",
          })
          .eq("reservation_id", reservationId);

        console.log("Generation failed (refund confirmed), credits released:", JSON.stringify({ reservationId, providerStatusCode }));
        return jsonRes({ success: true, action: "released", refundConfirmed: true });

      } else {
        // ── UNCONFIRMED REFUND: Do NOT release credits automatically ──
        // Mark for admin reconciliation
        await supabaseAdmin
          .from("generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: now,
            updated_at: now,
            provider_billing_state: "upstream_failed_refund_unknown",
            upstream_terminal_at: now,
            provider_status_code: providerStatusCode || null,
            provider_status_message: providerStatusMessage || null,
            reconciliation_status: "pending_review",
            reconciliation_notes: `فشل التوليد بدون تأكيد استرداد من المزود. الكود: ${providerStatusCode || "N/A"}. الرسالة: ${errorMessage}. يحتاج مراجعة يدوية.`,
          })
          .eq("reservation_id", reservationId);

        console.log("Generation failed (refund UNCONFIRMED), credits HELD:", JSON.stringify({
          reservationId, providerStatusCode, errorMessage,
        }));
        return jsonRes({
          success: true,
          action: "held_for_reconciliation",
          refundConfirmed: false,
          message: "فشل التوليد. الرصيد معلّق لحين مراجعة حالة المزود.",
        });
      }
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
