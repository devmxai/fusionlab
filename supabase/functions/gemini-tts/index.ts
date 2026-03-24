import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash-preview-tts";

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

      if (!text?.trim()) {
        return new Response(
          JSON.stringify({ error: "Text is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build the system/style prompt
      const stylePromptParts: string[] = [
        "Speak naturally with human-like emotional expression and realistic pauses.",
        "Never pronounce control tags literally.",
        "Apply each inline tag to the nearest following phrase.",
        "For Arabic text, keep pronunciation clear and avoid flattening emotional variation.",
      ];

      if (dialectHint) stylePromptParts.push(`Dialect target: ${dialectHint}.`);
      if (emotionHint) stylePromptParts.push(`Emotion profile: ${emotionHint}.`);
      if (toneHint) stylePromptParts.push(`Tone profile: ${toneHint}.`);
      if (styleInstruction) stylePromptParts.push(`Style prompt: ${styleInstruction}`);
      if (stability < 0.5) stylePromptParts.push("Allow more vocal variation and expressiveness.");
      if (stability > 0.8) stylePromptParts.push("Maintain consistent vocal tone with minimal variation.");

      const fullText = styleInstruction
        ? `${stylePromptParts.join("\n")}\n\n---\n\n${text}`
        : text;

      const requestBody = {
        contents: [
          {
            parts: [{ text: fullText }],
          },
        ],
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

      console.log("TTS request:", JSON.stringify({ voiceName, languageCode, speakingRate, textLength: text.length }));

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

      return new Response(
        JSON.stringify({
          audioBase64: audioPart.inlineData.data,
          mimeType: audioPart.inlineData.mimeType,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Preview (short text) ───
    if (action === "preview") {
      const { voiceName = "Kore", previewText } = body;

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

      return new Response(
        JSON.stringify({
          audioBase64: audioPart.inlineData.data,
          mimeType: audioPart.inlineData.mimeType,
        }),
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
