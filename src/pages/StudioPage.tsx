import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tools, buildModelInput, AITool } from "@/data/tools";
import { getModelCapabilities } from "@/data/model-capabilities";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon, Send, X, Sparkles, ChevronDown, Upload, Plus, Music, Video } from "lucide-react";
import { pollTask, uploadFileBase64 } from "@/lib/kie-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "@/components/CircularProgress";
import ImageViewer from "@/components/ImageViewer";
import { usePricing } from "@/hooks/use-pricing";


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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remixSlotInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const avatarImageInputRef = useRef<HTMLInputElement>(null);
  const avatarAudioInputRef = useRef<HTMLInputElement>(null);
  const avatarVideoInputRef = useRef<HTMLInputElement>(null);
  const [remixUploadSlot, setRemixUploadSlot] = useState<number>(-1);

  const { user, credits, refreshCredits } = useAuth();
  const categoryName = category ? categorySlugMap[category] : undefined;

  const categoryTools = useMemo(
    () => tools.filter((t) => t.category === categoryName),
    [categoryName]
  );

  // Pre-select model from query param (e.g. ?model=kling-3)
  useEffect(() => {
    const modelId = searchParams.get("model");
    if (modelId && categoryTools.length > 0) {
      const found = categoryTools.find((t) => t.id === modelId);
      if (found) {
        handleSelectModel(found);
        // Clean the URL
        searchParams.delete("model");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTools]);

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
  // Avatar-specific state
  const [avatarImage, setAvatarImage] = useState<{ file: File; preview: string } | null>(null);
  const [avatarAudio, setAvatarAudio] = useState<{ file: File; name: string } | null>(null);
  const [avatarVideo, setAvatarVideo] = useState<{ file: File; name: string } | null>(null);

  // Dropdown open states
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
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

  // Dynamic pricing based on selected model + options
  const pricingParams = useMemo(() => {
    if (!selectedTool) return null;
    const t = selectedTool;
    return {
      model: t.model,
      resolution: resolution || null,
      quality: quality || null,
      durationSeconds: videoDuration ? parseInt(videoDuration) : null,
      hasAudio: false,
    };
  }, [selectedTool, resolution, quality, videoDuration]);

  const { price } = usePricing(pricingParams);

  // Reset settings when model changes
  const handleSelectModel = (t: AITool) => {
    setSelectedTool(t);
    setOpenMenu(null);
    setResultUrls([]);
    // Reset frames
    if (firstFrame) { URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }
    if (lastFrame) { URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }
    // Reset avatar
    if (avatarImage) { URL.revokeObjectURL(avatarImage.preview); setAvatarImage(null); }
    setAvatarAudio(null);
    setAvatarVideo(null);
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

  const tool = selectedTool || categoryTools[0] || null;
  const isVideoTool = category === "video";
  const isImageOnlyTool = category === "remove-bg" || category === "upscale";
  const isUpscaleTool = category === "upscale";
  const isRemixTool = category === "remix";
  const isAvatarTool = category === "avatar";
  const isAvatarAudioModel = isAvatarTool && !!tool && (tool.inputType === "avatar");
  const isAvatarAnimateModel = isAvatarTool && !!tool && (tool.inputType === "animate");
  const isFluxKontext = !!tool && tool.isFluxKontextApi === true;
  const hasFrameMode = !!(caps?.frameMode || tool?.frameMode);
  const frameMode = caps?.frameMode || tool?.frameMode;

  // Remix image limits from capabilities
  const remixMaxImages = isRemixTool ? (caps?.maxImages ?? 3) : 0;
  const remixMinImages = isRemixTool ? (caps?.minImages ?? 0) : 0;

  if (!categoryName || categoryTools.length === 0 || !tool) {
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

  const estimatedCost = price?.credits ?? 0;
  const insufficientCredits = estimatedCost > 0 && credits < estimatedCost;

  const handleGenerate = async () => {
    if (isImageOnlyTool && refImages.length === 0) {
      toast.error("يجب رفع صورة أولاً");
      return;
    }
    if (isRemixTool && refImages.length === 0 && !prompt.trim()) {
      toast.error("ارفع صورة واحدة على الأقل أو اكتب وصفاً");
      return;
    }
    if (isAvatarAudioModel && (!avatarImage || !avatarAudio)) {
      toast.error("يجب رفع صورة ومقطع صوتي");
      return;
    }
    if (isAvatarAnimateModel && (!avatarImage || !avatarVideo)) {
      toast.error("يجب رفع صورة وفيديو مرجعي");
      return;
    }
    if (!isImageOnlyTool && !isRemixTool && !isAvatarTool && !prompt.trim() && refImages.length === 0 && !firstFrame) {
      toast.error("اكتب وصفاً أو ارفع صورة");
      return;
    }
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }
    if (insufficientCredits || credits <= 0) {
      toast.error(`رصيدك ${credits} كريدت — التكلفة ${estimatedCost} كريدت`);
      navigate("/pricing");
      return;
    }

    setLoading(true);
    setStatus("جاري الإرسال...");
    setProgress(5);
    setResultUrls([]);

    let reservationId: string | null = null;

    try {
      // ── Step 1: Upload files ──
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
        setProgress(20);
      } else if (refImages.length > 0) {
        setStatus("جاري رفع الصور...");
        setProgress(10);
        imageUrls = [];
        for (let i = 0; i < refImages.length; i++) {
          const b64 = await fileToBase64(refImages[i].file);
          const url = await uploadFileBase64(b64, `ref_${Date.now()}_${i}.png`);
          imageUrls.push(url);
          setProgress(10 + ((i + 1) / refImages.length) * 10);
        }
      }

      // Avatar file uploads
      if (isAvatarTool && avatarImage) {
        setStatus("جاري رفع الملفات...");
        setProgress(10);
        const imgB64 = await fileToBase64(avatarImage.file);
        const imgUrl = await uploadFileBase64(imgB64, `avatar_img_${Date.now()}.png`);
        imageUrls = [imgUrl];
        setProgress(18);
      }

      let avatarAudioUrl = "";
      let avatarVideoUrl = "";
      if (isAvatarAudioModel && avatarAudio) {
        const audioB64 = await fileToBase64(avatarAudio.file);
        const ext = avatarAudio.file.name.split(".").pop() || "mp3";
        avatarAudioUrl = await uploadFileBase64(audioB64, `avatar_audio_${Date.now()}.${ext}`);
        setProgress(22);
      }
      if (isAvatarAnimateModel && avatarVideo) {
        const videoB64 = await fileToBase64(avatarVideo.file);
        const ext = avatarVideo.file.name.split(".").pop() || "mp4";
        avatarVideoUrl = await uploadFileBase64(videoB64, `avatar_video_${Date.now()}.${ext}`);
        setProgress(22);
      }

      // ── Step 2: Build model input ──
      const extraParams: Record<string, unknown> = {
        upscale_factor: upscaleFactor,
        duration: videoDuration,
        resolution,
        quality,
        ...(avatarAudioUrl && { audio_url: avatarAudioUrl }),
        ...(avatarVideoUrl && { video_url: avatarVideoUrl }),
        ...(imageUrls?.[0] && isAvatarTool && { image_url: imageUrls[0] }),
      };
      const input = buildModelInput(tool.model, prompt, aspectRatio, resolution, imageUrls, extraParams);
      const apiType = isFluxKontext ? "flux-kontext" : (tool.isVeoApi ? "veo" : "standard");

      // ── Step 3: Start generation (server: auth → entitlement → price → reserve → create task) ──
      setStatus("جاري التحقق والإنشاء...");
      setProgress(25);

      const idempotencyKey = `gen_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const { data: startResult, error: startError } = await supabase.functions.invoke("start-generation", {
        body: {
          toolId: tool.id,
          model: tool.model,
          apiType,
          input,
          resolution: resolution || null,
          quality: quality || null,
          durationSeconds: videoDuration ? parseInt(videoDuration) : null,
          hasAudio: false,
          idempotencyKey,
        },
      });

      if (startError) throw new Error(startError.message);
      if (!startResult?.success) {
        const err = startResult?.error;
        if (err === "insufficient_credits") {
          toast.error(`رصيدك ${startResult.balance} كريدت — المطلوب ${startResult.required} كريدت`);
          navigate("/pricing");
          return;
        }
        if (err === "entitlement_denied") {
          const details = startResult.details;
          if (details?.reason === "plan_upgrade_required") {
            toast.error(`هذا النموذج يتطلب خطة ${details.required_plan} أو أعلى`);
          } else if (details?.reason === "daily_limit_reached") {
            toast.error(`وصلت للحد اليومي (${details.limit} توليدة)`);
          } else if (details?.reason === "duration_exceeded") {
            toast.error(`المدة تتجاوز الحد الأقصى لخطتك (${details.max_duration}ث)`);
          } else {
            toast.error("ليس لديك صلاحية لاستخدام هذا النموذج");
          }
          return;
        }
        throw new Error(startResult?.message || err || "فشل بدء التوليد");
      }

      reservationId = startResult.reservationId;
      const taskId = startResult.taskId;

      // ── Step 4: Poll task status ──
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

        // ── Step 5: Complete generation (server: settle + save) ──
        const fileUrl = parsed.resultUrls?.[0];
        const { data: completeResult, error: completeError } = await supabase.functions.invoke("complete-generation", {
          body: {
            reservationId,
            status: "success",
            taskId,
            toolId: tool.id,
            toolName: tool.title,
            prompt,
            fileUrl: fileUrl || "",
            fileType: (isVideoTool || isAvatarTool) ? "video" : "image",
            metadata: { aspectRatio, resolution, model: tool.model },
          },
        });
        if (completeError || !completeResult?.success) {
          console.error("Settlement failed:", completeError || completeResult);
          toast.error("تم التوليد لكن فشل تأكيد الخصم — سيتم المراجعة تلقائياً");
        } else {
          reservationId = null;
        }
        await refreshCredits();
      } else {
        throw new Error("لم يتم إرجاع نتيجة من التوليد");
      }
    } catch (err: unknown) {
      // ── Release reserved credits on failure ──
      if (reservationId) {
        try {
          await supabase.functions.invoke("complete-generation", {
            body: { reservationId, status: "failed" },
          });
        } catch (releaseErr) {
          console.error("Failed to release credits:", releaseErr);
        }
      }
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
      setStatus("");
      setProgress(0);
      await refreshCredits();
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
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all duration-200 ${
        hasValue
          ? "bg-primary/10 border-primary/50"
          : "bg-secondary/40 border-primary/25 hover:bg-secondary/60 hover:border-primary/40"
      }`}
    >
      <span className={`text-xs font-bold truncate max-w-[110px] ${hasValue ? "text-primary" : "text-foreground"}`}>
        {hasValue ? value : label}
      </span>
      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${openMenu === id ? "rotate-180" : ""}`} />
    </button>
  );

  // ── Dropdown Menu Component ──
  const DropdownMenu = ({ id, children, minW = "min-w-[120px]" }: { id: string; children: React.ReactNode; minW?: string }) => (
    <AnimatePresence>
      {openMenu === id && (
        <motion.div {...dropdownAnim}
          className={`absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden z-[220] ${minW}`}
        >
          <div className="max-h-72 overflow-y-auto p-1.5">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const DropdownItem = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`w-full px-3.5 py-2.5 rounded-lg text-right text-sm font-semibold transition-colors ${
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
            className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
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
            <DropdownMenu id="model" minW="min-w-[220px]">
              {(() => {
                // Group tools by provider
                const groups: { provider: string; tools: AITool[] }[] = [];
                categoryTools.forEach((t) => {
                  const existing = groups.find((g) => g.provider === t.provider);
                  if (existing) existing.tools.push(t);
                  else groups.push({ provider: t.provider, tools: [t] });
                });

                return groups.map((group) => {
                  // Single model provider - show directly
                  if (group.tools.length === 1) {
                    const t = group.tools[0];
                    return (
                      <button key={t.id}
                        onClick={() => handleSelectModel(t)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${
                          tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                        </div>
                        {t.isPro && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">PRO</span>}
                      </button>
                    );
                  }

                  // Multi-model provider - collapsible group
                  const isExpanded = expandedProvider === group.provider;
                  const hasSelectedInGroup = group.tools.some((t) => tool.id === t.id);
                  return (
                    <div key={group.provider}>
                      <button
                        onClick={() => setExpandedProvider(isExpanded ? null : group.provider)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right transition-colors ${
                          hasSelectedInGroup ? "bg-primary/5" : "hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${hasSelectedInGroup ? "text-primary" : "text-foreground"}`}>{group.provider}</p>
                          <p className="text-[10px] text-muted-foreground">{group.tools.length} نماذج</p>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pr-3 border-r border-primary/15 mr-3 mt-0.5 mb-1 space-y-0.5">
                              {group.tools.map((t) => (
                                <button key={t.id}
                                  onClick={() => handleSelectModel(t)}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-right transition-colors ${
                                    tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/50"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                                  </div>
                                  {t.isPro && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">PRO</span>}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                });
              })()}
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
          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple={!isImageOnlyTool} className="hidden" onChange={handleImageUpload} />
          <input ref={remixSlotInputRef} type="file" accept="image/*" className="hidden" onChange={handleRemixSlotUpload} />
          <input ref={firstFrameInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFrameUpload("first", e)} />
          <input ref={lastFrameInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFrameUpload("last", e)} />
          <input ref={avatarImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (avatarImage) URL.revokeObjectURL(avatarImage.preview);
            setAvatarImage({ file, preview: URL.createObjectURL(file) });
            if (avatarImageInputRef.current) avatarImageInputRef.current.value = "";
          }} />
          <input ref={avatarAudioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAvatarAudio({ file, name: file.name });
            if (avatarAudioInputRef.current) avatarAudioInputRef.current.value = "";
          }} />
          <input ref={avatarVideoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAvatarVideo({ file, name: file.name });
            if (avatarVideoInputRef.current) avatarVideoInputRef.current.value = "";
          }} />

          {/* Frame upload boxes for first/last frame video models */}
          {hasFrameMode && selectedTool && (
            <div className="flex gap-2">
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
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">First Frame</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-2">
                    <Upload className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-[9px] font-semibold text-muted-foreground/70">First Frame</span>
                  </div>
                )}
              </button>
              {frameMode === "first-last" && (
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
                      <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">Last Frame</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 py-2">
                      <Upload className="w-4 h-4 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground/70">Last Frame</span>
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── Remix image strip (like frame boxes) ── */}
          {isRemixTool && selectedTool && !hasFrameMode && (
            <div className="flex gap-2">
              {/* Slot 1: الصورة الأساسية - always visible */}
              <button
                onClick={() => { setRemixUploadSlot(0); remixSlotInputRef.current?.click(); }}
                className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                  refImages[0] ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                {refImages[0] ? (
                  <div className="relative w-full h-14">
                    <img src={refImages[0].preview} alt="صورة 1" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(0); }}
                      className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-destructive-foreground" />
                    </button>
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">صورة 1</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-2">
                    <Upload className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-[9px] font-semibold text-muted-foreground/70">صورة 1</span>
                  </div>
                )}
              </button>

              {/* Slot 2: visible if maxImages >= 2 */}
              {remixMaxImages >= 2 && (
                <button
                  onClick={() => { setRemixUploadSlot(1); remixSlotInputRef.current?.click(); }}
                  className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                    refImages[1] ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                  }`}
                  style={{ minHeight: "56px" }}
                >
                  {refImages[1] ? (
                    <div className="relative w-full h-14">
                      <img src={refImages[1].preview} alt="صورة 2" className="w-full h-full object-cover rounded-lg" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(1); }}
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5 text-destructive-foreground" />
                      </button>
                      <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">صورة 2</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 py-2">
                      <Upload className="w-4 h-4 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground/70">صورة 2</span>
                    </div>
                  )}
                </button>
              )}

              {/* + button for more images if model supports > 2 */}
              {remixMaxImages > 2 && refImages.length >= 2 && refImages.length < remixMaxImages && (
                <button
                  onClick={() => { setRemixUploadSlot(refImages.length); remixSlotInputRef.current?.click(); }}
                  className="w-14 shrink-0 rounded-xl border-2 border-dashed border-border/40 bg-secondary/30 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-1"
                  style={{ minHeight: "56px" }}
                >
                  <Plus className="w-4 h-4 text-muted-foreground/60" />
                  <span className="text-[8px] text-muted-foreground/60">{refImages.length}/{remixMaxImages}</span>
                </button>
              )}
            </div>
          )}

          {/* ── Avatar upload strip ── */}
          {isAvatarTool && selectedTool && (
            <div className="flex gap-2">
              {/* Image slot */}
              <button
                onClick={() => avatarImageInputRef.current?.click()}
                className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                  avatarImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                {avatarImage ? (
                  <div className="relative w-full h-14">
                    <img src={avatarImage.preview} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={(e) => { e.stopPropagation(); URL.revokeObjectURL(avatarImage.preview); setAvatarImage(null); }}
                      className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-destructive-foreground" />
                    </button>
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-background/80 text-foreground px-1.5 py-0.5 rounded">صورة</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-2">
                    <Upload className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-[9px] font-semibold text-muted-foreground/70">صورة</span>
                  </div>
                )}
              </button>

              {/* Audio slot (for avatar models) */}
              {isAvatarAudioModel && (
                <button
                  onClick={() => avatarAudioInputRef.current?.click()}
                  className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                    avatarAudio ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                  }`}
                  style={{ minHeight: "56px" }}
                >
                  {avatarAudio ? (
                    <div className="relative w-full h-14 flex flex-col items-center justify-center gap-1">
                      <Music className="w-4 h-4 text-primary" />
                      <span className="text-[8px] font-bold text-foreground truncate max-w-[80%] px-1">{avatarAudio.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAvatarAudio(null); }}
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5 text-destructive-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 py-2">
                      <Music className="w-4 h-4 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground/70">مقطع صوتي</span>
                    </div>
                  )}
                </button>
              )}

              {/* Video slot (for animate models like Wan Animate) */}
              {isAvatarAnimateModel && (
                <button
                  onClick={() => avatarVideoInputRef.current?.click()}
                  className={`flex-1 relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                    avatarVideo ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                  }`}
                  style={{ minHeight: "56px" }}
                >
                  {avatarVideo ? (
                    <div className="relative w-full h-14 flex flex-col items-center justify-center gap-1">
                      <Video className="w-4 h-4 text-primary" />
                      <span className="text-[8px] font-bold text-foreground truncate max-w-[80%] px-1">{avatarVideo.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAvatarVideo(null); }}
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5 text-destructive-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 py-2">
                      <Video className="w-4 h-4 text-muted-foreground/60" />
                      <span className="text-[9px] font-semibold text-muted-foreground/70">فيديو مرجعي</span>
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Regular image uploads strip (non-remix, non-frame, non-avatar) */}
          {!hasFrameMode && !isRemixTool && !isAvatarTool && refImages.length > 0 && (
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
            {/* Upload button (only for models that support image input via maxImages in capabilities) */}
            {!hasFrameMode && !isRemixTool && !isAvatarTool && !isImageOnlyTool && (caps?.maxImages ?? 0) > 0 && refImages.length < (caps?.maxImages ?? 0) && (
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
                placeholder={isAvatarTool ? "وصف اختياري للأداء..." : isRemixTool ? "صف التعديل المطلوب..." : "اكتب وصفاً لما تريد توليده..."}
                className="flex-1 h-9 rounded-lg bg-secondary/40 border border-border/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
              />
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || !selectedTool || insufficientCredits || (isImageOnlyTool && refImages.length === 0) || (isAvatarAudioModel && (!avatarImage || !avatarAudio)) || (isAvatarAnimateModel && (!avatarImage || !avatarVideo))}
              className="shrink-0 rounded-xl gap-2 px-4 h-10 text-xs font-bold shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              {estimatedCost > 0 && (
                <span className="text-[11px] font-bold">{estimatedCost}</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <ImageViewer src={viewerUrl} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  );
};

export default StudioPage;
