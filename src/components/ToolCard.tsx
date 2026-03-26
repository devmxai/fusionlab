import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

// Cache for model card overrides from DB
let modelCardsCache: Record<string, { image_url: string | null; title: string | null; description: string | null }> = {};
let modelCardsFetched = false;

export const fetchModelCards = async () => {
  if (modelCardsFetched) return modelCardsCache;
  const { data } = await supabase.from("model_cards").select("tool_id, image_url, title, description, is_visible").eq("is_visible", true);
  if (data) {
    data.forEach((c: any) => { modelCardsCache[c.tool_id] = c; });
  }
  modelCardsFetched = true;
  return modelCardsCache;
};

interface ToolCardProps {
  tool: AITool;
  index?: number;
}

const ToolCard = ({ tool, index = 0 }: ToolCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cardOverride, setCardOverride] = useState<{ image_url: string | null; title: string | null; description: string | null } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchModelCards().then(cache => {
      if (cache[tool.id]) setCardOverride(cache[tool.id]);
    });
  }, [tool.id]);

  const imgSrc = cardOverride?.image_url || imageMap[tool.image];
  const title = cardOverride?.title || tool.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10px" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div
        onClick={() => navigate(`/tool/${tool.id}`)}
        className="group cursor-pointer rounded-xl overflow-hidden bg-card hover:bg-card-hover transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
          {/* Shimmer placeholder — visible until image loads */}
          {!imgLoaded && (
            <div className="absolute inset-0 bg-secondary">
              <div className="absolute inset-0 shimmer-effect" />
            </div>
          )}
          <img
            src={imgSrc}
            alt={title}
            className={`w-full h-full object-cover transition-opacity duration-200 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            loading={index < 6 ? "eager" : "lazy"}
            onLoad={() => setImgLoaded(true)}
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
    </motion.div>
  );
};

export default ToolCard;
