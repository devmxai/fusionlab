import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash-preview-tts";
const OFFICIAL_GEMINI_FLASH_TTS_VOICES = new Set([
  "Puck",
  "Achird",
  "Algenib",
  "Alnilam",
  "Achernar",
  "Aoede",
  "Charon",
  "Kore",
  "Leda",
  "Orus",
  "Zephyr",
]);

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

function validateModelLock(body: Record<string, unknown>): string | null {
  const requestedModel =
    typeof body.prebuiltModel === "string"
      ? body.prebuiltModel
      : typeof body.model === "string"
      ? body.model
      : null;

  if (requestedModel && requestedModel !== MODEL) {
    return `Only ${MODEL} is allowed for this endpoint`;
  }

  return null;
}

function validateOfficialVoice(voiceName: string): string | null {
  if (!OFFICIAL_GEMINI_FLASH_TTS_VOICES.has(voiceName)) {
    return `Unsupported voice '${voiceName}'. Allowed voices: ${Array.from(
      OFFICIAL_GEMINI_FLASH_TTS_VOICES
    ).join(", ")}`;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // ─── Generate TTS ───
    if (action === "synthesize") {
      const {
        text,
        voiceName = "Kore",
        languageCode = "ar-001",
        speakingRate = 1.0,
        pitch = 0,
        stability = 0.7,
        dialectHint = "",
        emotionHint = "",
        toneHint = "",
        styleInstruction = "",
      } = body;

      const voiceValidationError = validateOfficialVoice(voiceName);
      if (voiceValidationError) {
        return new Response(
          JSON.stringify({ error: voiceValidationError, model: MODEL }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!text?.trim()) {
        return new Response(
          JSON.stringify({ error: "Text is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build style direction as a separate "turn" before the spoken text
      const stylePromptParts: string[] = [];

      if (dialectHint) stylePromptParts.push(`Dialect: ${dialectHint}`);
      if (emotionHint) stylePromptParts.push(`Emotion: ${emotionHint}`);
      if (toneHint) stylePromptParts.push(`Tone: ${toneHint}`);
      if (styleInstruction) stylePromptParts.push(styleInstruction);
      if (stability < 0.5) stylePromptParts.push("Allow more vocal variation and expressiveness.");
      if (stability > 0.8) stylePromptParts.push("Maintain consistent vocal tone with minimal variation.");

      // Use multi-turn: first turn is style direction, second is text to speak
      const contents = [];
      if (stylePromptParts.length > 0) {
        const styleText = `Say the following text using this style:\n${stylePromptParts.join("\n")}\n\nText to speak:`;
        contents.push({ parts: [{ text: styleText + "\n\n" + text }] });
      } else {
        contents.push({ parts: [{ text }] });
      }

      const requestBody = {
        contents,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      console.log("TTS request:", JSON.stringify({ model: MODEL, voiceName, languageCode, speakingRate, textLength: text.length }));

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
        console.error("Gemini TTS error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Gemini API error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("TTS response keys:", Object.keys(data));

      // Extract audio from response
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
      console.log("Audio mimeType:", rawMime, "base64 length:", rawB64.length);

      // If PCM (audio/L16), convert to WAV for browser playback
      if (rawMime.startsWith("audio/L16") || rawMime.startsWith("audio/pcm")) {
        const wavResult = pcmToWav(rawB64, rawMime);
        return new Response(
          JSON.stringify({ ...wavResult, model: MODEL, voiceName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ audioBase64: rawB64, mimeType: rawMime, model: MODEL, voiceName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Preview (short text) ───
    if (action === "preview") {
      const { voiceName = "Kore", previewText } = body;

      const voiceValidationError = validateOfficialVoice(voiceName);
      if (voiceValidationError) {
        return new Response(
          JSON.stringify({ error: voiceValidationError, model: MODEL }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const requestBody = {
        contents: [
          {
            parts: [{ text: previewText || "مرحباً، أنا صوتك الجديد. كيف أبدو؟" }],
          },
        ],
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
