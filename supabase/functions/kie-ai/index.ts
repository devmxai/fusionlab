import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const KIE_API_KEY = Deno.env.get("KIE_AI_API_KEY");
  if (!KIE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "KIE_AI_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${KIE_API_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const body = await req.json();
    const { action } = body;

    // Upload file (base64) and return URL
    if (action === "upload") {
      const { base64Data, fileName } = body;
      const response = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          base64Data,
          uploadPath: "references",
          fileName,
        }),
      });

      const data = await response.json();
      console.log("Upload response:", JSON.stringify(data));

      if (!response.ok || !data?.success) {
        return new Response(
          JSON.stringify({ error: data?.msg || "Upload failed", details: data }),
          { status: response.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return normalized response with downloadUrl
      return new Response(
        JSON.stringify({
          code: 200,
          data: { fileUrl: data.data?.downloadUrl },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a new generation task
    if (action === "create") {
      const { model, input } = body;
      console.log("Creating task:", JSON.stringify({ model, input }));

      const response = await fetch(`${KIE_BASE}/jobs/createTask`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ model, input }),
      });

      const data = await response.json();
      console.log("Create task response:", JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Poll task status
    if (action === "status") {
      const { taskId } = body;
      const response = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits
    if (action === "credits") {
      const response = await fetch(`${KIE_BASE}/chat/credit`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: create, status, credits, upload" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("kie-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
