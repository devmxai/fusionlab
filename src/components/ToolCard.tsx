import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";
import { motion } from "framer-motion";
import { useState } from "react";

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
  "upscale": upscale,
  "remove-bg": removeBg,
  "ai-influencer": aiInfluencer,
  "angles": angles,
  "image-merge": imageMerge,
  "inpaint": inpaint,
};

interface ToolCardProps {
  tool: AITool;
  index?: number;
}

const ShimmerCard = () => (
  <div className="rounded-xl overflow-hidden bg-card border border-border/50">
    <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
      <div className="absolute inset-0 shimmer-effect" />
    </div>
    <div className="p-3 space-y-2">
      <div className="h-4 w-3/4 rounded bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 shimmer-effect" />
      </div>
      <div className="h-3 w-1/2 rounded bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 shimmer-effect" />
      </div>
    </div>
  </div>
);

const ToolCard = ({ tool, index = 0 }: ToolCardProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
    >
      {!loaded && <ShimmerCard />}
      <div
        className={`group cursor-pointer rounded-xl overflow-hidden bg-card hover:bg-card-hover transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)] ${
          !loaded ? "hidden" : ""
        }`}
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={imageMap[tool.image]}
            alt={tool.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
          {tool.isPro && (
            <Badge className="absolute top-2 right-2 bg-pro-badge border-0 text-[10px] font-bold px-2 py-0.5">
              PRO
            </Badge>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate">{tool.title}</h3>
            <span className="text-[10px] text-muted-foreground shrink-0">• {tool.provider}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tool.description}</p>
        </div>
      </div>
    </motion.div>
  );
};

export { ShimmerCard };
export default ToolCard;
