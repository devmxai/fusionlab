export interface AITool {
  id: string;
  title: string;
  provider: string;
  description: string;
  image: string;
  isPro: boolean;
  category: string;
  model: string;
  /** Input params builder per model */
  inputParams?: Record<string, unknown>;
}

export const categories = [
  "الكل",
  "فيديو",
  "صور",
  "صوت",
  "افتار",
  "حذف الخلفية",
  "رفع الجودة",
] as const;

export const tools: AITool[] = [
  {
    id: "nano-banana",
    title: "Nano Banana 2",
    provider: "Google",
    description: "توليد صور إبداعية بجودة عالية",
    image: "image-gen",
    isPro: false,
    category: "صور",
    model: "nano-banana-2",
  },
  {
    id: "nano-banana-pro",
    title: "Nano Banana Pro",
    provider: "Google",
    description: "نسخة احترافية بتفاصيل فائقة",
    image: "skin-enhance",
    isPro: true,
    category: "صور",
    model: "nano-banana-pro",
  },
  {
    id: "nano-banana-edit",
    title: "Nano Banana Edit",
    provider: "Google",
    description: "تعديل الصور بالذكاء الاصطناعي",
    image: "ai-influencer",
    isPro: false,
    category: "صور",
    model: "google/nano-banana-edit",
  },
  {
    id: "kling-3",
    title: "Kling 3.0",
    provider: "Kling",
    description: "فيديوهات سينمائية احترافية",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "kling-3.0/video",
  },
  {
    id: "seedream-4-5",
    title: "Seedream 4.5",
    provider: "Bytedance",
    description: "صور واقعية بدقة مذهلة",
    image: "sketch-edit",
    isPro: false,
    category: "توليد صور",
    model: "seedream/4.5-text-to-image",
  },
  {
    id: "topaz-upscale",
    title: "Topaz Upscale",
    provider: "Topaz",
    description: "تكبير الصور حتى 4K",
    image: "upscale",
    isPro: true,
    category: "تحسين",
    model: "topaz/image-upscale",
  },
  {
    id: "recraft-bg",
    title: "Remove Background",
    provider: "Recraft",
    description: "إزالة الخلفية بنقرة واحدة",
    image: "remove-bg",
    isPro: false,
    category: "أدوات",
    model: "recraft/remove-background",
  },
  {
    id: "flux-2-pro",
    title: "Flux 2 Pro",
    provider: "Flux",
    description: "توليد صور بدقة استثنائية",
    image: "angles",
    isPro: true,
    category: "توليد صور",
    model: "flux-2/pro-text-to-image",
  },
  {
    id: "grok-imagine",
    title: "Grok Imagine",
    provider: "xAI",
    description: "صور واقعية وإبداعية",
    image: "image-merge",
    isPro: false,
    category: "توليد صور",
    model: "grok-imagine/text-to-image",
  },
  {
    id: "seedance",
    title: "SeeDance 1.5 Pro",
    provider: "Bytedance",
    description: "رقص وحركة طبيعية بالفيديو",
    image: "inpaint",
    isPro: true,
    category: "فيديو",
    model: "bytedance/seedance-1.5-pro",
  },
];

// Build correct input params based on model — aligned with KIE.AI API docs
export function buildModelInput(
  model: string,
  prompt: string,
  aspectRatio: string,
  resolution: string,
  imageUrls?: string[]
): Record<string, unknown> {
  // Nano Banana 2 — model: "nano-banana-2"
  // Docs: input.prompt (required), input.image_input (optional, array of URLs up to 14)
  if (model === "nano-banana-2") {
    const input: Record<string, unknown> = { prompt };
    if (imageUrls?.length) {
      input.image_input = imageUrls;
    }
    return input;
  }

  // Nano Banana Pro — model: "nano-banana-pro"
  // Same structure as Nano Banana 2
  if (model === "nano-banana-pro") {
    const input: Record<string, unknown> = { prompt };
    if (imageUrls?.length) {
      input.image_input = imageUrls;
    }
    return input;
  }

  // Nano Banana Edit — model: "google/nano-banana-edit"
  // Docs: input.prompt (required), input.image_input (required, array of URLs)
  if (model === "google/nano-banana-edit") {
    return {
      prompt,
      image_input: imageUrls || [],
    };
  }

  // Seedream 4.5 Text to Image — model: "seedream/4.5-text-to-image"
  // Docs: input.prompt, input.aspect_ratio, input.quality ("basic")
  if (model === "seedream/4.5-text-to-image") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      quality: "basic",
    };
  }

  // Flux-2 Pro Text to Image — model: "flux-2/pro-text-to-image"
  // Docs: input.prompt, input.aspect_ratio, input.resolution ("1K", "2K", "4K")
  if (model === "flux-2/pro-text-to-image") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: resolution.toUpperCase(),
    };
  }

  // Grok Imagine Text to Image — model: "grok-imagine/text-to-image"
  // Docs: input.prompt only
  if (model === "grok-imagine/text-to-image") {
    return { prompt };
  }

  // Kling 3.0 — model: "kling-3.0/video"
  // Docs: input.prompt, input.duration, input.aspect_ratio, input.mode, input.multi_shots, input.sound, input.image_urls
  if (model === "kling-3.0/video") {
    const input: Record<string, unknown> = {
      prompt,
      duration: "5",
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio,
      mode: "std",
      multi_shots: false,
      sound: false,
    };
    if (imageUrls?.length) {
      input.image_urls = imageUrls;
    }
    return input;
  }

  // Seedance 1.5 Pro — model: "bytedance/seedance-1.5-pro"
  // Docs: input.prompt, input.aspect_ratio
  if (model === "bytedance/seedance-1.5-pro") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
    };
  }

  // Default fallback (Topaz, Recraft, etc.)
  if (imageUrls?.length) {
    return { prompt, image_url: imageUrls[0] };
  }
  return { prompt };
}
