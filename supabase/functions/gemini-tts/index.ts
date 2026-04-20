import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-caller, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash-preview-tts", // Fusion Voice (standard)
  "gemini-3.1-flash-tts-preview",  // Fusion Voice Pro (latest, supports audio tags)
]);
const OFFICIAL_GEMINI_FLASH_TTS_VOICES = new Set([
  "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede",
  "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus",
  "Erinome", "Fenrir", "Gacrux", "Iapetus", "Kore",
  "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima",
  "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar",
  "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi",
]);

// Billable actions require internal caller validation
const BILLABLE_ACTIONS = new Set(["synthesize"]);
const INTERNAL_SECRET = "x-internal-caller";

function pcmToWav(rawB64: string, rawMime: string): { audioBase64: string; mimeType: string } {
  const rateMatch = rawMime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
  const channels = 1;
  const bitsPerSample = 16;

  const binaryStr = atob(rawB64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }

  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const wavBuffer = new Uint8Array(headerSize + dataSize);
  const view = new DataView(wavBuffer.buffer);

  wavBuffer.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataSize, true);
  wavBuffer.set([0x57, 0x41, 0x56, 0x45], 8);
  wavBuffer.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  wavBuffer.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataSize, true);
  wavBuffer.set(pcmBytes, 44);

  let wavB64 = "";
  const chunkSize = 8192;
  for (let i = 0; i < wavBuffer.length; i += chunkSize) {
    wavB64 += String.fromCharCode(...wavBuffer.subarray(i, i + chunkSize));
  }
  wavB64 = btoa(wavB64);

  return { audioBase64: wavB64, mimeType: "audio/wav" };
}

function resolveModel(body: Record<string, unknown>): { model: string; error: string | null } {
  const requested =
    typeof body.prebuiltModel === "string"
      ? body.prebuiltModel
      : typeof body.model === "string"
      ? body.model
      : null;

  if (!requested) {
    return { model: DEFAULT_MODEL, error: null };
  }

  if (!ALLOWED_MODELS.has(requested)) {
    return { model: DEFAULT_MODEL, error: `Model '${requested}' is not allowed. Allowed: ${Array.from(ALLOWED_MODELS).join(", ")}` };
  }

  return { model: requested, error: null };
}

function validateOfficialVoice(voiceName: string): string | null {
  if (!OFFICIAL_GEMINI_FLASH_TTS_VOICES.has(voiceName)) {
    return `Unsupported voice '${voiceName}'`;
  }
  return null;
}

// The Gemini TTS API uses natural language prompting, NOT bracket tags.
// Stage directions like *يضحك* and pauses via "..." are embedded inline
// in the transcript and interpreted naturally by the model.

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function handleTTSRequest(
  body: Record<string, unknown>,
  GOOGLE_API_KEY: string,
  corsHeaders: Record<string, string>,
  resolvedModel: string,
): Promise<Response> {
  const {
    text,
    voiceName = "Kore",
    speakingRate = 1.0,
    pitch = 0,
    stability = 0.7,
    dialectHint = "",
    emotionHint = "",
    toneHint = "",
    styleInstruction = "",
  } = body as Record<string, any>;

  const voiceValidationError = validateOfficialVoice(voiceName);
  if (voiceValidationError) {
    return new Response(
      JSON.stringify({ error: voiceValidationError, model: resolvedModel }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!text?.trim()) {
    return new Response(
      JSON.stringify({ error: "Text is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const spokenText = normalizeText(text);

  if (!spokenText) {
    return new Response(
      JSON.stringify({ error: "Text is empty." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isProModel = resolvedModel === "gemini-3.1-flash-tts-preview";

  // Build prompt using Director's Notes pattern
  const promptParts: string[] = [];
  promptParts.push("# AUDIO PROFILE");
  promptParts.push("متحدث عربي أصلي بأداء طبيعي وتعبيرات عاطفية واقعية.");

  promptParts.push("\n## DIRECTOR'S NOTES");
  promptParts.push("اللغة: العربية فقط بنطق أصيل وطبيعي.");

  if (dialectHint) {
    promptParts.push(`اللهجة: ${dialectHint}.`);
  } else {
    promptParts.push("اللهجة: عراقية عامية طبيعية.");
  }

  if (styleInstruction) promptParts.push(`الأسلوب: ${styleInstruction}`);
  if (emotionHint) promptParts.push(`المشاعر: ${emotionHint}.`);
  if (toneHint) promptParts.push(`النبرة: ${toneHint}.`);

  if (speakingRate > 1.3) promptParts.push("الإيقاع: سريع ونشيط.");
  else if (speakingRate < 0.8) promptParts.push("الإيقاع: بطيء ومتأنٍ.");

  if (stability < 0.5) promptParts.push("التنوع: اسمح بتنوع صوتي أكثر وتعبير عاطفي أقوى.");
  if (stability > 0.8) promptParts.push("الثبات: حافظ على نبرة صوت ثابتة ومتسقة.");

  // Inline directions guidance — different per model
  if (isProModel) {
    promptParts.push("\nالنص قد يحتوي على Audio Tags إنجليزية بين أقواس مربعة مثل [whispers] [laughs] [excited] [shouting] [sarcastic] [sighs]. نفّذها كأداء صوتي حقيقي ولا تنطق محتوى الأقواس. كذلك قد يحتوي على وسوم عربية بين نجمتين مثل *يضحك* أو *يهمس* — نفّذها بنفس الطريقة. النقاط المتتالية ... تعني وقفة صامتة.");
  } else {
    promptParts.push("\nالنص يحتوي على توجيهات أداء مضمنة بين نجمتين مثل *يضحك* أو *بسخرية*. نفّذها كأداء صوتي حقيقي (ضحك فعلي، نبرة ساخرة، همس حقيقي) ولا تنطق الكلمات بين النجمتين. النقاط المتتالية ... تعني وقفة صامتة.");
  }

  promptParts.push("\n## TRANSCRIPT");
  promptParts.push(spokenText);

  const fullPrompt = promptParts.join("\n");
  const contents = [{ parts: [{ text: fullPrompt }] }];

  const requestBody = {
    contents,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };

  console.log("TTS request:", JSON.stringify({ model: resolvedModel, voiceName, textLength: text.length }));

  const response = await fetch(
    `${GEMINI_API}/${resolvedModel}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini TTS error:", response.status, errorText);
    return new Response(
      JSON.stringify({ error: `Gemini API error: ${response.status}`, details: errorText }),
      { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find(
    (p: { inlineData?: { mimeType: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
  );

  if (!audioPart?.inlineData) {
    console.error("No audio in response:", JSON.stringify(data));
    return new Response(
      JSON.stringify({ error: "No audio generated", details: data }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawMime = audioPart.inlineData.mimeType as string;
  const rawB64 = audioPart.inlineData.data as string;

  if (rawMime.startsWith("audio/L16") || rawMime.startsWith("audio/pcm")) {
    const wavResult = pcmToWav(rawB64, rawMime);
    return new Response(
      JSON.stringify({ ...wavResult, model: resolvedModel, voiceName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ audioBase64: rawB64, mimeType: rawMime, model: resolvedModel, voiceName }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

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

  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (!GOOGLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    const modelValidationError = validateModelLock(body as Record<string, unknown>);
    if (modelValidationError) {
      return new Response(
        JSON.stringify({ error: modelValidationError, model: MODEL }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SECURITY: Block direct client calls to billable actions ──
    if (BILLABLE_ACTIONS.has(action)) {
      const internalCaller = req.headers.get(INTERNAL_SECRET);
      const expectedSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!internalCaller || internalCaller !== expectedSecret) {
        console.warn(`BLOCKED direct TTS billable call: action=${action}, user=${user.id}`);
        return new Response(
          JSON.stringify({
            error: "Direct TTS calls are not allowed. Use start-generation endpoint.",
            code: "DIRECT_CALL_BLOCKED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Generate TTS (billable - internal only) ───
    if (action === "synthesize") {
      return await handleTTSRequest(body, GOOGLE_API_KEY, corsHeaders);
    }

    // ─── Preview (free - allowed from client) ───
    if (action === "preview") {
      const {
        voiceName = "Kore",
        previewText,
        styleInstruction: prevStyle = "",
        dialectHint: prevDialect = "",
        emotionHint: prevEmotion = "",
        toneHint: prevTone = "",
        stability: prevStability = 0.7,
      } = body;

      const voiceValidationError = validateOfficialVoice(voiceName);
      if (voiceValidationError) {
        return new Response(
          JSON.stringify({ error: voiceValidationError, model: MODEL }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const previewRawText = previewText || "مرحباً، أنا صوتك الجديد. كيف أبدو؟";

      const previewParts: string[] = [];
      previewParts.push("# AUDIO PROFILE");
      previewParts.push("متحدث عربي أصلي بأداء طبيعي.");
      previewParts.push("\n## DIRECTOR'S NOTES");
      previewParts.push("اللغة: العربية فقط بنطق أصيل.");
      if (prevDialect) previewParts.push(`اللهجة: ${prevDialect}.`);
      else previewParts.push("اللهجة: عراقية عامية طبيعية.");
      if (prevStyle) previewParts.push(`الأسلوب: ${prevStyle}`);
      if (prevEmotion) previewParts.push(`المشاعر: ${prevEmotion}.`);
      if (prevTone) previewParts.push(`النبرة: ${prevTone}.`);
      if (prevStability < 0.5) previewParts.push("التنوع: تعبير عاطفي أقوى.");
      if (prevStability > 0.8) previewParts.push("الثبات: نبرة ثابتة.");

      previewParts.push("\n## TRANSCRIPT");
      previewParts.push(normalizeText(previewRawText));

      const previewPrompt = previewParts.join("\n");

      const requestBody = {
        contents: [{ parts: [{ text: previewPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      };

      const response = await fetch(
        `${GEMINI_API}/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ error: `Preview error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const audioPart = data.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { mimeType: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
      );

      if (!audioPart?.inlineData) {
        return new Response(
          JSON.stringify({ error: "No audio in preview" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const prevMime = audioPart.inlineData.mimeType as string;
      const prevB64 = audioPart.inlineData.data as string;

      if (prevMime.startsWith("audio/L16") || prevMime.startsWith("audio/pcm")) {
        const wavResult = pcmToWav(prevB64, prevMime);
        return new Response(
          JSON.stringify({ ...wavResult, model: MODEL, voiceName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ audioBase64: prevB64, mimeType: prevMime, model: MODEL, voiceName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: synthesize, preview" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("gemini-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
