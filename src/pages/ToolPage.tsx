import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Send, X, Settings2, Sparkles } from "lucide-react";
import { createTask, pollTask } from "@/lib/kie-ai";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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

type AspectRatio = "1:1" | "3:4" | "9:16";
type Resolution = "1k" | "2k" | "4k";

const ratioConfig: Record<AspectRatio, { label: string; w: number; h: number; cssAspect: string; placeholderMaxW: string }> = {
  "1:1":  { label: "Square",   w: 14, h: 14, cssAspect: "1/1",  placeholderMaxW: "260px" },
  "3:4":  { label: "Portrait", w: 12, h: 16, cssAspect: "3/4",  placeholderMaxW: "220px" },
  "9:16": { label: "Story",    w: 10, h: 18, cssAspect: "9/16", placeholderMaxW: "180px" },
};

const resolutions: Resolution[] = ["1k", "2k", "4k"];

const placeholderText: Record<AspectRatio, string> = {
  "1:1": "Describe a square artwork...",
  "3:4": "Describe a portrait scene...",
  "9:16": "Describe a vertical story...",
};

const ToolPage = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tool = tools.find((t) => t.id === toolId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("2k");
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  if (!tool) {
    return (
      <div className="h-screen bg-background flex items-center justify-center" dir="rtl">
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

  const getMode = () => {
    if (refImages.length === 0) return "Text to Image";
    if (refImages.length === 1) return "Image to Image";
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
      if (!isVideoTool) {
        input.image_size = aspectRatio;
        input.output_format = "png";
      }
      if (tool.model.includes("kling")) {
        Object.assign(input, { duration: "5", aspect_ratio: aspectRatio, mode: "std", multi_shots: false });
      }
      if (refImages.length > 0) {
        const b64 = await Promise.all(refImages.map((img) => fileToBase64(img.file)));
        if (refImages.length === 1) input.image = b64[0];
        else input.images = b64;
      }

      const { taskId } = await createTask({ model: tool.model, input });
      setStatus("في الانتظار...");

      const result = await pollTask(taskId, (state, prog) => {
        const m: Record<string, string> = { waiting: "في الانتظار...", queuing: "في قائمة الانتظار...", generating: "جاري التوليد...", success: "تم!", fail: "فشل" };
        setStatus(m[state] || state);
        setProgress(prog || (state === "waiting" ? 10 : state === "queuing" ? 25 : state === "generating" ? 60 : 100));
      });

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        setResultUrls(parsed.resultUrls || []);
        toast.success("تم التوليد بنجاح!");
        setProgress(100);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
      setStatus("");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const currentRatio = ratioConfig[aspectRatio];

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="shrink-0 bg-nav-bg/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 z-50">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">{tool.title}</h1>
          <span className="text-xs text-muted-foreground">• {tool.provider}</span>
          <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
            {getMode()}
          </span>
        </div>
      </header>

      {/* Center area - placeholder / loading / results */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {loading ? (
          <CircularProgress progress={progress} status={status} />
        ) : resultUrls.length > 0 ? (
          <div className="w-full max-w-3xl overflow-y-auto max-h-full py-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground text-center">النتائج</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resultUrls.map((url, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border/50 banner-glow">
                  {isVideoTool ? <video src={url} controls className="w-full" /> : <img src={url} alt="" className="w-full" />}
                  <div className="p-2 text-center">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">تحميل</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative rounded-2xl overflow-hidden banner-glow"
            style={{ width: "100%", maxWidth: currentRatio.placeholderMaxW, aspectRatio: currentRatio.cssAspect }}
          >
            <img src={imageMap[tool.image]} alt={tool.title} className="w-full h-full object-cover blur-[3px] scale-110" />
            <div className="absolute inset-0 shimmer-effect opacity-25 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-background/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
              <Sparkles className="w-8 h-8 text-primary opacity-60" />
              <h2 className="text-lg font-bold text-foreground">{tool.title}</h2>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
              <span className="text-[10px] text-muted-foreground mt-1 bg-secondary/60 px-3 py-1 rounded-full">
                {currentRatio.label} • {resolution.toUpperCase()}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 bg-nav-bg/90 backdrop-blur-xl border-t border-border/50 px-4 py-3 z-50 relative">
        {/* Settings popover - appears above */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full right-4 mb-2 w-64 bg-card border border-border/50 rounded-xl shadow-xl p-4 space-y-4"
            >
              {/* Size */}
              {!isVideoTool && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">Size</label>
                  <div className="flex gap-1.5">
                    {(Object.keys(ratioConfig) as AspectRatio[]).map((ratio) => {
                      const cfg = ratioConfig[ratio];
                      return (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all text-[10px] font-semibold ${
                            aspectRatio === ratio
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          <div
                            className={`border-[1.5px] rounded-sm ${aspectRatio === ratio ? "border-primary-foreground" : "border-muted-foreground/50"}`}
                            style={{ width: cfg.w, height: cfg.h }}
                          />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resolution */}
              {!isVideoTool && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">Resolution</label>
                  <div className="flex gap-1.5">
                    {resolutions.map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                          resolution === res
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {res.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto space-y-2">
          {/* Uploaded images strip */}
          {refImages.length > 0 && (
            <div className="flex gap-2">
              {refImages.map((img, i) => (
                <div key={i} className="relative w-11 h-11 rounded-lg overflow-hidden border border-border/50">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

            {/* Upload button */}
            {refImages.length < 3 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                settingsOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground border border-border/50"
              }`}
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* Prompt */}
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderText[aspectRatio]}
              className="flex-1 h-9 rounded-lg bg-card border border-border/50 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              dir="ltr"
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
            />

            {/* Send */}
            <Button onClick={handleGenerate} disabled={loading} size="icon" className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolPage;
