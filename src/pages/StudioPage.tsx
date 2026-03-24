import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools, buildModelInput, AITool } from "@/data/tools";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Send, X, Sparkles, ChevronDown, Upload } from "lucide-react";
import { createTask, createVeoTask, createFluxKontextTask, pollTask } from "@/lib/kie-ai";
import { uploadFileBase64 } from "@/lib/kie-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "@/components/CircularProgress";
import ImageViewer from "@/components/ImageViewer";

type AspectRatio = "1:1" | "3:4" | "9:16";
type Resolution = "1k" | "2k" | "4k";
type UpscaleFactor = "1.5" | "2" | "4";

const categorySlugMap: Record<string, string> = {
  images: "صور",
  video: "فيديو",
  remix: "ريمكس",
  audio: "صوت",
  avatar: "افتار",
  "remove-bg": "حذف الخلفية",
  upscale: "رفع الجودة",
};

const categoryTitleMap: Record<string, string> = {
  images: "استديو الصور",
  video: "استديو الفيديو",
  remix: "استديو الريمكس",
  audio: "استديو الصوت",
  avatar: "استديو الأفتار",
  "remove-bg": "حذف الخلفية",
  upscale: "رفع الجودة",
};

const ratioConfig: Record<AspectRatio, { label: string; w: number; h: number; cssAspect: string; placeholderMaxW: string }> = {
  "1:1":  { label: "1:1",   w: 14, h: 14, cssAspect: "1/1",  placeholderMaxW: "260px" },
  "3:4":  { label: "3:4",   w: 12, h: 16, cssAspect: "3/4",  placeholderMaxW: "220px" },
  "9:16": { label: "9:16",  w: 10, h: 18, cssAspect: "9/16", placeholderMaxW: "180px" },
};

const resolutions: Resolution[] = ["1k", "2k", "4k"];
const upscaleFactors: UpscaleFactor[] = ["1.5", "2", "4"];
const videoDurations = ["5", "8", "10"];

const StudioPage = () => {
  const { category } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const aspectMenuRef = useRef<HTMLDivElement>(null);
  const resMenuRef = useRef<HTMLDivElement>(null);
  const durationMenuRef = useRef<HTMLDivElement>(null);
  const upscaleMenuRef = useRef<HTMLDivElement>(null);

  const categoryName = category ? categorySlugMap[category] : undefined;
  const studioTitle = category ? categoryTitleMap[category] : "استديو";

  const categoryTools = useMemo(
    () => tools.filter((t) => t.category === categoryName),
    [categoryName]
  );

  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [aspectMenuOpen, setAspectMenuOpen] = useState(false);
  const [resMenuOpen, setResMenuOpen] = useState(false);
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [upscaleMenuOpen, setUpscaleMenuOpen] = useState(false);
  const [videoDuration, setVideoDuration] = useState("5");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("2k");
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [firstFrame, setFirstFrame] = useState<{ file: File; preview: string } | null>(null);
  const [lastFrame, setLastFrame] = useState<{ file: File; preview: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>("2");

  // Auto-select first tool
  useEffect(() => {
    if (categoryTools.length > 0 && !selectedTool) {
      setSelectedTool(categoryTools[0]);
    }
  }, [categoryTools, selectedTool]);

  // Close model menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const refs = [modelMenuRef, aspectMenuRef, resMenuRef, durationMenuRef, upscaleMenuRef];
      refs.forEach((ref) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          if (ref === modelMenuRef) setModelMenuOpen(false);
          if (ref === aspectMenuRef) setAspectMenuOpen(false);
          if (ref === resMenuRef) setResMenuOpen(false);
          if (ref === durationMenuRef) setDurationMenuOpen(false);
          if (ref === upscaleMenuRef) setUpscaleMenuOpen(false);
        }
      });
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!categoryName || categoryTools.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-3" dir="rtl">
        <Sparkles className="w-10 h-10 text-primary opacity-40" />
        <p className="text-muted-foreground text-sm">
          {categoryName ? "لا توجد نماذج متاحة لهذا التصنيف حالياً" : "التصنيف غير موجود"}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          العودة
        </Button>
      </div>
    );
  }

  const tool = selectedTool || categoryTools[0];
  const isVideoTool = category === "video";
  const isImageOnlyTool = category === "remove-bg" || category === "upscale";
  const isUpscaleTool = category === "upscale";
  const isRemixTool = category === "remix";
  const isFluxKontext = tool.isFluxKontextApi === true;
  const hasFrameMode = tool.frameMode === "first-last" || tool.frameMode === "first-only";

  const maxImages = isRemixTool
    ? (tool.model === "gpt-image/1.5-image-to-image" ? 16 : tool.model === "seedream/4.5-edit" ? 14 : 3)
    : isImageOnlyTool ? 1 : 3;

  // Show aspect ratio settings for image & remix tools (not image-only or upscale)
  const showAspectSettings = !isImageOnlyTool;
  const showResolutionSettings = !isVideoTool && !isImageOnlyTool;
  const showUpscaleSettings = isUpscaleTool;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > maxImages) {
      toast.error(`الحد الأقصى ${maxImages} صور`);
      return;
    }
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setRefImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFrameUpload = (type: "first" | "last", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "first") {
      if (firstFrame) URL.revokeObjectURL(firstFrame.preview);
      setFirstFrame({ file, preview });
    } else {
      if (lastFrame) URL.revokeObjectURL(lastFrame.preview);
      setLastFrame({ file, preview });
    }
    if (type === "first" && firstFrameInputRef.current) firstFrameInputRef.current.value = "";
    if (type === "last" && lastFrameInputRef.current) lastFrameInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setRefImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getMode = () => {
    if (isImageOnlyTool) return category === "remove-bg" ? "حذف الخلفية" : "رفع الجودة";
    if (isRemixTool) {
      if (refImages.length === 0) return "Text to Image";
      if (refImages.length === 1) return "Image Edit";
      return "Image Remix";
    }
    if (hasFrameMode && (firstFrame || lastFrame)) return "Image to Video";
    if (refImages.length === 0) return "Text to Image";
    if (refImages.length === 1) return "Image to Image";
    return "Image Merge";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const { user, credits, refreshCredits } = useAuth();

  const handleGenerate = async () => {
    if (isImageOnlyTool && refImages.length === 0) {
      toast.error("يجب رفع صورة أولاً");
      return;
    }
    if (isRemixTool && refImages.length === 0 && !prompt.trim()) {
      toast.error("ارفع صورة واحدة على الأقل أو اكتب وصفاً");
      return;
    }
    if (!isImageOnlyTool && !isRemixTool && !prompt.trim() && refImages.length === 0 && !firstFrame) {
      toast.error("اكتب وصفاً أو ارفع صورة");
      return;
    }
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }
    if (credits <= 0) {
      toast.error("لا يوجد رصيد كافٍ. قم بترقية اشتراكك");
      navigate("/pricing");
      return;
    }

    setLoading(true);
    setStatus("جاري الإرسال...");
    setProgress(5);
    setResultUrls([]);

    try {
      let imageUrls: string[] | undefined;

      // Handle frame uploads for video models
      if (hasFrameMode && (firstFrame || lastFrame)) {
        setStatus("جاري رفع الصور...");
        setProgress(10);
        imageUrls = [];
        if (firstFrame) {
          const b64 = await fileToBase64(firstFrame.file);
          const url = await uploadFileBase64(b64, `first_frame_${Date.now()}.png`);
          imageUrls.push(url);
        }
        if (lastFrame) {
          const b64 = await fileToBase64(lastFrame.file);
          const url = await uploadFileBase64(b64, `last_frame_${Date.now()}.png`);
          imageUrls.push(url);
        }
        setProgress(25);
      } else if (refImages.length > 0) {
        setStatus("جاري رفع الصور...");
        setProgress(10);
        imageUrls = [];
        for (let i = 0; i < refImages.length; i++) {
          const b64 = await fileToBase64(refImages[i].file);
          const url = await uploadFileBase64(b64, `ref_${Date.now()}_${i}.png`);
          imageUrls.push(url);
          setProgress(10 + ((i + 1) / refImages.length) * 15);
        }
      }

      const extraParams = isUpscaleTool ? { upscale_factor: upscaleFactor } : undefined;
      const input = buildModelInput(tool.model, prompt, aspectRatio, resolution, imageUrls, extraParams);
      const isVeo = tool.isVeoApi === true;
      setStatus("جاري إنشاء المهمة...");
      setProgress(30);

      let taskId: string;
      let apiType: "standard" | "veo" | "flux-kontext" = "standard";

      if (isFluxKontext) {
        apiType = "flux-kontext";
        const fkResult = await createFluxKontextTask(input);
        taskId = fkResult.taskId;
      } else if (isVeo) {
        apiType = "veo";
        const veoResult = await createVeoTask(input);
        taskId = veoResult.taskId;
      } else {
        const stdResult = await createTask({ model: tool.model, input });
        taskId = stdResult.taskId;
      }

      const result = await pollTask(taskId, (state, prog) => {
        const m: Record<string, string> = {
          waiting: "في الانتظار...",
          queuing: "في قائمة الانتظار...",
          generating: "جاري التوليد...",
          success: "تم!",
          fail: "فشل",
        };
        setStatus(m[state] || state);
        if (prog) {
          setProgress(30 + (prog / 100) * 70);
        } else {
          setProgress(
            state === "waiting" ? 35 :
            state === "queuing" ? 45 :
            state === "generating" ? 65 :
            state === "success" ? 100 : progress
          );
        }
      }, 120, 3000, false, apiType);

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        setResultUrls(parsed.resultUrls || []);
        toast.success("تم التوليد بنجاح!");
        setProgress(100);

        const { data: currentCredits } = await supabase
          .from("user_credits")
          .select("balance, total_spent")
          .eq("user_id", user.id)
          .maybeSingle();

        if (currentCredits) {
          await supabase.from("user_credits").update({
            balance: Math.max(0, currentCredits.balance - 1),
            total_spent: (currentCredits.total_spent || 0) + 1,
            updated_at: new Date().toISOString(),
          }).eq("user_id", user.id);

          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            amount: 1,
            action: "spent" as any,
            description: `توليد بـ ${tool.title}`,
          });
        }

        const fileUrl = parsed.resultUrls?.[0];
        if (fileUrl) {
          await supabase.from("generations").insert({
            user_id: user.id,
            tool_id: tool.id,
            tool_name: tool.title,
            prompt,
            file_url: fileUrl,
            file_type: isVideoTool ? "video" : "image",
            metadata: { aspectRatio, resolution, model: tool.model } as any,
          });
        }

        await refreshCredits();
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

  const openViewer = (url: string) => {
    setViewerUrl(url);
    setViewerOpen(true);
  };

  const renderCardContent = () => {
    if (loading) {
      return (
        <motion.div key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          className="flex flex-col items-center justify-center gap-2">
          <CircularProgress progress={progress} size={90} status={status} />
        </motion.div>
      );
    }

    if (resultUrls.length > 0) {
      return (
        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="w-full h-full cursor-pointer" onClick={() => !isVideoTool && openViewer(resultUrls[0])}>
          {isVideoTool ? (
            <video src={resultUrls[0]} controls className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <img src={resultUrls[0]} alt="Result" className="w-full h-full object-cover rounded-2xl" />
          )}
        </motion.div>
      );
    }

    return (
      <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-2 text-center px-4">
        <Sparkles className="w-7 h-7 text-primary opacity-40" />
        <h2 className="text-sm font-bold text-foreground/70">{tool.title}</h2>
        <p className="text-[10px] text-muted-foreground/60">{tool.description}</p>
        <span className="text-[9px] text-muted-foreground/50 mt-1 bg-secondary/30 px-3 py-0.5 rounded-full">
          {currentRatio.label} • {resolution.toUpperCase()}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* ── Header / App Bar ── */}
      <header className="shrink-0 bg-card/90 backdrop-blur-xl border-b border-border/30 z-50 rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2.5 max-w-3xl mx-auto overflow-x-auto scrollbar-hide">
          {/* Back button - arrow pointing right for RTL */}
          <button
            onClick={() => navigate("/")}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-border/40 shrink-0" />

          {/* Model dropdown */}
          <div className="relative shrink-0" ref={modelMenuRef}>
            <button
              onClick={() => { setModelMenuOpen((v) => !v); setAspectMenuOpen(false); setResMenuOpen(false); setDurationMenuOpen(false); setUpscaleMenuOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/30 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-[11px] font-bold text-foreground truncate max-w-[100px]">{tool.title}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {modelMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px]"
                >
                  <div className="max-h-64 overflow-y-auto">
                    {categoryTools.map((t) => (
                      <button key={t.id}
                        onClick={() => { setSelectedTool(t); setModelMenuOpen(false); setResultUrls([]);
                          if (firstFrame) { URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }
                          if (lastFrame) { URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors ${tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/50"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{t.provider}</p>
                        </div>
                        {t.isPro && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">PRO</span>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Aspect Ratio dropdown */}
          {showAspectSettings && (
            <div className="relative shrink-0" ref={aspectMenuRef}>
              <button
                onClick={() => { setAspectMenuOpen((v) => !v); setModelMenuOpen(false); setResMenuOpen(false); setDurationMenuOpen(false); setUpscaleMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/30 hover:bg-secondary/80 transition-colors"
              >
                <span className="text-[11px] font-bold text-foreground">{aspectRatio}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${aspectMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {aspectMenuOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-1 bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[100px]"
                  >
                    {(Object.keys(ratioConfig) as AspectRatio[]).map((ratio) => (
                      <button key={ratio} onClick={() => { setAspectRatio(ratio); setAspectMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-right text-xs font-semibold transition-colors ${aspectRatio === ratio ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"}`}
                      >{ratio}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Resolution dropdown (non-video) */}
          {showResolutionSettings && (
            <div className="relative shrink-0" ref={resMenuRef}>
              <button
                onClick={() => { setResMenuOpen((v) => !v); setModelMenuOpen(false); setAspectMenuOpen(false); setDurationMenuOpen(false); setUpscaleMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/30 hover:bg-secondary/80 transition-colors"
              >
                <span className="text-[11px] font-bold text-foreground">{resolution.toUpperCase()}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${resMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {resMenuOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-1 bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[80px]"
                  >
                    {resolutions.map((res) => (
                      <button key={res} onClick={() => { setResolution(res); setResMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-right text-xs font-semibold transition-colors ${resolution === res ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"}`}
                      >{res.toUpperCase()}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Duration dropdown (video only) */}
          {isVideoTool && (
            <div className="relative shrink-0" ref={durationMenuRef}>
              <button
                onClick={() => { setDurationMenuOpen((v) => !v); setModelMenuOpen(false); setAspectMenuOpen(false); setResMenuOpen(false); setUpscaleMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/30 hover:bg-secondary/80 transition-colors"
              >
                <span className="text-[11px] font-bold text-foreground">{videoDuration}s</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${durationMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {durationMenuOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-1 bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[80px]"
                  >
                    {videoDurations.map((d) => (
                      <button key={d} onClick={() => { setVideoDuration(d); setDurationMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-right text-xs font-semibold transition-colors ${videoDuration === d ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"}`}
                      >{d} ثانية</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Upscale Factor dropdown */}
          {showUpscaleSettings && (
            <div className="relative shrink-0" ref={upscaleMenuRef}>
              <button
                onClick={() => { setUpscaleMenuOpen((v) => !v); setModelMenuOpen(false); setAspectMenuOpen(false); setResMenuOpen(false); setDurationMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border/30 hover:bg-secondary/80 transition-colors"
              >
                <span className="text-[11px] font-bold text-foreground">{upscaleFactor}x</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${upscaleMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {upscaleMenuOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-1 bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[80px]"
                  >
                    {upscaleFactors.map((f) => (
                      <button key={f} onClick={() => { setUpscaleFactor(f); setUpscaleMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-right text-xs font-semibold transition-colors ${upscaleFactor === f ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"}`}
                      >{f}x</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      {/* ── Center area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {resultUrls.length > 1 && !loading && (
          <div className="w-full max-w-3xl overflow-x-auto flex gap-2 mb-4 scrollbar-hide">
            {resultUrls.slice(1).map((url, i) => (
              <div key={i} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openViewer(url)}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`relative rounded-2xl overflow-hidden flex items-center justify-center border ${
            resultUrls.length > 0 && !loading ? "border-transparent" : loading ? "border-primary/30" : "border-border/30"
          }`}
          style={{
            width: "100%",
            maxWidth: currentRatio.placeholderMaxW,
            aspectRatio: currentRatio.cssAspect,
            background: resultUrls.length > 0 && !loading ? "transparent" : undefined,
          }}
        >
          {resultUrls.length === 0 && !loading && (
            <div className="absolute inset-0 shimmer-effect opacity-[0.06] pointer-events-none" />
          )}
          {loading && (
            <>
              <div className="absolute inset-0 shimmer-effect opacity-[0.15] pointer-events-none" />
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-none" />
            </>
          )}
          {(resultUrls.length === 0 || loading) && (
            <div className="absolute inset-0 bg-secondary/20 pointer-events-none" />
          )}
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
              {renderCardContent()}
            </AnimatePresence>
          </div>
        </motion.div>

        {resultUrls.length > 0 && !loading && (
          <div className="mt-3 flex gap-2">
            {resultUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full">
                تحميل {resultUrls.length > 1 ? `${i + 1}` : ""}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 bg-card/90 backdrop-blur-xl border-t border-border/30 px-4 py-3 z-50">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Frame upload boxes for first/last frame models */}
          {hasFrameMode && (
            <div className="flex gap-2">
              {/* First Frame */}
              <input ref={firstFrameInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFrameUpload("first", e)} />
              <button
                onClick={() => firstFrameInputRef.current?.click()}
                className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                  firstFrame ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                {firstFrame ? (
                  <div className="relative w-full h-14">
                    <img src={firstFrame.preview} alt="First frame" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={(e) => { e.stopPropagation(); URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }}
                      className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-destructive-foreground" />
                    </button>
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">
                      First Frame
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-2">
                    <Upload className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-[9px] font-semibold text-muted-foreground/70">First Frame</span>
                  </div>
                )}
              </button>

              {/* Last Frame (only for first-last mode) */}
              {tool.frameMode === "first-last" && (
                <>
                  <input ref={lastFrameInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleFrameUpload("last", e)} />
                  <button
                    onClick={() => lastFrameInputRef.current?.click()}
                    className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                      lastFrame ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                    }`}
                    style={{ minHeight: "56px" }}
                  >
                    {lastFrame ? (
                      <div className="relative w-full h-14">
                        <img src={lastFrame.preview} alt="Last frame" className="w-full h-full object-cover rounded-lg" />
                        <button
                          onClick={(e) => { e.stopPropagation(); URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }}
                          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5 text-destructive-foreground" />
                        </button>
                        <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">
                          Last Frame
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 py-2">
                        <Upload className="w-4 h-4 text-muted-foreground/60" />
                        <span className="text-[9px] font-semibold text-muted-foreground/70">Last Frame</span>
                      </div>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Regular image uploads strip */}
          {!hasFrameMode && refImages.length > 0 && (
            <div className="flex gap-2">
              {refImages.map((img, i) => (
                <div key={i} className="relative w-11 h-11 rounded-lg overflow-hidden border border-border/50">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple={!isImageOnlyTool} className="hidden" onChange={handleImageUpload} />

            {/* Upload button (only if not frame mode) */}
            {!hasFrameMode && refImages.length < maxImages && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {isImageOnlyTool ? (
              <div className="flex-1 h-9 rounded-lg bg-card border border-border/50 px-3 flex items-center">
                <span className="text-xs text-muted-foreground">
                  {refImages.length > 0 ? "جاهز للمعالجة" : category === "remove-bg" ? "ارفع صورة لحذف الخلفية" : "ارفع صورة لرفع الجودة"}
                </span>
              </div>
            ) : (
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isRemixTool ? "صف التعديل المطلوب..." : "اكتب وصفاً لما تريد توليده..."}
                className="flex-1 h-9 rounded-lg bg-secondary/40 border border-border/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
              />
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || (isImageOnlyTool && refImages.length === 0)}
              size="icon"
              className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <ImageViewer src={viewerUrl} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  );
};

export default StudioPage;
