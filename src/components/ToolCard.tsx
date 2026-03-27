import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import imageGen from "@/assets/tools/image-gen.jpg";
import skinEnhance from "@/assets/tools/skin-enhance.jpg";
import videoGen from "@/assets/tools/video-gen.jpg";
import sketchEdit from "@/assets/tools/sketch-edit.jpg";
import upscale from "@/assets/tools/upscale.jpg";
import removeBg from "@/assets/tools/remove-bg.jpg";
import aiInfluencer from "@/assets/tools/ai-influencer.jpg";
import angles from "@/assets/tools/angles.jpg";
import imageMerge from "@/assets/tools/image-merge.jpg";
import inpaint from "@/assets/tools/inpaint.jpg";

const imageMap: Record<string, string> = {
  "image-gen": imageGen,
  "skin-enhance": skinEnhance,
  "video-gen": videoGen,
  "sketch-edit": sketchEdit,
  upscale,
  "remove-bg": removeBg,
  "ai-influencer": aiInfluencer,
  angles,
  "image-merge": imageMerge,
  inpaint,
};

interface ToolCardOverride {
  image_url: string | null;
  title: string | null;
  description: string | null;
}

interface ToolCardProps {
  tool: AITool;
  index?: number;
  override?: ToolCardOverride;
}

const categoryStudioMap: Record<string, string> = {
  "صور": "/studio/images",
  "فيديو": "/studio/video",
  "ريمكس": "/studio/remix",
  "صوت": "/studio/audio",
  "افتار": "/studio/avatar",
  "حذف الخلفية": "/studio/remove-bg",
  "رفع الجودة": "/studio/upscale",
};

const optimizeStorageUrl = (url: string | undefined, width = 400): string | undefined => {
  if (!url) return url;
  // Add Supabase image transformation for storage URLs
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      `/storage/v1/render/image/public/`
    ) + `?width=${width}&quality=75`;
  }
  return url;
};

const ToolCard = ({ tool, index = 0, override }: ToolCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const navigate = useNavigate();

  const rawSrc = override?.image_url || imageMap[tool.image];
  const imgSrc = optimizeStorageUrl(rawSrc);
  const title = override?.title || tool.title;

  useEffect(() => {
    setImgLoaded(false);
  }, [imgSrc]);

  const handleClick = () => {
    const studioRoute = categoryStudioMap[tool.category];
    if (studioRoute) {
      navigate(`${studioRoute}?model=${encodeURIComponent(tool.id)}`);
    } else {
      navigate(`/tool/${tool.id}`);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className="group cursor-pointer rounded-xl overflow-hidden bg-card hover:bg-card-hover transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-secondary">
              <div className="absolute inset-0 shimmer-effect" />
            </div>
          )}
          <img
            src={imgSrc}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            loading={index < 12 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 4 ? "high" : "auto"}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <div className="absolute bottom-0 right-0 left-0 p-3">
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
            <span className="text-[10px] text-muted-foreground">{tool.provider}</span>
          </div>
          {tool.isPro && (
            <Badge className="absolute top-2 right-2 bg-pro-badge border-0 text-[10px] font-bold px-2 py-0.5">
              PRO
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolCard;
