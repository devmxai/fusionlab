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
  /** Whether this model uses the Flux Kontext API */
  isFluxKontextApi?: boolean;
  /** Input type: what the model needs besides prompt */
  inputType?: "text-to-video" | "avatar" | "animate";
  /** Whether this video model supports first frame / last frame image input */
  frameMode?: "first-last" | "first-only";
}

export const categories = [
  "الكل",
  "فيديو",
  "صور",
  "شوتس",
  "ريمكس",
  "صوت",
  "افتار",
  "ترانسفير",
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
    id: "seedream-5-lite",
    title: "Seedream 5 Lite",
    provider: "Bytedance",
    description: "أحدث نموذج لتوليد صور واقعية بدقة 4K",
    image: "sketch-edit",
    isPro: false,
    category: "صور",
    model: "seedream/5-lite-text-to-image",
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
    id: "flux-2-pro",
    title: "Flux 2 Pro",
    provider: "Flux",
    description: "توليد صور بدقة استثنائية",
    image: "angles",
    isPro: true,
    category: "صور",
    model: "flux-2/pro-text-to-image",
  },
  // Grok Imagine (hidden from images — only used via Shoots)
  // {
  //   id: "grok-imagine",
  //   title: "Grok Imagine",
  //   provider: "xAI",
  //   description: "صور واقعية وإبداعية",
  //   image: "image-merge",
  //   isPro: false,
  //   category: "صور",
  //   model: "grok-imagine/text-to-image",
  // },

  // ─── Shoots (Grok Image-to-Image: 2 angle shots from 1 image) ───
  {
    id: "grok-shoots",
    title: "Grok Shoots",
    provider: "xAI",
    description: "توليد زاويتين مختلفتين من صورة واحدة",
    image: "angles",
    isPro: false,
    category: "شوتس",
    model: "grok-imagine/text-to-image",
  },

  // ─── Remix / Image Edit Models ───
  {
    id: "nano-banana-edit",
    title: "Nano Banana Edit",
    provider: "Google",
    description: "تعديل ودمج الصور بالذكاء الاصطناعي",
    image: "ai-influencer",
    isPro: false,
    category: "ريمكس",
    model: "google/nano-banana-edit",
  },
  {
    id: "flux-kontext-pro",
    title: "Flux Kontext Pro",
    provider: "Flux",
    description: "تعديل احترافي بأوامر نصية دقيقة",
    image: "sketch-edit",
    isPro: false,
    category: "ريمكس",
    model: "flux-kontext-pro",
    isFluxKontextApi: true,
  },
  {
    id: "flux-kontext-max",
    title: "Flux Kontext Max",
    provider: "Flux",
    description: "أعلى جودة للمشاهد المعقدة والتفاصيل الدقيقة",
    image: "sketch-edit",
    isPro: true,
    category: "ريمكس",
    model: "flux-kontext-max",
    isFluxKontextApi: true,
  },
  {
    id: "qwen-image-edit",
    title: "Qwen Image Edit",
    provider: "Alibaba",
    description: "تعديل دقيق مع دعم النصوص ثنائية اللغة",
    image: "inpaint",
    isPro: false,
    category: "ريمكس",
    model: "qwen/image-edit",
  },
  {
    id: "gpt-image-1-5-edit",
    title: "GPT Image 1.5",
    provider: "OpenAI",
    description: "تعديل ودمج حتى 16 صورة بذكاء",
    image: "image-merge",
    isPro: true,
    category: "ريمكس",
    model: "gpt-image/1.5-image-to-image",
  },
  {
    id: "seedream-4-5-edit",
    title: "Seedream 4.5 Edit",
    provider: "Bytedance",
    description: "تعديل الصور مع الحفاظ على الجودة العالية",
    image: "skin-enhance",
    isPro: false,
    category: "ريمكس",
    model: "seedream/4.5-edit",
  },

  // ─── Upscale Models ───
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

  // ─── Remove Background ───
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
    frameMode: "first-last",
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
    frameMode: "first-last",
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
    frameMode: "first-last",
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
    frameMode: "first-only",
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
    frameMode: "first-last",
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
    id: "kling-avatar",
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

  // ─── Transfer Models (Motion Control — image + reference video) ───
  {
    id: "kling-3-motion",
    title: "Kling 3.0 Motion",
    provider: "Kling",
    description: "نقل الحركة من فيديو مرجعي بدقة عالية مع الحفاظ على الهوية",
    image: "video-gen",
    isPro: true,
    category: "ترانسفير",
    model: "kling-3.0/motion-control",
    inputType: "animate",
  },
  {
    id: "kling-2-6-motion",
    title: "Kling 2.6 Motion",
    provider: "Kling",
    description: "نقل حركة اقتصادي من فيديو مرجعي إلى صورة",
    image: "video-gen",
    isPro: false,
    category: "ترانسفير",
    model: "kling-2.6/motion-control",
    inputType: "animate",
  },
  {
    id: "wan-animate",
    title: "Wan Animate",
    provider: "Alibaba",
    description: "تحريك صورة حسب فيديو مرجعي",
    image: "ai-influencer",
    isPro: false,
    category: "ترانسفير",
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
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio || "1:1",
      resolution: (extraParams?.resolution as string) || resolution || "1K",
    };
    if (imageUrls?.length) input.image_input = imageUrls;
    return input;
  }

  if (model === "google/nano-banana-edit") {
    return { prompt, image_input: imageUrls || [] };
  }

  if (model === "seedream/5-lite-text-to-image") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      quality: (extraParams?.quality as string) || "basic",
    };
  }

  if (model === "seedream/4.5-text-to-image") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      quality: (extraParams?.quality as string) || "basic",
    };
  }

  if (model === "flux-2/pro-text-to-image") {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: (extraParams?.resolution as string) || resolution || "1K",
    };
  }

  if (model === "grok-imagine/text-to-image") {
    const input: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio || "1:1" };
    if (imageUrls?.length) input.image_url = imageUrls[0];
    return input;
  }

  if (model === "z-image") {
    return { prompt, aspect_ratio: aspectRatio || "1:1" };
  }

  // ─── REMIX / IMAGE EDIT MODELS ───

  // Flux Kontext (handled via separate API, but build params here)
  if (model === "flux-kontext-pro" || model === "flux-kontext-max") {
    const input: Record<string, unknown> = {
      prompt,
      model,
      aspectRatio: aspectRatio === "3:4" ? "3:4" : aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      enableTranslation: true,
      outputFormat: "jpeg",
    };
    if (imageUrls?.length) input.inputImage = imageUrls[0];
    return input;
  }

  // Qwen Image Edit
  if (model === "qwen/image-edit") {
    const sizeMap: Record<string, string> = {
      "1:1": "square",
      "3:4": "portrait_4_3",
      "9:16": "portrait_16_9",
    };
    return {
      prompt,
      image_url: imageUrls?.[0] || "",
      image_size: sizeMap[aspectRatio] || "square",
    };
  }

  // GPT Image 1.5 Image to Image
  if (model === "gpt-image/1.5-image-to-image") {
    return {
      prompt,
      input_urls: imageUrls || [],
      aspect_ratio: aspectRatio === "3:4" ? "2:3" : aspectRatio === "9:16" ? "2:3" : aspectRatio === "1:1" ? "1:1" : "3:2",
      quality: "medium",
    };
  }

  // Seedream 4.5 Edit
  if (model === "seedream/4.5-edit") {
    return {
      prompt,
      image_urls: imageUrls || [],
      aspect_ratio: aspectRatio === "3:4" ? "3:4" : aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      quality: "basic",
    };
  }

  // ─── VIDEO MODELS ───

  if (model === "grok-imagine/text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio || "2:3",
      mode: (extraParams?.quality as string) || "normal",
      duration: (extraParams?.duration as string) || "6",
      resolution: (extraParams?.resolution as string) || "480p",
    };
  }

  if (model === "kling-3.0") {
    const input: Record<string, unknown> = {
      prompt,
      duration: (extraParams?.duration as string) || "5",
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      mode: (extraParams?.quality as string) || "std",
      multi_shots: false,
      sound: false,
    };
    if (imageUrls?.length) input.image_urls = imageUrls;
    return input;
  }

  if (model === "kling-2.6/text-to-video") {
    return {
      prompt,
      sound: false,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      duration: (extraParams?.duration as string) || "5",
    };
  }

  if (model === "kling/v2-1-master-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "3:4" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
      duration: (extraParams?.duration as string) || "5",
      mode: "std",
    };
  }

  if (model === "bytedance/seedance-1.5-pro") {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: (extraParams?.resolution as string) || "720p",
      duration: (extraParams?.duration as string) || "8",
    };
    if (imageUrls?.length) input.input_urls = imageUrls.slice(0, 2);
    return input;
  }

  if (model === "bytedance/v1-pro-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio || "16:9",
      resolution: (extraParams?.resolution as string) || "720p",
      duration: (extraParams?.duration as string) || "5",
    };
  }

  if (model === "sora-2-text-to-video") {
    return {
      prompt,
      aspect_ratio: aspectRatio === "9:16" || aspectRatio === "3:4" ? "portrait" : "landscape",
      n_frames: (extraParams?.duration as string) || "10",
      remove_watermark: true,
      upload_method: "s3",
    };
  }

  if (model === "wan/2-6-text-to-video") {
    return {
      prompt,
      duration: (extraParams?.duration as string) || "5",
      resolution: (extraParams?.resolution as string) || "1080p",
    };
  }

  // ─── AVATAR MODELS ───

  if (model === "kling/ai-avatar-standard" || model === "kling/ai-avatar-pro") {
    return {
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      audio_url: extraParams?.audio_url || "",
      prompt: prompt || "talking head avatar",
    };
  }

  if (model === "infinitalk/from-audio") {
    return {
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      audio_url: extraParams?.audio_url || "",
      prompt: prompt || "lip sync avatar speaking naturally",
      resolution: (extraParams?.resolution as string) || "480p",
    };
  }

  if (model === "wan/2-2-animate-move") {
    return {
      video_url: extraParams?.video_url || "",
      image_url: extraParams?.image_url || (imageUrls?.[0] ?? ""),
      resolution: (extraParams?.resolution as string) || "480p",
    };
  }

  // ─── TRANSFER / MOTION CONTROL MODELS ───

  if (model === "kling-3.0/motion-control" || model === "kling-2.6/motion-control") {
    return {
      prompt: prompt || "No distortion, the character's movements are consistent with the video.",
      input_urls: imageUrls?.length ? [imageUrls[0]] : [],
      video_urls: extraParams?.video_url ? [extraParams.video_url as string] : [],
      character_orientation: (extraParams?.character_orientation as string) || "video",
      mode: (extraParams?.resolution as string) === "1080p" ? "1080p" : "720p",
    };
  }

  // ─── VEO 3.1 ───
  if (model === "veo3" || model === "veo3_fast") {
    const input: Record<string, unknown> = {
      prompt,
      model,
      aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
      generationType: imageUrls?.length ? "FIRST_AND_LAST_FRAMES_2_VIDEO" : "TEXT_2_VIDEO",
    };
    if (imageUrls?.length) input.imageUrls = imageUrls.slice(0, 2);
    return input;
  }

  // ─── UTILITY MODELS ───

  if (model === "recraft/remove-background") {
    return { image: imageUrls?.[0] || "" };
  }

  if (model === "recraft/crisp-upscale") {
    return { image: imageUrls?.[0] || "" };
  }

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
