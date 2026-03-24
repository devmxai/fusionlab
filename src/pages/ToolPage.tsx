import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools, buildModelInput } from "@/data/tools";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Send, X, Settings2, Sparkles } from "lucide-react";
import { createTask, createVeoTask, pollTask, uploadFileBase64 } from "@/lib/kie-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "@/components/CircularProgress";
import ImageViewer from "@/components/ImageViewer";

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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");

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
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const { user, credits, refreshCredits } = useAuth();

  const handleGenerate = async () => {
    if (!prompt.trim() && refImages.length === 0) {
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
      if (refImages.length > 0) {
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

      const isVeo = tool.isVeoApi === true;
      const input = buildModelInput(tool.model, prompt, aspectRatio, resolution, imageUrls);

      setStatus("جاري إنشاء المهمة...");
      setProgress(30);

      let taskId: string;
      if (isVeo) {
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
      }, 120, 3000, isVeo);

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        setResultUrls(parsed.resultUrls || []);
        toast.success("تم التوليد بنجاح!");
        setProgress(100);

        // Deduct 1 credit
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

        // Save to generations
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
        <motion.div
          key="loading"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex flex-col items-center justify-center gap-2"
        >
          <CircularProgress progress={progress} size={90} status={status} />
        </motion.div>
      );
    }

    if (resultUrls.length > 0) {
      return (
        <motion.div
          key="result"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full cursor-pointer"
          onClick={() => !isVideoTool && openViewer(resultUrls[0])}
        >
          {isVideoTool ? (
            <video src={resultUrls[0]} controls className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <img src={resultUrls[0]} alt="Result" className="w-full h-full object-cover rounded-2xl" />
          )}
        </motion.div>
      );
    }

    return (
      <motion.div
        key="placeholder"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-2 text-center px-4"
      >
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

      {/* Center area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {/* Additional results */}
        {resultUrls.length > 1 && !loading && (
          <div className="w-full max-w-3xl overflow-x-auto flex gap-2 mb-4 scrollbar-hide">
            {resultUrls.slice(1).map((url, i) => (
              <div
                key={i}
                className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openViewer(url)}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Main card - empty border with subtle shimmer, no background image */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`relative rounded-2xl overflow-hidden flex items-center justify-center border ${
            resultUrls.length > 0 && !loading
              ? "border-transparent"
              : loading
              ? "border-primary/30"
              : "border-border/30"
          }`}
          style={{
            width: "100%",
            maxWidth: currentRatio.placeholderMaxW,
            aspectRatio: currentRatio.cssAspect,
            background: resultUrls.length > 0 && !loading ? "transparent" : undefined,
          }}
        >
          {/* Subtle shimmer - idle state (very faint) */}
          {resultUrls.length === 0 && !loading && (
            <div className="absolute inset-0 shimmer-effect opacity-[0.06] pointer-events-none" />
          )}

          {/* Loading state - stronger shimmer + blur overlay */}
          {loading && (
            <>
              <div className="absolute inset-0 shimmer-effect opacity-[0.15] pointer-events-none" />
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-none" />
            </>
          )}

          {/* Faint background for empty/loading states */}
          {(resultUrls.length === 0 || loading) && (
            <div className="absolute inset-0 bg-secondary/20 pointer-events-none" />
          )}

          {/* Dynamic content */}
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
              {renderCardContent()}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Download link for result */}
        {resultUrls.length > 0 && !loading && (
          <div className="mt-3 flex gap-2">
            {resultUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full"
              >
                تحميل {resultUrls.length > 1 ? `${i + 1}` : ""}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 bg-nav-bg/90 backdrop-blur-xl border-t border-border/50 px-4 py-3 z-50 relative">
        {/* Settings popover */}
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

            {refImages.length < 3 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

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

            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderText[aspectRatio]}
              className="flex-1 h-9 rounded-lg bg-card border border-border/50 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              dir="ltr"
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
            />

            <Button
              onClick={handleGenerate}
              disabled={loading}
              size="icon"
              className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Image Viewer Popup */}
      <ImageViewer src={viewerUrl} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  );
};

export default ToolPage;
