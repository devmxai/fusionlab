export interface AITool {
  id: string;
  title: string;
  description: string;
  image: string;
  isPro: boolean;
  category: string;
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
    id: "image-gen",
    title: "توليد صور AI",
    description: "أنشئ صوراً مذهلة بالذكاء الاصطناعي",
    image: "image-gen",
    isPro: false,
    category: "توليد صور",
  },
  {
    id: "skin-enhance",
    title: "تحسين البشرة",
    description: "تنعيم وتحسين طبيعي للبشرة",
    image: "skin-enhance",
    isPro: true,
    category: "تحسين",
  },
  {
    id: "video-gen",
    title: "توليد فيديو AI",
    description: "فيديوهات سينمائية بجودة عالية",
    image: "video-gen",
    isPro: false,
    category: "فيديو",
  },
  {
    id: "sketch-edit",
    title: "رسم إلى صورة",
    description: "حوّل رسوماتك إلى صور واقعية",
    image: "sketch-edit",
    isPro: false,
    category: "تحرير صور",
  },
  {
    id: "upscale",
    title: "تكبير الصور",
    description: "حسّن دقة صورك حتى 4K",
    image: "upscale",
    isPro: true,
    category: "تحسين",
  },
  {
    id: "remove-bg",
    title: "إزالة الخلفية",
    description: "أزل خلفية أي صورة بنقرة واحدة",
    image: "remove-bg",
    isPro: false,
    category: "أدوات",
  },
  {
    id: "ai-influencer",
    title: "شخصيات AI",
    description: "أنشئ شخصيات رقمية جذابة",
    image: "ai-influencer",
    isPro: false,
    category: "توليد صور",
  },
  {
    id: "angles",
    title: "زوايا متعددة",
    description: "ولّد أي زاوية من صورة واحدة",
    image: "angles",
    isPro: true,
    category: "توليد صور",
  },
  {
    id: "image-merge",
    title: "دمج الصور",
    description: "ادمج صوراً متعددة بإبداع",
    image: "image-merge",
    isPro: false,
    category: "تحرير صور",
  },
  {
    id: "inpaint",
    title: "إنهاس ذكي",
    description: "عدّل أجزاء من الصورة بسلاسة",
    image: "inpaint",
    isPro: true,
    category: "تحرير صور",
  },
];
