import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-caller, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";

// Actions that consume credits MUST only be called from internal edge functions
const BILLABLE_ACTIONS = new Set(["create", "veo-create", "flux-kontext-create"]);
// Non-billable actions (upload, status, credits) remain accessible to authenticated users
const INTERNAL_SECRET = "x-internal-caller";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── JWT Auth Check ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

  const jsonRes = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Safe JSON parser for external API responses
  const safeJson = async (response: Response, label: string) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error(`${label}: non-JSON response (status ${response.status}):`, text.slice(0, 200));
      return { error: `Provider returned non-JSON response (HTTP ${response.status})`, code: response.status };
    }
  };

  try {
    const body = await req.json();
    const { action } = body;

    // ── SECURITY: Block direct client calls to billable actions ──
    if (BILLABLE_ACTIONS.has(action)) {
      const internalCaller = req.headers.get(INTERNAL_SECRET);
      const expectedSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!internalCaller || internalCaller !== expectedSecret) {
        console.warn(`BLOCKED direct billable call: action=${action}, user=${user.id}`);
        return jsonRes({
          error: "Direct provider calls are not allowed. Use start-generation endpoint.",
          code: "DIRECT_CALL_BLOCKED",
        }, 403);
      }
    }

    // ─── Upload file (base64) ───
    if (action === "upload") {
      const { base64Data, fileName } = body;
      const response = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ base64Data, uploadPath: "references", fileName }),
      });
      const data = await safeJson(response, "Upload");
      console.log("Upload response:", JSON.stringify(data));
      if (!response.ok || !data?.success) {
        return jsonRes({ error: data?.msg || "Upload failed", details: data }, response.status || 500);
      }
      return jsonRes({ code: 200, data: { fileUrl: data.data?.downloadUrl } });
    }

    // ─── Veo 3.1 Create ───
    if (action === "veo-create") {
      const { prompt, model, aspect_ratio, generationType, imageUrls } = body;
      console.log("Creating Veo task:", JSON.stringify({ prompt, model, aspect_ratio, generationType }));
      const veoBody: Record<string, unknown> = {
        prompt,
        model: model || "veo3_fast",
        aspect_ratio: aspect_ratio || "16:9",
        generationType: generationType || "TEXT_2_VIDEO",
      };
      if (imageUrls?.length) {
        veoBody.imageUrls = imageUrls;
        if (!generationType) veoBody.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
      }
      const response = await fetch(`${KIE_BASE}/veo/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(veoBody),
      });
      const data = await safeJson(response, "Veo create");
      console.log("Veo create response:", JSON.stringify(data));
      if (data?.code === 200 && data?.data?.taskId) {
        return jsonRes({ code: 200, data: { taskId: data.data.taskId } });
      }
      return jsonRes(data, response.ok ? 200 : response.status);
    }

    // ─── Veo 3.1 Status ───
    if (action === "veo-status") {
      const { taskId } = body;
      const response = await fetch(`${KIE_BASE}/veo/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const data = await safeJson(response, "Veo status");
      if (data?.code === 200 && data?.data) {
        const veoData = data.data;
        const successFlag = veoData.successFlag ?? veoData.response?.successFlag;
        let state: string;
        if (successFlag === 1) state = "success";
        else if (successFlag === 2 || successFlag === 3) state = "fail";
        else state = "generating";
        const result: Record<string, unknown> = { taskId: veoData.taskId, state };
        if (state === "success" && veoData.response) {
          result.resultJson = JSON.stringify({ resultUrls: veoData.response.resultUrls || [] });
        }
        if (state === "fail") {
          result.failMsg = veoData.response?.errorMessage || veoData.errorMessage || "Veo generation failed";
        }
        return jsonRes({ code: 200, data: result });
      }
      return jsonRes(data);
    }

    // ─── Flux Kontext Create ───
    if (action === "flux-kontext-create") {
      const { prompt, model, aspectRatio, inputImage, enableTranslation, outputFormat } = body;
      console.log("Creating Flux Kontext task:", JSON.stringify({ prompt, model, aspectRatio }));
      const fkBody: Record<string, unknown> = {
        prompt,
        model: model || "flux-kontext-pro",
        enableTranslation: enableTranslation ?? true,
        outputFormat: outputFormat || "jpeg",
      };
      if (aspectRatio) fkBody.aspectRatio = aspectRatio;
      if (inputImage) fkBody.inputImage = inputImage;
      const response = await fetch(`${KIE_BASE}/flux/kontext/generate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(fkBody),
      });
      const data = await safeJson(response, "Flux Kontext create");
      console.log("Flux Kontext create response:", JSON.stringify(data));
      if (data?.code === 200 && data?.data?.taskId) {
        return jsonRes({ code: 200, data: { taskId: data.data.taskId } });
      }
      return jsonRes(data, response.ok ? 200 : response.status);
    }

    // ─── Flux Kontext Status ───
    if (action === "flux-kontext-status") {
      const { taskId } = body;
      const response = await fetch(`${KIE_BASE}/flux/kontext/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const data = await safeJson(response, "Flux Kontext status");
      if (data?.code === 200 && data?.data) {
        const fkData = data.data;
        const successFlag = fkData.successFlag ?? fkData.response?.successFlag;
        let state: string;
        if (successFlag === 1) state = "success";
        else if (successFlag === 2 || successFlag === 3) state = "fail";
        else state = "generating";
        const result: Record<string, unknown> = { taskId: fkData.taskId, state };
        if (state === "success" && fkData.response) {
          const resultUrl = fkData.response.resultImageUrl || fkData.response.originImageUrl;
          result.resultJson = JSON.stringify({ resultUrls: resultUrl ? [resultUrl] : [] });
        }
        if (state === "fail") {
          result.failMsg = fkData.response?.errorMessage || fkData.errorMessage || "Flux Kontext generation failed";
        }
        return jsonRes({ code: 200, data: result });
      }
      return jsonRes(data);
    }

    // ─── Standard Create Task ───
    if (action === "create") {
      const { model, input } = body;
      console.log("Creating task:", JSON.stringify({ model, input }));
      const response = await fetch(`${KIE_BASE}/jobs/createTask`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ model, input }),
      });
      const data = await safeJson(response, "Create task");
      console.log("Create task response:", JSON.stringify(data));
      return jsonRes(data, response.ok ? 200 : response.status);
    }

    // ─── Poll task status ───
    if (action === "status") {
      const { taskId } = body;
      const response = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const data = await safeJson(response, "Task status");
      return jsonRes(data);
    }

    // ─── Check credits ───
    if (action === "credits") {
      const response = await fetch(`${KIE_BASE}/chat/credit`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const data = await safeJson(response, "Credits");
      return jsonRes(data);
    }

    return jsonRes(
      { error: "Invalid action. Use: create, status, credits, upload, veo-create, veo-status, flux-kontext-create, flux-kontext-status" },
      400
    );
  } catch (e) {
    console.error("kie-ai error:", e);
    return jsonRes(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
