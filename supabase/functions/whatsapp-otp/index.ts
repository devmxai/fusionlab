import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { action, phone_number, otp_code } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "send_otp") {
      if (!phone_number || !/^07\d{9}$/.test(phone_number)) {
        return new Response(
          JSON.stringify({ error: "invalid_phone", message: "رقم الهاتف غير صالح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check rate limit - max 3 OTPs per hour
      const { count } = await adminClient
        .from("phone_verifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());

      if ((count || 0) >= 3) {
        return new Response(
          JSON.stringify({ error: "rate_limit", message: "تم تجاوز الحد الأقصى. حاول بعد ساعة." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if phone already verified by another user
      const { data: existingPhone } = await adminClient
        .from("profiles")
        .select("id")
        .eq("phone_number", phone_number)
        .eq("phone_verified", true)
        .neq("id", userId)
        .maybeSingle();

      if (existingPhone) {
        return new Response(
          JSON.stringify({ error: "phone_taken", message: "هذا الرقم مسجل بحساب آخر" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otp = generateOTP();

      // Store OTP
      await adminClient.from("phone_verifications").insert({
        user_id: userId,
        phone_number,
        otp_code: otp,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      // Format phone for WhatsApp: 07xxxxxxxxx → 964xxxxxxxxx
      const whatsappPhone = "964" + phone_number.substring(1);

      // Send via WASender API
      const wasenderKey = Deno.env.get("WASENDER_API_KEY");
      if (!wasenderKey) {
        console.error("WASENDER_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "config_error", message: "خطأ في إعدادات الخدمة" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messageBody = `🔐 رمز التحقق الخاص بك في FusionLab:\n\n*${otp}*\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`;

      const wasenderRes = await fetch("https://api.wasenderapi.com/api/send-message", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${wasenderKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: whatsappPhone,
          type: "text",
          text: messageBody,
        }),
      });

      if (!wasenderRes.ok) {
        const errText = await wasenderRes.text();
        console.error("WASender error:", errText);
        return new Response(
          JSON.stringify({ error: "send_failed", message: "فشل إرسال رمز التحقق. تأكد من أن الرقم مسجل على WhatsApp." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "تم إرسال رمز التحقق" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify_otp") {
      if (!otp_code || !phone_number) {
        return new Response(
          JSON.stringify({ error: "missing_fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get latest unverified OTP for this user+phone
      const { data: verification } = await adminClient
        .from("phone_verifications")
        .select("*")
        .eq("user_id", userId)
        .eq("phone_number", phone_number)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!verification) {
        return new Response(
          JSON.stringify({ error: "no_otp", message: "لم يتم العثور على رمز تحقق" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiry
      if (new Date(verification.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "expired", message: "انتهت صلاحية الرمز. أعد الإرسال." }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check attempts
      if (verification.attempts >= 5) {
        return new Response(
          JSON.stringify({ error: "max_attempts", message: "تم تجاوز عدد المحاولات" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment attempts
      await adminClient
        .from("phone_verifications")
        .update({ attempts: verification.attempts + 1 })
        .eq("id", verification.id);

      if (verification.otp_code !== otp_code) {
        return new Response(
          JSON.stringify({ error: "wrong_code", message: "الرمز غير صحيح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as verified
      await adminClient
        .from("phone_verifications")
        .update({ verified: true })
        .eq("id", verification.id);

      // Update profile with verified phone
      await adminClient
        .from("profiles")
        .update({ phone_number, phone_verified: true })
        .eq("id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "تم التحقق بنجاح" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "invalid_action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("OTP Error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "حدث خطأ داخلي" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
