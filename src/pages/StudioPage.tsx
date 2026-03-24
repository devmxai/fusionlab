import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tools, buildModelInput, AITool } from "@/data/tools";
import { getModelCapabilities } from "@/data/model-capabilities";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Send, X, Sparkles, ChevronDown, Upload, Plus } from "lucide-react";
import { createTask, createVeoTask, createFluxKontextTask, pollTask } from "@/lib/kie-ai";
import { uploadFileBase64 } from "@/lib/kie-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "@/components/CircularProgress";
import ImageViewer from "@/components/ImageViewer";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
type Resolution = string;
type UpscaleFactor = string;
type Quality = string;

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

const ratioConfig: Record<string, { label: string; cssAspect: string; placeholderMaxW: string }> = {
  "1:1":  { label: "1:1",   cssAspect: "1/1",  placeholderMaxW: "260px" },
  "3:4":  { label: "3:4",   cssAspect: "3/4",  placeholderMaxW: "220px" },
  "4:3":  { label: "4:3",   cssAspect: "4/3",  placeholderMaxW: "320px" },
  "9:16": { label: "9:16",  cssAspect: "9/16", placeholderMaxW: "180px" },
  "16:9": { label: "16:9",  cssAspect: "16/9", placeholderMaxW: "340px" },
  "21:9": { label: "21:9",  cssAspect: "21/9", placeholderMaxW: "360px" },
};

const dropdownAnim = {
  initial: { opacity: 0, y: -8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.96 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

const StudioPage = () => {
  const { category } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remixSlotInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const [remixUploadSlot, setRemixUploadSlot] = useState<number>(-1);

  const categoryName = category ? categorySlugMap[category] : undefined;

  const categoryTools = useMemo(
    () => tools.filter((t) => t.category === categoryName),
    [categoryName]
  );

  // ── State ──
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<Resolution>("2k");
  const [videoDuration, setVideoDuration] = useState("5");
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>("2");
  const [quality, setQuality] = useState<Quality>("std");
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [firstFrame, setFirstFrame] = useState<{ file: File; preview: string } | null>(null);
  const [lastFrame, setLastFrame] = useState<{ file: File; preview: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");

  // Dropdown open states
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Get capabilities for selected model
  const caps = useMemo(() => {
    if (!selectedTool) return null;
    return getModelCapabilities(selectedTool.model);
  }, [selectedTool]);

  // Reset settings when model changes
  const handleSelectModel = (t: AITool) => {
    setSelectedTool(t);
    setOpenMenu(null);
    setResultUrls([]);
    // Reset frames
    if (firstFrame) { URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }
    if (lastFrame) { URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }
    // Baseline defaults
    setAspectRatio("1:1");
    setVideoDuration("5");
    setResolution("2k");
    setUpscaleFactor("2");
    setQuality("std");
    // Set defaults from capabilities
    const c = getModelCapabilities(t.model);
    if (c.aspectRatios?.length) setAspectRatio(c.aspectRatios[0] as AspectRatio);
    if (c.durations?.length) setVideoDuration(c.durations[0]);
    if (c.resolutions?.length) setResolution(c.resolutions[0]);
    if (c.upscaleFactors?.length) setUpscaleFactor(c.upscaleFactors[0]);
    if (c.qualities?.length) setQuality(c.qualities[0]);
  };

  if (!categoryName || categoryTools.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-3" dir="rtl">
        <Sparkles className="w-10 h-10 text-primary opacity-40" />
        <p className="text-muted-foreground text-sm">
          {categoryName ? "لا توجد نماذج متاحة لهذا التصنيف حالياً" : "التصنيف غير موجود"}
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>العودة</Button>
      </div>
    );
  }

  const tool = selectedTool || categoryTools[0];
  const isVideoTool = category === "video";
  const isImageOnlyTool = category === "remove-bg" || category === "upscale";
  const isUpscaleTool = category === "upscale";
  const isRemixTool = category === "remix";
  const isFluxKontext = tool.isFluxKontextApi === true;
  const hasFrameMode = !!(caps?.frameMode || tool.frameMode);
  const frameMode = caps?.frameMode || tool.frameMode;

  // Remix image limits from capabilities
  const remixMaxImages = isRemixTool ? (caps?.maxImages ?? 3) : 0;
  const remixMinImages = isRemixTool ? (caps?.minImages ?? 0) : 0;

  const maxImages = isRemixTool
    ? remixMaxImages
    : isImageOnlyTool ? 1 : 3;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > maxImages) {
      toast.error(`الحد الأقصى ${maxImages} صور`);
      return;
    }
    const newImages = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setRefImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload into a specific remix slot
  const handleRemixSlotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const newImg = { file, preview };
    setRefImages((prev) => {
      const updated = [...prev];
      if (remixUploadSlot >= 0 && remixUploadSlot < updated.length) {
        URL.revokeObjectURL(updated[remixUploadSlot].preview);
        updated[remixUploadSlot] = newImg;
      } else {
        updated.push(newImg);
      }
      return updated;
    });
    if (remixSlotInputRef.current) remixSlotInputRef.current.value = "";
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

      const extraParams: Record<string, unknown> = {
        upscale_factor: upscaleFactor,
        duration: videoDuration,
        resolution,
        quality,
      };
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

  const currentRatio = ratioConfig[aspectRatio] || ratioConfig["1:1"];

  const openViewer = (url: string) => {
    setViewerUrl(url);
    setViewerOpen(true);
  };

  // ── Dropdown Button Component ──
  const DropdownBtn = ({ id, label, value, hasValue }: { id: string; label: string; value: string; hasValue: boolean }) => (
    <button
      onClick={() => setOpenMenu(openMenu === id ? null : id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
        hasValue
          ? "bg-primary/10 border-primary/50"
          : "bg-secondary/40 border-primary/25 hover:bg-secondary/60 hover:border-primary/40"
      }`}
    >
      <span className={`text-[11px] font-bold truncate max-w-[100px] ${hasValue ? "text-primary" : "text-foreground"}`}>
        {hasValue ? value : label}
      </span>
      <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${openMenu === id ? "rotate-180" : ""}`} />
    </button>
  );

  // ── Dropdown Menu Component ──
  const DropdownMenu = ({ id, children, minW = "min-w-[100px]" }: { id: string; children: React.ReactNode; minW?: string }) => (
    <AnimatePresence>
      {openMenu === id && (
        <motion.div {...dropdownAnim}
          className={`absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden z-[220] ${minW}`}
        >
          <div className="max-h-64 overflow-y-auto p-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const DropdownItem = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`w-full px-3 py-2 rounded-lg text-right text-xs font-semibold transition-colors ${
        selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"
      }`}
    >{children}</button>
  );

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

    if (!selectedTool) {
      return (
        <motion.div key="no-model" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center gap-2 text-center px-4">
          <Sparkles className="w-7 h-7 text-primary opacity-40" />
          <h2 className="text-sm font-bold text-foreground/70">اختر النموذج</h2>
          <p className="text-[10px] text-muted-foreground/60">اختر نموذج من الأعلى للبدء</p>
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
          {currentRatio.label} {resolution ? `• ${resolution.toUpperCase()}` : ""}
        </span>
      </motion.div>
    );
  };

  // Determine which settings to show based on model capabilities
  const showAspect = !!(selectedTool && caps?.aspectRatios?.length);
  const showDuration = !!(selectedTool && caps?.durations && caps.durations.length > 0);
  const showRes = !!(selectedTool && caps?.resolutions?.length);
  const showQuality = !!(selectedTool && caps?.qualities?.length);
  const showUpscale = !!(selectedTool && caps?.upscaleFactors?.length);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* ── Header / App Bar ── */}
      <header ref={headerRef} className="relative shrink-0 bg-card/90 backdrop-blur-xl border-b border-border/30 z-[120] rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2.5 max-w-3xl mx-auto flex-row-reverse relative">
          {/* Back button - left side visually */}
          <button
            onClick={() => navigate("/")}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all border border-primary/25"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          {/* Settings dropdowns - only show after model is selected */}
          <AnimatePresence>
            {selectedTool && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                {/* Upscale Factor */}
                {showUpscale && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="upscale" label="التكبير" value={`${upscaleFactor}x`} hasValue={!!selectedTool} />
                    <DropdownMenu id="upscale">
                      {caps!.upscaleFactors!.map((f) => (
                        <DropdownItem key={f} selected={upscaleFactor === f} onClick={() => { setUpscaleFactor(f); setOpenMenu(null); }}>
                          {f}x
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>
                )}

                {/* Duration */}
                {showDuration && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="duration" label="المدة" value={`${videoDuration} ثانية`} hasValue={!!selectedTool} />
                    <DropdownMenu id="duration">
                      {caps!.durations!.map((d) => (
                        <DropdownItem key={d} selected={videoDuration === d} onClick={() => { setVideoDuration(d); setOpenMenu(null); }}>
                          {d} ثانية
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>
                )}

                {/* Quality / Mode */}
                {showQuality && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="quality" label="الجودة" value={quality.toUpperCase()} hasValue={!!selectedTool} />
                    <DropdownMenu id="quality">
                      {caps!.qualities!.map((q) => (
                        <DropdownItem key={q} selected={quality === q} onClick={() => { setQuality(q); setOpenMenu(null); }}>
                          {q.toUpperCase()}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>
                )}

                {/* Resolution */}
                {showRes && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="resolution" label="الدقة" value={resolution.toUpperCase()} hasValue={!!selectedTool} />
                    <DropdownMenu id="resolution">
                      {caps!.resolutions!.map((r) => (
                        <DropdownItem key={r} selected={resolution === r} onClick={() => { setResolution(r); setOpenMenu(null); }}>
                          {r.toUpperCase()}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>
                )}

                {/* Aspect Ratio */}
                {showAspect && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="aspect" label="القياس" value={aspectRatio} hasValue={!!selectedTool} />
                    <DropdownMenu id="aspect" minW="min-w-[90px]">
                      {caps!.aspectRatios!.map((r) => (
                        <DropdownItem key={r} selected={aspectRatio === r} onClick={() => { setAspectRatio(r as AspectRatio); setOpenMenu(null); }}>
                          {r}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Model dropdown - always visible */}
          <div className="relative shrink-0">
            <DropdownBtn id="model" label="النموذج" value={selectedTool?.title || ""} hasValue={!!selectedTool} />
            <DropdownMenu id="model" minW="min-w-[200px]">
              {categoryTools.map((t) => (
                <button key={t.id}
                  onClick={() => handleSelectModel(t)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${
                    tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.provider}</p>
                  </div>
                  {t.isPro && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">PRO</span>}
                </button>
              ))}
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Center area ── */}
      <div className="relative z-0 flex-1 flex flex-col items-center justify-center px-4 min-h-0">
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
          {hasFrameMode && selectedTool && (
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
              {frameMode === "first-last" && (
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
              disabled={loading || !selectedTool || (isImageOnlyTool && refImages.length === 0)}
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
