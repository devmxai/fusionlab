export interface AITool {
  id: string;
  title: string;
  provider: string;
  description: string;
  image: string;
  isPro: boolean;
  category: string;
  model: string;
  /** Whether this model uses the Veo API instead of standard createTask */
  isVeoApi?: boolean;
  /** Input type: what the model needs besides prompt */
  inputType?: "text-to-video" | "avatar" | "animate";
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
  // ─── Image Models ───
  {
    id: "z-image",
    title: "Z Image",
    provider: "KIE.AI",
    description: "توليد صور واقعية فائقة الجودة",
    image: "image-gen",
    isPro: false,
    category: "صور",
    model: "z-image",
  },
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
    id: "seedream-4-5",
    title: "Seedream 4.5",
    provider: "Bytedance",
    description: "صور واقعية بدقة مذهلة",
    image: "sketch-edit",
    isPro: false,
    category: "صور",
    model: "seedream/4.5-text-to-image",
  },
  {
    id: "recraft-crisp-upscale",
    title: "Recraft Crisp Upscale",
    provider: "Recraft",
    description: "رفع جودة الصور حتى 4x بدون تشويش",
    image: "upscale",
    isPro: false,
    category: "رفع الجودة",
    model: "recraft/crisp-upscale",
  },
  {
    id: "topaz-upscale",
    title: "Topaz Upscale",
    provider: "Topaz",
    description: "تكبير الصور حتى 4K",
    image: "upscale",
    isPro: true,
    category: "رفع الجودة",
    model: "topaz/image-upscale",
  },
  {
    id: "recraft-bg",
    title: "Remove Background",
    provider: "Recraft",
    description: "إزالة الخلفية بنقرة واحدة",
    image: "remove-bg",
    isPro: false,
    category: "حذف الخلفية",
    model: "recraft/remove-background",
  },
  {
    id: "flux-2-pro",
    title: "Flux 2 Pro",
    provider: "Flux",
    description: "توليد صور بدقة استثنائية",
    image: "angles",
    isPro: true,
    category: "صور",
    model: "flux-2/pro-text-to-image",
  },
  {
    id: "grok-imagine",
    title: "Grok Imagine",
    provider: "xAI",
    description: "صور واقعية وإبداعية",
    image: "image-merge",
    isPro: false,
    category: "صور",
    model: "grok-imagine/text-to-image",
  },

  // ─── Video Models ───
  {
    id: "grok-video",
    title: "Grok Video",
    provider: "xAI",
    description: "توليد فيديو بتقنية Grok",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "grok-imagine/text-to-video",
  },
  {
    id: "veo31-fast",
    title: "Veo 3.1 Fast",
    provider: "Google",
    description: "توليد فيديو سريع بتقنية Google",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "veo3_fast",
    isVeoApi: true,
  },
  {
    id: "veo31-quality",
    title: "Veo 3.1 Quality",
    provider: "Google",
    description: "أعلى جودة فيديو من Google",
    image: "video-gen",
    isPro: true,
    category: "فيديو",
    model: "veo3",
    isVeoApi: true,
  },
  {
    id: "kling-3",
    title: "Kling 3.0",
    provider: "Kling",
    description: "فيديوهات سينمائية احترافية",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "kling-3.0",
  },
  {
    id: "kling-2-6",
    title: "Kling 2.6",
    provider: "Kling",
    description: "فيديوهات بجودة عالية ومؤثرات صوتية",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "kling-2.6/text-to-video",
  },
  {
    id: "kling-2-1-master",
    title: "Kling 2.1 Master",
    provider: "Kling",
    description: "نسخة متقدمة بدقة احترافية",
    image: "video-gen",
    isPro: true,
    category: "فيديو",
    model: "kling/v2-1-master-text-to-video",
  },
  {
    id: "seedance",
    title: "Seedance 1.5 Pro",
    provider: "Bytedance",
    description: "رقص وحركة طبيعية بالفيديو",
    image: "inpaint",
    isPro: true,
    category: "فيديو",
    model: "bytedance/seedance-1.5-pro",
  },
  {
    id: "seedance-v1-pro",
    title: "Seedance V1 Pro",
    provider: "Bytedance",
    description: "فيديوهات سينمائية بكاميرا متحركة",
    image: "inpaint",
    isPro: false,
    category: "فيديو",
    model: "bytedance/v1-pro-text-to-video",
  },
  {
    id: "sora-2",
    title: "Sora 2",
    provider: "OpenAI",
    description: "توليد فيديو متقدم من OpenAI",
    image: "video-gen",
    isPro: true,
    category: "فيديو",
    model: "sora-2-text-to-video",
  },
  {
    id: "wan-2-6",
    title: "Wan 2.6",
    provider: "Alibaba",
    description: "فيديو بدقة عالية ومدد متعددة",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "wan/2-6-text-to-video",
  },

  // ─── Avatar Models ───
  {
    id: "kling-avatar-standard",
    title: "Kling Avatar",
    provider: "Kling",
    description: "أفتار ناطق من صورة وصوت",
    image: "ai-influencer",
    isPro: false,
    category: "افتار",
    model: "kling/ai-avatar-standard",
    inputType: "avatar",
  },
  {
    id: "kling-avatar-pro",
    title: "Kling Avatar Pro",
    provider: "Kling",
    description: "أفتار احترافي بجودة فائقة",
    image: "ai-influencer",
    isPro: true,
    category: "افتار",
    model: "kling/ai-avatar-pro",
    inputType: "avatar",
  },
  {
    id: "infinitalk",
    title: "Infinitalk",
    provider: "Infinitalk",
    description: "أفتار متحدث بتزامن شفاه دقيق",
    image: "ai-influencer",
    isPro: false,
    category: "افتار",
    model: "infinitalk/from-audio",
    inputType: "avatar",
  },
  {
    id: "wan-animate",
    title: "Wan Animate",
    provider: "Alibaba",
    description: "تحريك صورة حسب فيديو مرجعي",
    image: "ai-influencer",
    isPro: false,
    category: "افتار",
    model: "wan/2-2-animate-move",
    inputType: "animate",
  },
];

// ─── Build correct input params based on model ───
export function buildModelInput(
  model: string,
  prompt: string,
  aspectRatio: string,
  resolution: string,
  imageUrls?: string[],
  extraParams?: Record<string, unknown>
): Record<string, unknown> {
  // ─── IMAGE MODELS ───

  if (model === "nano-banana-2" || model === "nano-banana-pro") {
    const input: Record<string, unknown> = { prompt };
    if (imageUrls?.length) input.image_input = imageUrls;
    return input;
  }

  if (model === "google/nano-banana-edit") {
    return { prompt, image_input: imageUrls || [] };
  }

  if (model === "seedream/4.5-text-to-image") {
    return { prompt, aspect_ratio: aspectRatio, quality: "basic" };
  }

  if (model === "flux-2/pro-text-to-image") {
    return { prompt, aspect_ratio: aspectRatio, resolution: resolution.toUpperCase() };
  }

  if (model === "grok-imagine/text-to-image") {
    return { prompt };
  }

  if (model === "z-image") {
    const arMap: Record<string, string> = { "1:1": "1:1", "3:4": "3:4", "9:16": "9:16" };
    return { prompt, aspect_ratio: arMap[aspectRatio] || "1:1" };
  }

  // ─── VIDEO MODELS ───

  // Grok Imagine Text to Video
  if (model === "grok-imagine/text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      mode: "normal",
      duration: "6",
      resolution: "720p",
    };
  }

  // Kling 3.0
  if (model === "kling-3.0") {
    const input: Record<string, unknown> = {
      prompt,
      duration: "5",
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      mode: "std",
      multi_shots: false,
      sound: false,
    };
    if (imageUrls?.length) input.image_urls = imageUrls;
    return input;
  }

  // Kling 2.6 Text to Video
  if (model === "kling-2.6/text-to-video") {
    return {
      prompt,
      sound: false,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      duration: "5",
    };
  }

  // Kling 2.1 Master Text to Video
  if (model === "kling/v2-1-master-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      duration: "5",
      mode: "std",
    };
  }

  // Seedance 1.5 Pro
  if (model === "bytedance/seedance-1.5-pro") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio,
      resolution: "720p",
      duration: 8,
    };
  }

  // Seedance V1 Pro Text to Video
  if (model === "bytedance/v1-pro-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      resolution: "720p",
      duration: "5",
    };
  }

  // Sora 2 Text to Video
  if (model === "sora-2-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "9:16" || aspectRatio === "3:4" ? "portrait" : "landscape",
      n_frames: "10",
      remove_watermark: true,
    };
  }

  // Wan 2.6 Text to Video
  if (model === "wan/2-6-text-to-video") {
    return {
      prompt,
      duration: "5",
      resolution: "1080p",
    };
  }

  // ─── AVATAR MODELS ───

  // Kling AI Avatar (Standard & Pro)
  if (model === "kling/ai-avatar-standard" || model === "kling/ai-avatar-pro") {
    return {
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      audio_url: extraParams?.audio_url || "",
      prompt: prompt || "",
    };
  }

  // Infinitalk
  if (model === "infinitalk/from-audio") {
    return {
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      audio_url: extraParams?.audio_url || "",
      prompt: prompt || "",
      resolution: "480p",
    };
  }

  // Wan Animate Move
  if (model === "wan/2-2-animate-move") {
    return {
      video_url: extraParams?.video_url || "",
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      resolution: "480p",
    };
  }

  // ─── VEO 3.1 (handled separately in edge function) ───
  if (model === "veo3" || model === "veo3_fast") {
    return {
      prompt,
      model,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "16:9" : aspectRatio === "9:16" ? "9:16" : "16:9",
      generationType: "TEXT_2_VIDEO",
    };
  }

  // ─── UTILITY MODELS ───

  // Recraft Remove Background (image only)
  if (model === "recraft/remove-background") {
    return { image: imageUrls?.[0] || "" };
  }

  // Topaz Image Upscale (image + factor)
  if (model === "topaz/image-upscale") {
    return {
      image_url: imageUrls?.[0] || "",
      upscale_factor: extraParams?.upscale_factor || "2",
    };
  }

  // Default fallback
  if (imageUrls?.length) {
    return { prompt, image_url: imageUrls[0] };
  }
  return { prompt };
}
