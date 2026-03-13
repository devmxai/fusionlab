export interface AITool {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  isPro: boolean;
  category: string;
  model: string; // KIE.AI model identifier
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
    subtitle: "Google AI",
    description: "توليد صور إبداعية بجودة عالية",
    image: "image-gen",
    isPro: false,
    category: "توليد صور",
    model: "google/nano-banana",
  },
  {
    id: "nano-banana-pro",
    title: "Nano Banana Pro",
    subtitle: "Google AI",
    description: "نسخة احترافية مع تفاصيل فائقة الدقة",
    image: "skin-enhance",
    isPro: true,
    category: "توليد صور",
    model: "google/nano-banana-pro",
  },
  {
    id: "nano-banana-2",
    title: "Nano Banana 2",
    subtitle: "Google AI",
    description: "أحدث إصدار مع تحسينات جذرية",
    image: "ai-influencer",
    isPro: false,
    category: "توليد صور",
    model: "google/nano-banana-2",
  },
  {
    id: "kling-3",
    title: "Kling 3.0",
    subtitle: "فيديو سينمائي",
    description: "توليد فيديوهات احترافية بجودة عالية",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
    model: "kling-3.0",
  },
  {
    id: "seedream-4-5",
    title: "Seedream 4.5",
    subtitle: "Text to Image",
    description: "توليد صور واقعية بدقة مذهلة",
    image: "sketch-edit",
    isPro: false,
    category: "توليد صور",
    model: "seedream-4.5",
  },
  {
    id: "topaz-upscale",
    title: "Topaz Upscale",
    subtitle: "تحسين الدقة",
    description: "تكبير الصور حتى 4K بذكاء اصطناعي",
    image: "upscale",
    isPro: true,
    category: "تحسين",
    model: "topaz/image-upscale",
  },
  {
    id: "recraft-bg",
    title: "Recraft",
    subtitle: "إزالة الخلفية",
    description: "أزل خلفية أي صورة بنقرة واحدة",
    image: "remove-bg",
    isPro: false,
    category: "أدوات",
    model: "recraft/remove-background",
  },
  {
    id: "flux-2-pro",
    title: "Flux 2 Pro",
    subtitle: "Text to Image",
    description: "توليد صور متقدم بدقة استثنائية",
    image: "angles",
    isPro: true,
    category: "توليد صور",
    model: "flux-2/pro-text-to-image",
  },
  {
    id: "grok-imagine",
    title: "Grok Imagine",
    subtitle: "xAI",
    description: "صور واقعية وإبداعية بذكاء متقدم",
    image: "image-merge",
    isPro: false,
    category: "توليد صور",
    model: "grok-imagine/text-to-image",
  },
  {
    id: "seedance",
    title: "SeeDance 1.5",
    subtitle: "Bytedance",
    description: "رقص وحركة طبيعية في الفيديو",
    image: "inpaint",
    isPro: true,
    category: "فيديو",
    model: "bytedance/seedance-1.5-pro",
  },
];
