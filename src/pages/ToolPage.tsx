import { useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Send, X, Sparkles } from "lucide-react";
import { createTask, pollTask } from "@/lib/kie-ai";
import { toast } from "sonner";
import CircularProgress from "@/components/CircularProgress";

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

type AspectRatio = "9:16" | "3:4" | "1:1";
type Resolution = "1k" | "2k" | "4k";

const aspectRatioLabels: Record<AspectRatio, string> = {
  "9:16": "ستوري",
  "3:4": "بورتريت",
  "1:1": "سكوير",
};

const aspectRatioValues: Record<AspectRatio, string> = {
  "9:16": "9:16",
  "3:4": "3:4",
  "1:1": "1:1",
};

const resolutionLabels: Record<Resolution, string> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

const placeholderByRatio: Record<AspectRatio, string> = {
  "9:16": "Describe a vertical story scene...",
  "3:4": "Describe a portrait composition...",
  "1:1": "Describe a square artwork...",
};

const ToolPage = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tool = tools.find((t) => t.id === toolId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("2k");
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);

  if (!tool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground">الأداة غير موجودة</p>
      </div>
    );
  }

  const isVideoTool = tool.category === "فيديو";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 3) {
      toast.error("الحد الأقصى 3 صور");
      return;
    }
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setRefImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setRefImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Determine mode
  const getMode = () => {
    if (refImages.length === 0) return "text-to-image";
    if (refImages.length === 1) return "image-to-image";
    return "image-merge";
  };

  const getModeLabel = () => {
    const mode = getMode();
    if (mode === "text-to-image") return "Text to Image";
    if (mode === "image-to-image") return "Image to Image";
    return "Image Merge";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    if (!prompt.trim() && refImages.length === 0) {
      toast.error("اكتب وصفاً أو ارفع صورة");
      return;
    }

    setLoading(true);
    setStatus("جاري الإرسال...");
    setProgress(0);
    setResultUrls([]);

    try {
      const input: Record<string, unknown> = { prompt };

      // Add aspect ratio and resolution
      if (!isVideoTool) {
        input.image_size = aspectRatioValues[aspectRatio];
        input.output_format = "png";
      }

      // Add video-specific defaults
      if (tool.model.includes("kling")) {
        Object.assign(input, {
          duration: "5",
          aspect_ratio: aspectRatioValues[aspectRatio],
          mode: "std",
          multi_shots: false,
        });
      }

      // Add reference images as base64
      if (refImages.length > 0) {
        const base64Images = await Promise.all(
          refImages.map((img) => fileToBase64(img.file))
        );
        if (refImages.length === 1) {
          input.image = base64Images[0];
        } else {
          input.images = base64Images;
        }
      }

      const { taskId } = await createTask({ model: tool.model, input });
      setStatus("في الانتظار...");

      const result = await pollTask(taskId, (state, prog) => {
        const stateMap: Record<string, string> = {
          waiting: "في الانتظار...",
          queuing: "في قائمة الانتظار...",
          generating: "جاري التوليد...",
          success: "تم بنجاح!",
          fail: "فشل التوليد",
        };
        setStatus(stateMap[state] || state);
        setProgress(prog || (state === "waiting" ? 10 : state === "queuing" ? 25 : state === "generating" ? (prog || 60) : 100));
      });

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        setResultUrls(parsed.resultUrls || []);
        toast.success("تم التوليد بنجاح!");
        setProgress(100);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
      setStatus("");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-nav-bg/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">{tool.title}</h1>
          <span className="text-xs text-muted-foreground">• {tool.provider}</span>
          <div className="mr-auto">
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
              {getModeLabel()}
            </span>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 space-y-4 pb-36">
        {/* Hero card with blur + shimmer */}
        <div className="relative rounded-xl overflow-hidden aspect-[3/4] max-h-[280px] banner-glow">
          <img src={imageMap[tool.image]} alt={tool.title} className="w-full h-full object-cover blur-[2px] scale-105" />
          <div className="absolute inset-0 shimmer-effect opacity-20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-4 right-4 left-4">
            <h2 className="text-lg font-bold text-foreground">{tool.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Aspect Ratio */}
          {!isVideoTool && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">القياس</label>
              <div className="flex gap-2">
                {(Object.keys(aspectRatioLabels) as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      aspectRatio === ratio
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`border-2 rounded-sm ${
                          aspectRatio === ratio ? "border-primary-foreground" : "border-muted-foreground"
                        }`}
                        style={{
                          width: ratio === "1:1" ? 16 : ratio === "3:4" ? 14 : 12,
                          height: ratio === "1:1" ? 16 : ratio === "3:4" ? 18 : 20,
                        }}
                      />
                      <span>{aspectRatioLabels[ratio]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {!isVideoTool && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">الدقة</label>
              <div className="flex gap-2">
                {(Object.keys(resolutionLabels) as Resolution[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      resolution === res
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {resolutionLabels[res]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reference Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">صور مرجعية (حتى 3)</label>
              <span className="text-[10px] text-muted-foreground">{refImages.length}/3</span>
            </div>
            <div className="flex gap-2">
              {refImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50">
                  <img src={img.preview} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ))}
              {refImages.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 flex items-center justify-center transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center py-8">
            <CircularProgress progress={progress} status={status} />
          </div>
        )}

        {/* Results */}
        {resultUrls.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">النتائج</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resultUrls.map((url, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border/50 banner-glow">
                  {isVideoTool ? (
                    <video src={url} controls className="w-full" />
                  ) : (
                    <img src={url} alt={`Result ${i + 1}`} className="w-full" />
                  )}
                  <div className="p-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      تحميل
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg/90 backdrop-blur-xl border-t border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          </button>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholderByRatio[aspectRatio]}
            className="flex-1 h-10 rounded-full bg-card border border-border/50 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            dir="ltr"
            onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
          />
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="icon"
            className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-pulse" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ToolPage;
