import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { createTask, pollTask } from "@/lib/kie-ai";
import { toast } from "sonner";

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

const ToolPage = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tool = tools.find((t) => t.id === toolId);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [resultUrls, setResultUrls] = useState<string[]>([]);

  if (!tool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">الأداة غير موجودة</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("اكتب وصفاً للمحتوى المطلوب");
      return;
    }

    setLoading(true);
    setStatus("جاري الإرسال...");
    setResultUrls([]);

    try {
      const input: Record<string, unknown> = { prompt };

      // Add model-specific defaults
      if (tool.model.includes("kling")) {
        Object.assign(input, {
          duration: "5",
          aspect_ratio: "16:9",
          mode: "std",
          multi_shots: false,
        });
      } else if (tool.model.includes("nano-banana") || tool.model.includes("seedream") || tool.model.includes("flux") || tool.model.includes("grok")) {
        Object.assign(input, {
          output_format: "png",
          image_size: "1:1",
        });
      }

      const { taskId } = await createTask({ model: tool.model, input });
      setStatus("في الانتظار...");

      const result = await pollTask(taskId, (state, progress) => {
        const stateMap: Record<string, string> = {
          waiting: "في الانتظار...",
          queuing: "في قائمة الانتظار...",
          generating: progress ? `جاري التوليد... ${progress}%` : "جاري التوليد...",
          success: "تم بنجاح!",
          fail: "فشل التوليد",
        };
        setStatus(stateMap[state] || state);
      });

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        setResultUrls(parsed.resultUrls || []);
        toast.success("تم التوليد بنجاح!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-nav-bg/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">{tool.title}</h1>
          <span className="text-xs text-muted-foreground">• {tool.provider}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Tool Hero */}
        <div className="relative rounded-xl overflow-hidden aspect-[21/9] banner-glow">
          <img src={imageMap[tool.image]} alt={tool.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 right-4">
            <h2 className="text-lg font-bold text-foreground">{tool.title}</h2>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">اكتب الوصف (Prompt)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="صف المحتوى الذي تريد توليده..."
            className="w-full min-h-[100px] rounded-xl bg-card border border-border/50 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            dir="ltr"
          />
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {status}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                توليد
              </span>
            )}
          </Button>
        </div>

        {/* Results */}
        {resultUrls.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">النتائج</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resultUrls.map((url, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border/50 banner-glow">
                  {tool.category === "فيديو" ? (
                    <video src={url} controls className="w-full" />
                  ) : (
                    <img src={url} alt={`Result ${i + 1}`} className="w-full" />
                  )}
                  <div className="p-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      تحميل
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolPage;
