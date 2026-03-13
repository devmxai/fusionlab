import { useState } from "react";
import HomeHeader from "@/components/HomeHeader";
import CategoryFilter from "@/components/CategoryFilter";
import BannerCarousel from "@/components/BannerCarousel";
import ToolCard from "@/components/ToolCard";
import BottomNav from "@/components/BottomNav";
import { tools } from "@/data/tools";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  const filteredTools =
    selectedCategory === "الكل"
      ? tools
      : tools.filter((t) => t.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <HomeHeader />
      <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Banner Carousel */}
      <BannerCarousel />

      {/* Section: Popular Tools */}
      <main className="px-4 pb-24 max-w-7xl mx-auto space-y-6">
        <section>
          <h2 className="text-base font-bold text-foreground mb-3">🛠️ الأدوات</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* Trending Prompts Section */}
        <section>
          <h2 className="text-base font-bold text-foreground mb-3">
            🔥 برومبتات رائجة
          </h2>
          <div className="space-y-2.5">
            {[
              {
                prompt: "A futuristic city floating in the clouds with neon lights",
                author: "أحمد",
                likes: 234,
              },
              {
                prompt: "Portrait of a warrior queen in golden armor, cinematic",
                author: "سارة",
                likes: 189,
              },
              {
                prompt: "Underwater temple with bioluminescent creatures",
                author: "خالد",
                likes: 156,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-card rounded-lg p-3 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              >
                <p className="text-sm text-foreground leading-relaxed" dir="ltr">
                  "{item.prompt}"
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    بواسطة {item.author}
                  </span>
                  <span className="text-xs text-muted-foreground">❤️ {item.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* New Models Section */}
        <section>
          <h2 className="text-base font-bold text-foreground mb-3">✨ جديد</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {tools.slice(0, 4).map((tool) => (
              <ToolCard key={`new-${tool.id}`} tool={tool} />
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
