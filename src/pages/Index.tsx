import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import HomeHeader from "@/components/HomeHeader";
import CategoryFilter from "@/components/CategoryFilter";
import BannerCarousel from "@/components/BannerCarousel";
import ToolCard from "@/components/ToolCard";
import { supabase } from "@/integrations/supabase/client";
import { tools, AITool } from "@/data/tools";
import { Flame, ImageIcon, Video, TrendingUp, Copy, Layers } from "lucide-react";
import { toast } from "sonner";

interface TrendingImage {
  id: string;
  title: string | null;
  image_url: string;
  prompt: string | null;
  sort_order: number;
  is_published: boolean | null;
}

interface TrendingVideo {
  id: string;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  prompt: string | null;
  sort_order: number;
  is_published: boolean | null;
}

interface Tab {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
  is_visible: boolean;
}

interface CardEntry {
  tool_id: string;
  display_section: string;
  sort_order: number;
  is_visible: boolean;
  image_url: string | null;
  title: string | null;
  description: string | null;
}

interface CardOverride {
  image_url: string | null;
  title: string | null;
  description: string | null;
}

const copyPrompt = (prompt: string | null) => {
  if (!prompt) return;
  navigator.clipboard
    .writeText(prompt)
    .then(() => {
      toast.success("تم نسخ البرومبت ✨", { duration: 2000 });
    })
    .catch(() => {
      toast.error("فشل النسخ");
    });
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  latest: <Flame className="w-4 h-4 text-orange-500" />,
  images: <ImageIcon className="w-4 h-4 text-primary" />,
  videos: <Video className="w-4 h-4 text-primary" />,
};

const CardSkeleton = () => (
  <div className="rounded-xl overflow-hidden bg-card border border-border/50">
    <div className="relative aspect-[3/4] bg-secondary">
      <div className="absolute inset-0 shimmer-effect" />
      <div className="absolute bottom-0 right-0 left-0 p-3">
        <div className="h-3.5 w-3/4 rounded bg-secondary-foreground/10 mb-1.5" />
        <div className="h-2.5 w-1/2 rounded bg-secondary-foreground/10" />
      </div>
    </div>
  </div>
);

const SectionSkeleton = ({ count = 5 }: { count?: number }) => (
  <section>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-4 h-4 rounded bg-secondary shimmer-effect" />
      <div className="h-4 w-20 rounded bg-secondary shimmer-effect" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </section>
);

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [trendingImages, setTrendingImages] = useState<TrendingImage[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [sectionTools, setSectionTools] = useState<Record<string, AITool[]>>({});
  const [cardOverrides, setCardOverrides] = useState<Record<string, CardOverride>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("trending_images").select("*").eq("is_published", true).order("sort_order"),
      supabase.from("trending_videos").select("*").eq("is_published", true).order("sort_order"),
      supabase.from("model_card_tabs").select("*").eq("is_visible", true).order("sort_order"),
      supabase
        .from("model_cards")
        .select("tool_id, display_section, sort_order, is_visible, image_url, title, description")
        .eq("is_visible", true)
        .order("sort_order"),
    ]).then(([imgRes, vidRes, tabsRes, cardsRes]) => {
      setTrendingImages((imgRes.data as TrendingImage[]) || []);
      setTrendingVideos((vidRes.data as TrendingVideo[]) || []);
      setTabs((tabsRes.data as Tab[]) || []);

      const map: Record<string, AITool[]> = {};
      const overrides: Record<string, CardOverride> = {};

      if (cardsRes.data) {
        for (const card of cardsRes.data as CardEntry[]) {
          const section = card.display_section || "images";
          const tool = tools.find((t) => t.id === card.tool_id);

          if (tool) {
            if (!map[section]) map[section] = [];
            map[section].push(tool);
          }

          overrides[card.tool_id] = {
            image_url: card.image_url ?? null,
            title: card.title ?? null,
            description: card.description ?? null,
          };
        }
      }

      setSectionTools(map);
      setCardOverrides(overrides);
      setDataLoaded(true);
    });
  }, []);

  const filteredTools =
    selectedCategory === "الكل"
      ? tools
      : tools.filter((t) => t.category === selectedCategory);

  const showCategorized = selectedCategory === "الكل";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <HomeHeader />

      <div className="w-full">
        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
        <BannerCarousel />

        <main className="px-3 sm:px-6 lg:px-10 xl:px-16 pb-8 space-y-10">
          {showCategorized ? (
            <>
              {!dataLoaded && (
                <>
                  <SectionSkeleton count={5} />
                  <SectionSkeleton count={5} />
                  <SectionSkeleton count={4} />
                </>
              )}

              {tabs.map((tab) => {
                const tabTools = sectionTools[tab.slug];
                if (!tabTools || tabTools.length === 0) return null;

                return (
                  <section key={tab.slug}>
                    <SectionHeader
                      icon={SECTION_ICONS[tab.slug] || <Layers className="w-4 h-4 text-primary" />}
                      title={tab.label}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {tabTools.map((tool, i) => (
                        <ToolCard key={`${tab.slug}-${tool.id}`} tool={tool} index={i} override={cardOverrides[tool.id]} />
                      ))}
                    </div>
                  </section>
                );
              })}

              {trendingImages.length > 0 && (
                <section>
                  <SectionHeader icon={<TrendingUp className="w-4 h-4 text-pink-500" />} title="ترند الصور" />
                  <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
                    {trendingImages.map((img, i) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-30px" }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="break-inside-avoid mb-3 rounded-xl overflow-hidden border border-border/30 group cursor-pointer relative"
                        onClick={() => copyPrompt(img.prompt)}
                      >
                        <img src={img.image_url} alt="" className="w-full block transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                        {img.prompt && (
                          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/40 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm flex items-center gap-1.5 shadow-lg">
                              <Copy className="w-3 h-3 text-primary" />
                              <span className="text-[10px] font-bold text-foreground">نسخ البرومبت</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {trendingVideos.length > 0 && (
                <section>
                  <SectionHeader icon={<TrendingUp className="w-4 h-4 text-purple-500" />} title="ترند الفيديو" />
                  <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
                    {trendingVideos.map((vid, i) => (
                      <motion.div
                        key={vid.id}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-30px" }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="break-inside-avoid mb-3 rounded-xl overflow-hidden border border-border/30 group cursor-pointer relative"
                        onClick={() => copyPrompt(vid.prompt)}
                      >
                        {vid.thumbnail_url ? (
                          <img src={vid.thumbnail_url} alt={vid.title || ""} className="w-full block" loading="lazy" />
                        ) : (
                          <video
                            src={vid.video_url}
                            muted
                            preload="metadata"
                            className="w-full block"
                            onLoadedData={(e) => {
                              e.currentTarget.currentTime = 0.5;
                            }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                            <Video className="w-5 h-5 text-foreground" />
                          </div>
                        </div>
                        {vid.prompt && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="px-3 py-1 rounded-full bg-card/90 backdrop-blur-sm flex items-center gap-1 shadow-lg">
                              <Copy className="w-3 h-3 text-primary" />
                              <span className="text-[9px] font-bold text-foreground">نسخ البرومبت</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section>
              <h2 className="text-base font-bold text-foreground mb-3">🛠️ الأدوات</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredTools.map((tool, i) => (
                  <ToolCard key={tool.id} tool={tool} index={i} override={cardOverrides[tool.id]} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      <footer className="border-t border-border/20 mt-12 bg-secondary/10">
        <div className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8" dir="ltr">
          <div>
            <h4 className="text-xs font-bold text-foreground mb-4 tracking-wider uppercase">Products</h4>
            <ul className="space-y-2.5">
              {["Image Generation", "Video Generation", "Audio Studio", "Background Removal", "Upscaler"].map((item) => (
                <li key={item}>
                  <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground mb-4 tracking-wider uppercase">Use Cases</h4>
            <ul className="space-y-2.5">
              {["Marketing", "Social Media", "E-Commerce", "Entertainment", "Education"].map((item) => (
                <li key={item}>
                  <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground mb-4 tracking-wider uppercase">Models</h4>
            <ul className="space-y-2.5">
              {["Kling", "Veo", "Seedance", "Nano Banana", "Z Image"].map((item) => (
                <li key={item}>
                  <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground mb-4 tracking-wider uppercase">About</h4>
            <ul className="space-y-2.5">
              {["Company", "Pricing", "Terms of Service", "Privacy Policy", "Contact"].map((item) => (
                <li key={item}>
                  <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/10 py-5 text-center">
          <p className="text-[10px] text-muted-foreground/50">© 2025 FusionLab. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    {icon}
    <h2 className="text-base font-bold text-foreground">{title}</h2>
  </div>
);

export default Index;
