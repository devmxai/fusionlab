import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";
import { useEffect, useRef, useState } from "react";
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

// Section-specific card images
import latest1 from "@/assets/cards/latest-1.jpg";
import latest2 from "@/assets/cards/latest-2.jpg";
import latest3 from "@/assets/cards/latest-3.jpg";
import latest4 from "@/assets/cards/latest-4.jpg";
import latest5 from "@/assets/cards/latest-5.jpg";
import latest6 from "@/assets/cards/latest-6.jpg";
import img1 from "@/assets/cards/img-1.jpg";
import img2 from "@/assets/cards/img-2.jpg";
import img3 from "@/assets/cards/img-3.jpg";
import img4 from "@/assets/cards/img-4.jpg";
import img5 from "@/assets/cards/img-5.jpg";
import img6 from "@/assets/cards/img-6.jpg";
import vid1 from "@/assets/cards/vid-1.jpg";
import vid2 from "@/assets/cards/vid-2.jpg";
import vid3 from "@/assets/cards/vid-3.jpg";
import vid4 from "@/assets/cards/vid-4.jpg";
import vid5 from "@/assets/cards/vid-5.jpg";
import vid6 from "@/assets/cards/vid-6.jpg";
import remix1 from "@/assets/cards/remix-1.jpg";
import remix2 from "@/assets/cards/remix-2.jpg";
import remix3 from "@/assets/cards/remix-3.jpg";
import remix4 from "@/assets/cards/remix-4.jpg";
import remix5 from "@/assets/cards/remix-5.jpg";
import remix6 from "@/assets/cards/remix-6.jpg";
import avatar1 from "@/assets/cards/avatar-1.jpg";
import avatar2 from "@/assets/cards/avatar-2.jpg";
import avatar3 from "@/assets/cards/avatar-3.jpg";
import avatar4 from "@/assets/cards/avatar-4.jpg";
import avatar5 from "@/assets/cards/avatar-5.jpg";
import avatar6 from "@/assets/cards/avatar-6.jpg";
import rmbg1 from "@/assets/cards/rmbg-1.jpg";
import rmbg2 from "@/assets/cards/rmbg-2.jpg";
import upscale1 from "@/assets/cards/upscale-1.jpg";
import upscale2 from "@/assets/cards/upscale-2.jpg";

export const imageMap: Record<string, string> = {
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

// Card images keyed by "section/toolId"
export const cardImageMap: Record<string, string> = {
  "latest/kling-3": latest1,
  "latest/seedance": latest2,
  "latest/veo31-quality": latest3,
  "latest/grok-video": latest4,
  "latest/z-image": latest5,
  "latest/nano-banana": latest6,
  "images/nano-banana": img1,
  "images/flux-2-pro": img2,
  "images/seedream-5-lite": img3,
  "images/z-image": img4,
  "images/nano-banana-pro": img5,
  "images/grok-imagine": img6,
  "videos/kling-3": vid1,
  "videos/seedance": vid2,
  "videos/veo31-fast": vid3,
  "videos/grok-video": vid4,
  "videos/veo31-quality": vid5,
  "videos/sora-2": vid6,
  "remix/nano-banana-edit": remix1,
  "remix/qwen-image-edit": remix2,
  "remix/flux-kontext-pro": remix3,
  "remix/gpt-image-1-5-edit": remix4,
  "remix/flux-kontext-max": remix5,
  "remix/seedream-4-5-edit": remix6,
  "avatar/kling-avatar-standard": avatar1,
  "avatar/infinitalk": avatar2,
  "avatar/kling-avatar-pro": avatar3,
  "avatar/wan-animate": avatar4,
  "avatar/kling-avatar-standard-2": avatar5,
  "avatar/infinitalk-2": avatar6,
  "remove-bg/recraft-bg": rmbg1,
  "remove-bg/recraft-bg-2": rmbg2,
  "upscale/recraft-crisp-upscale": upscale1,
  "upscale/topaz-upscale": upscale2,
};

interface ToolCardOverride {
  image_url: string | null;
  title: string | null;
  description: string | null;
  updated_at?: string | null;
}

interface ToolCardProps {
  tool: AITool;
  index?: number;
  override?: ToolCardOverride;
  sectionSlug?: string;
  eagerLoad?: boolean;
  highPriority?: boolean;
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

const appendParam = (url: string, key: string, value: string) => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
};

export const optimizeStorageUrl = (
  url: string | undefined,
  width = 360,
  versionKey?: string | null
): string | undefined => {
  if (!url) return url;

  let nextUrl = url;

  if (nextUrl.includes("/storage/v1/object/public/")) {
    nextUrl = nextUrl.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
  }

  if (nextUrl.includes("/storage/v1/render/image/public/")) {
    nextUrl = appendParam(nextUrl, "width", String(width));
    nextUrl = appendParam(nextUrl, "quality", "75");
  }

  if (versionKey) {
    nextUrl = appendParam(nextUrl, "v", versionKey);
  }

  return nextUrl;
};

const ToolCard = ({
  tool,
  index = 0,
  override,
  sectionSlug,
  eagerLoad,
  highPriority,
}: ToolCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const navigate = useNavigate();
  const shouldEagerLoad = eagerLoad ?? false;
  const shouldHighPriority = highPriority ?? false;

  // Priority: 1) CMS override image, 2) section-specific card image, 3) default tool image
  const sectionKey = sectionSlug ? `${sectionSlug}/${tool.id}` : "";
  const rawSrc = override?.image_url || (sectionKey && cardImageMap[sectionKey]) || imageMap[tool.image];
  const imgSrc = optimizeStorageUrl(rawSrc, 400, override?.updated_at ?? null);
  const title = override?.title || tool.title;

  useEffect(() => {
    if (!imgSrc) {
      setImgLoaded(true);
      return;
    }

    const imageElement = imgRef.current;
    if (imageElement?.complete) {
      setImgLoaded(true);
      return;
    }

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
            ref={imgRef}
            src={imgSrc}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            loading={shouldEagerLoad ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 360px"
            decoding="async"
            fetchPriority={shouldHighPriority ? "high" : "auto"}
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
