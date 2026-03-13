import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KIE_BASE = "https://api.kie.ai/api/v1";

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

  try {
    const { action, model, input, taskId } = await req.json();

    // Create a new generation task
    if (action === "create") {
      const response = await fetch(`${KIE_BASE}/jobs/createTask`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input }),
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `KIE API error [${response.status}]`, details: data }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Poll task status
    if (action === "status") {
      const response = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `KIE API error [${response.status}]`, details: data }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

    // Get download URL
    if (action === "download") {
      const { url } = await req.json();
      const response = await fetch(`${KIE_BASE}/common/download-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: create, status, credits, download" }),
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
