import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";
import { motion } from "framer-motion";
import { useState } from "react";
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

interface ToolCardProps {
  tool: AITool;
  index?: number;
}

const ShimmerCard = () => (
  <div className="rounded-xl overflow-hidden bg-card border border-border/50">
    <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
      <div className="absolute inset-0 shimmer-effect" />
    </div>
  </div>
);

const ToolCard = ({ tool, index = 0 }: ToolCardProps) => {
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
    >
      {!loaded && <ShimmerCard />}
      <div
        onClick={() => navigate(`/tool/${tool.id}`)}
        className={`group cursor-pointer rounded-xl overflow-hidden bg-card hover:bg-card-hover transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)] ${
          !loaded ? "hidden" : ""
        }`}
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={imageMap[tool.image]}
            alt={tool.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <div className="absolute bottom-0 right-0 left-0 p-3">
            <h3 className="text-sm font-bold text-foreground truncate">{tool.title}</h3>
            <span className="text-[10px] text-muted-foreground">{tool.provider}</span>
          </div>
          {tool.isPro && (
            <Badge className="absolute top-2 right-2 bg-pro-badge border-0 text-[10px] font-bold px-2 py-0.5">
              PRO
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export { ShimmerCard };
export default ToolCard;
