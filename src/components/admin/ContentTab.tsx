import { useState } from "react";
import BannersManager from "./BannersManager";
import TrendingManager from "./TrendingManager";
import ModelCardsManager from "./ModelCardsManager";
import { ImageIcon, Video, Layers, PanelTop } from "lucide-react";

type ContentSection = "banners" | "model-cards" | "trending-images" | "trending-videos";

const sections: { id: ContentSection; label: string; icon: any }[] = [
  { id: "banners", label: "البانرات", icon: PanelTop },
  { id: "model-cards", label: "كاردات النماذج", icon: Layers },
  { id: "trending-images", label: "صور الترند", icon: ImageIcon },
  { id: "trending-videos", label: "فيديوهات الترند", icon: Video },
];

const ContentTab = () => {
  const [section, setSection] = useState<ContentSection>("banners");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">إدارة محتوى الواجهة</h2>

      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              section === s.id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {section === "banners" && <BannersManager />}
      {section === "model-cards" && <ModelCardsManager />}
      {section === "trending-images" && <TrendingManager type="images" />}
      {section === "trending-videos" && <TrendingManager type="videos" />}
    </div>
  );
};

export default ContentTab;
