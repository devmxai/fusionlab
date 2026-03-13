import { Badge } from "@/components/ui/badge";
import type { AITool } from "@/data/tools";

// Static imports for tool images
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
}

const ToolCard = ({ tool }: ToolCardProps) => {
  return (
    <div className="group cursor-pointer rounded-lg overflow-hidden bg-card hover:bg-card-hover transition-all duration-300 border border-border/50 hover:border-primary/30">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={imageMap[tool.image]}
          alt={tool.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {tool.isPro && (
          <Badge className="absolute top-2 right-2 bg-pro-badge border-0 text-xs font-semibold px-2 py-0.5">
            PRO
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground truncate">{tool.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tool.description}</p>
      </div>
    </div>
  );
};

export default ToolCard;
