import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import HomeHeader from "@/components/HomeHeader";
import CategoryFilter from "@/components/CategoryFilter";
import BannerCarousel from "@/components/BannerCarousel";
import ToolCard from "@/components/ToolCard";
import { supabase } from "@/integrations/supabase/client";
import { tools } from "@/data/tools";
import { Flame, ImageIcon, Video, TrendingUp } from "lucide-react";

// Define which tools appear in "Latest" section
const latestToolIds = ["grok-video", "seedream-5-lite", "kling-3", "flux-2-pro"];
// Image models to feature
const imageToolIds = ["z-image", "nano-banana", "nano-banana-pro", "seedream-5-lite"];
// Video models to feature (8)
const videoToolIds = ["veo31-fast", "veo31-quality", "kling-3", "kling-2-6", "seedance", "sora-2", "wan-2-6", "grok-video"];

const latestTools = latestToolIds.map(id => tools.find(t => t.id === id)).filter(Boolean);
const imageTools = imageToolIds.map(id => tools.find(t => t.id === id)).filter(Boolean);
const videoTools = videoToolIds.map(id => tools.find(t => t.id === id)).filter(Boolean);

interface TrendingImage {
  id: string;
  title: string | null;
  image_url: string;
  sort_order: number;
}

interface TrendingVideo {
  id: string;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  sort_order: number;
}

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [trendingImages, setTrendingImages] = useState<TrendingImage[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);

  useEffect(() => {
    supabase.from("trending_images").select("*").order("sort_order").then(({ data }) => {
      setTrendingImages((data as TrendingImage[]) || []);
    });
    supabase.from("trending_videos").select("*").order("sort_order").then(({ data }) => {
      setTrendingVideos((data as TrendingVideo[]) || []);
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
      <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
      <BannerCarousel />

      <main className="px-4 pb-8 max-w-7xl mx-auto space-y-8">
        {showCategorized ? (
          <>
            {/* Latest Models */}
            <section>
              <SectionHeader icon={<Flame className="w-4 h-4 text-orange-500" />} title="الأحدث" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {latestTools.map((tool, i) => tool && <ToolCard key={tool.id} tool={tool} index={i} />)}
              </div>
            </section>

            {/* Image Models */}
            <section>
              <SectionHeader icon={<ImageIcon className="w-4 h-4 text-primary" />} title="نماذج الصور" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {imageTools.map((tool, i) => tool && <ToolCard key={tool.id} tool={tool} index={i} />)}
              </div>
            </section>

            {/* Video Models */}
            <section>
              <SectionHeader icon={<Video className="w-4 h-4 text-primary" />} title="نماذج الفيديو" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                {videoTools.map((tool, i) => tool && <ToolCard key={tool.id} tool={tool} index={i} />)}
              </div>
            </section>

            {/* Trending Images */}
            {trendingImages.length > 0 && (
              <section>
                <SectionHeader icon={<TrendingUp className="w-4 h-4 text-pink-500" />} title="ترند الصور" />
                <div className="columns-2 sm:columns-3 gap-2 space-y-2">
                  {trendingImages.map((img, i) => (
                    <motion.div
                      key={img.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="break-inside-avoid rounded-xl overflow-hidden border border-border/30 group cursor-pointer"
                    >
                      <img
                        src={img.image_url}
                        alt={img.title || ""}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      {img.title && (
                        <div className="px-2.5 py-2 bg-card">
                          <p className="text-[10px] text-muted-foreground truncate">{img.title}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Trending Videos */}
            {trendingVideos.length > 0 && (
              <section>
                <SectionHeader icon={<TrendingUp className="w-4 h-4 text-purple-500" />} title="ترند الفيديو" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {trendingVideos.map((vid, i) => (
                    <motion.div
                      key={vid.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="rounded-xl overflow-hidden border border-border/30 group cursor-pointer aspect-video relative bg-secondary/30"
                    >
                      {vid.thumbnail_url ? (
                        <img src={vid.thumbnail_url} alt={vid.title || ""} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <video src={vid.video_url} muted loop className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                          <Video className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      {vid.title && (
                        <div className="absolute bottom-0 inset-x-0 px-2.5 py-2 bg-gradient-to-t from-black/70 to-transparent">
                          <p className="text-[10px] text-white truncate">{vid.title}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* Filtered view */
          <section>
            <h2 className="text-base font-bold text-foreground mb-3">🛠️ الأدوات</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredTools.map((tool, i) => (
                <ToolCard key={tool.id} tool={tool} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>
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
