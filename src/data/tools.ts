export interface AITool {
  id: string;
  title: string;
  provider: string;
  description: string;
  image: string;
  isPro: boolean;
  category: string;
  model: string;
}

export const categories = [
  "الكل",
  "توليد صور",
  "تحرير صور",
  "فيديو",
  "تحسين",
  "أدوات",
] as const;

export const tools: AITool[] = [
  {
    id: "nano-banana",
    title: "Nano Banana",
    provider: "Google",
    description: "توليد صور إبداعية بجودة عالية",
    image: "image-gen",
    isPro: false,
    category: "توليد صور",
    model: "google/nano-banana",
  },
  {
    id: "nano-banana-pro",
    title: "Nano Banana Pro",
    provider: "Google",
    description: "نسخة احترافية بتفاصيل فائقة",
    image: "skin-enhance",
    isPro: true,
    category: "توليد صور",
    model: "google/nano-banana-pro",
  },
  {
    id: "nano-banana-2",
    title: "Nano Banana 2",
    provider: "Google",
    description: "أحدث إصدار مع تحسينات جذرية",
    image: "ai-influencer",
    isPro: false,
    category: "توليد صور",
    model: "google/nano-banana-2",
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
    id: "seedream-4-5",
    title: "Seedream 4.5",
    provider: "Seedream",
    description: "صور واقعية بدقة مذهلة",
    image: "sketch-edit",
    isPro: false,
    category: "توليد صور",
    model: "seedream-4.5",
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
