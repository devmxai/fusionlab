import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tools, buildModelInput, AITool } from "@/data/tools";
import { getModelCapabilities } from "@/data/model-capabilities";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon, X, Sparkles, ChevronDown, Upload, Plus, Music, Video, Lock, Play, Pause, FolderOpen, SlidersHorizontal } from "lucide-react";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import { uploadFileBase64 } from "@/lib/kie-ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueue } from "@/contexts/GenerationQueueContext";
import type { GenerationJob } from "@/hooks/use-generation-queue";
import { usePlanGating } from "@/hooks/use-plan-gating";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "@/components/CircularProgress";
import ImageViewer from "@/components/ImageViewer";
import { usePricing } from "@/hooks/use-pricing";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import CropDialog from "@/components/studio/CropDialog";
import { Textarea } from "@/components/ui/textarea";

type AspectRatio = "auto" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
type Resolution = string;
type UpscaleFactor = string;
type Quality = string;

const categorySlugMap: Record<string, string> = {
  images: "صور",
  video: "فيديو",
  remix: "ريمكس",
  audio: "صوت",
  avatar: "افتار",
  transfer: "ترانسفير",
  "remove-bg": "حذف الخلفية",
  upscale: "رفع الجودة",
  shoots: "شوتس",
};

const categoryTitleMap: Record<string, string> = {
  images: "استديو الصور",
  video: "استديو الفيديو",
  remix: "استديو الريمكس",
  audio: "استديو الصوت",
  avatar: "استديو الأفتار",
  transfer: "استديو الترانسفير",
  "remove-bg": "حذف الخلفية",
  upscale: "رفع الجودة",
  shoots: "شوتس",
};

const ratioConfig: Record<string, { label: string; cssAspect: string; placeholderMaxW: string }> = {
  "auto": { label: "تلقائي",  cssAspect: "1/1",  placeholderMaxW: "min(92vw, 560px)" },
  "1:1":  { label: "1:1",   cssAspect: "1/1",  placeholderMaxW: "min(92vw, 560px)" },
  "3:4":  { label: "3:4",   cssAspect: "3/4",  placeholderMaxW: "min(88vw, 480px)" },
  "4:3":  { label: "4:3",   cssAspect: "4/3",  placeholderMaxW: "min(94vw, 680px)" },
  "9:16": { label: "9:16",  cssAspect: "9/16", placeholderMaxW: "min(70vw, 400px)" },
  "16:9": { label: "16:9",  cssAspect: "16/9", placeholderMaxW: "min(96vw, 780px)" },
  "21:9": { label: "21:9",  cssAspect: "21/9", placeholderMaxW: "min(96vw, 820px)" },
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
  const grokRefInputRef = useRef<HTMLInputElement>(null);
  const [remixUploadSlot, setRemixUploadSlot] = useState<number>(-1);

  const { user, credits, refreshCredits } = useAuth();
  const { pollJob, fetchJobs } = useQueue();
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
  const [resultNaturalRatio, setResultNaturalRatio] = useState<string | null>(null);

  type AvatarImageValue = { preview: string; file?: File; sourceUrl?: string };
  type AvatarAudioValue = { name: string; file?: File; sourceUrl?: string; previewUrl?: string };

  // Avatar-specific state
  const [avatarImage, setAvatarImage] = useState<AvatarImageValue | null>(null);
  const [avatarAudio, setAvatarAudio] = useState<AvatarAudioValue | null>(null);
  const [avatarVideo, setAvatarVideo] = useState<{ file: File; name: string } | null>(null);
  const [mediaDurationSeconds, setMediaDurationSeconds] = useState<number | null>(null);
  const avatarAudioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [isAvatarAudioPlaying, setIsAvatarAudioPlaying] = useState(false);

  // Dropdown open states
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modelSubPage, setModelSubPage] = useState<string | null>(null);
  // Media picker state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [cropState, setCropState] = useState<{ imageSrc: string; file: File; type: "first" | "last" | "ref"; refIndex?: number } | null>(null);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);

  const bottomBarRef = useRef<HTMLDivElement>(null);

  const stopAvatarAudioPreview = () => {
    if (avatarAudioPreviewRef.current) {
      avatarAudioPreviewRef.current.pause();
      avatarAudioPreviewRef.current.currentTime = 0;
    }
    setIsAvatarAudioPlaying(false);
  };

  const detectAudioDuration = (audioSrc: string): Promise<number | null> =>
    new Promise((resolve) => {
      const audioEl = document.createElement("audio");
      let settled = false;
      let timeoutId: number | null = null;

      const finalize = (duration: number | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        audioEl.removeAttribute("src");
        audioEl.load();
        resolve(duration);
      };

      audioEl.preload = "metadata";
      audioEl.addEventListener("loadedmetadata", () => {
        const d = Number(audioEl.duration);
        finalize(Number.isFinite(d) && d > 0 ? d : null);
      });
      audioEl.addEventListener("error", () => finalize(null));
      timeoutId = window.setTimeout(() => finalize(null), 10000);
      audioEl.src = audioSrc;
      audioEl.load();
    });

  const applyAvatarAudioFromSource = async (sourceUrl: string, name: string) => {
    stopAvatarAudioPreview();
    if (avatarAudio?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarAudio.previewUrl);
    }

    let previewUrl = sourceUrl;
    let localFile: File | undefined;

    try {
      const res = await fetch(sourceUrl);
      const blob = await res.blob();
      const inferredType = blob.type || "audio/mpeg";
      localFile = new File([blob], name || "audio.mp3", { type: inferredType });
      previewUrl = URL.createObjectURL(blob);
    } catch {
      previewUrl = sourceUrl;
    }

    setAvatarAudio({
      name: name || "audio.mp3",
      sourceUrl,
      previewUrl,
      ...(localFile ? { file: localFile } : {}),
    });

    const duration = await detectAudioDuration(previewUrl);
    if (duration !== null) {
      setMediaDurationSeconds(duration);
      return;
    }

    setMediaDurationSeconds(null);
    toast.error("تعذر قراءة مدة الملف الصوتي — اختر ملفًا آخر");
  };

  const toggleAvatarAudioPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audioEl = avatarAudioPreviewRef.current;
    if (!audioEl || !audioEl.src) return;

    try {
      if (audioEl.paused) {
        await audioEl.play();
      } else {
        audioEl.pause();
      }
    } catch {
      setIsAvatarAudioPlaying(false);
      toast.error("تعذر تشغيل المعاينة الصوتية");
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inHeader = headerRef.current?.contains(target);
      const inBottomBar = bottomBarRef.current?.contains(target);
      // Don't interfere with portalized popover/drawer clicks (they live outside headerRef)
      const inPortal = (target as Element)?.closest?.("[data-radix-popper-content-wrapper], [vaul-drawer]");
      if (!inHeader && !inBottomBar && !inPortal) {
        setOpenMenu(null);
        // Don't reset modelSubPage here — it's managed by the Popover/Drawer onOpenChange
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Pick up audio from Audio Studio via sessionStorage
  useEffect(() => {
    if (category !== "avatar") return;
    const audioUrl = sessionStorage.getItem("avatar-audio-url");
    const audioName = sessionStorage.getItem("avatar-audio-name");
    if (!audioUrl) return;
    sessionStorage.removeItem("avatar-audio-url");
    sessionStorage.removeItem("avatar-audio-name");

    (async () => {
      try {
        await applyAvatarAudioFromSource(audioUrl, audioName || "audio.mp3");
      } catch {
        toast.error("تعذر إدراج الصوت من الاستوديو");
      }
    })();
  }, [category]);

  useEffect(() => {
    return () => {
      stopAvatarAudioPreview();
    };
  }, []);

  const caps = useMemo(() => {
    if (!selectedTool) return null;
    return getModelCapabilities(selectedTool.model);
  }, [selectedTool]);

  // For avatar models, use actual media duration (audio/video); for video models, use dropdown
  const effectiveDurationSeconds = useMemo(() => {
    const isAvatar = !!selectedTool && (selectedTool.inputType === "avatar" || selectedTool.inputType === "animate");
    if (isAvatar && mediaDurationSeconds !== null) {
      const rounded = Math.round(mediaDurationSeconds);
      // Infinitalk max 15s per KIE.AI docs
      if (selectedTool?.model === "infinitalk/from-audio" && rounded > 15) return 15;
      // Kling avatar: no audio duration limit (provider supports longer durations)
      return rounded;
    }
    // For avatar models without detected duration, return null (prevent fallback to videoDuration)
    if (isAvatar) return null;
    return videoDuration ? parseInt(videoDuration) : null;
  }, [selectedTool, mediaDurationSeconds, videoDuration]);

  // Whether media duration exceeds the limit
  const mediaDurationExceedsLimit = useMemo(() => {
    if (!selectedTool || selectedTool.model !== "infinitalk/from-audio") return false;
    if (mediaDurationSeconds === null) return false;
    return Math.round(mediaDurationSeconds) > 15;
  }, [selectedTool, mediaDurationSeconds]);

  // Determine hasAudio correctly for avatar models
  const hasAudioForPricing = useMemo(() => {
    if (!selectedTool) return false;
    return selectedTool.inputType === "avatar"; // avatar models use audio input
  }, [selectedTool]);

  // For Kling Avatar: resolution maps to different API models
  // kling/ai-avatar-standard + 720p → model stays kling/ai-avatar-standard
  // kling/ai-avatar-standard + 1080p → model becomes kling/ai-avatar-pro (for pricing & API)
  const effectiveAvatarModel = useMemo((): string | null => {
    if (!selectedTool) return null;
    if (selectedTool.model === "kling/ai-avatar-standard" && resolution === "1080p") {
      return "kling/ai-avatar-pro";
    }
    return selectedTool.model;
  }, [selectedTool, resolution]);

  // Get the correct resolution for avatar pricing
  const avatarPricingResolution = useMemo((): string | null => {
    if (!selectedTool) return null;
    if (selectedTool.model === "kling/ai-avatar-standard") return resolution;
    if (selectedTool.model === "infinitalk/from-audio") return resolution;
    if (selectedTool.model === "wan/2-2-animate-move") return resolution;
    if (selectedTool.model === "wan/2-2-animate-replace") return resolution;
    if (selectedTool.model === "kling-3.0/motion-control") return resolution;
    if (selectedTool.model === "kling-2.6/motion-control") return resolution;
    return null;
  }, [selectedTool, resolution]);

  // Dynamic pricing based on selected model + options
  const pricingParams = useMemo(() => {
    if (!selectedTool) return null;
    const isAvatar = selectedTool.inputType === "avatar" || selectedTool.inputType === "animate";
    const modelForPricing = isAvatar ? (effectiveAvatarModel || selectedTool.model) : selectedTool.model;

    return {
      model: modelForPricing,
      resolution: isAvatar ? avatarPricingResolution : (resolution || null),
      quality: quality || null,
      durationSeconds: effectiveDurationSeconds,
      hasAudio: hasAudioForPricing,
    };
  }, [selectedTool, resolution, quality, effectiveDurationSeconds, hasAudioForPricing, avatarPricingResolution, effectiveAvatarModel]);

  const { price } = usePricing(pricingParams);
  const { checkAccess } = usePlanGating(selectedTool?.model || null);

  // Reset settings when model changes
  const handleSelectModel = (t: AITool) => {
    setSelectedTool(t);
    setOpenMenu(null);
    setResultUrls([]);
    setResultNaturalRatio(null);
    // Reset frames
    if (firstFrame) { URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }
    if (lastFrame) { URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }
    // Reset avatar
    if (avatarImage?.preview?.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview);
    if (avatarAudio?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarAudio.previewUrl);
    stopAvatarAudioPreview();
    setAvatarImage(null);
    setAvatarAudio(null);
    setAvatarVideo(null);
    setMediaDurationSeconds(null);
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
    if (t.model.startsWith("grok-imagine/")) {
      setQuality("normal");
    } else if (c.qualities?.length) {
      setQuality(c.qualities[0]);
    }
  };

  // Pre-select model from query param only (no auto-select fallback)
  useEffect(() => {
    if (categoryTools.length === 0) return;

    const modelId = searchParams.get("model");
    if (modelId) {
      const found = categoryTools.find((t) => t.id === modelId);
      if (found) {
        if (!selectedTool || selectedTool.id !== found.id) {
          handleSelectModel(found);
        }
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("model");
        setSearchParams(nextParams, { replace: true });
        return;
      }
    }

    // If selected tool is not in current category, clear selection
    if (selectedTool && !categoryTools.some((t) => t.id === selectedTool.id)) {
      setSelectedTool(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTools, selectedTool, searchParams, setSearchParams]);

  const tool = selectedTool;
  const isVideoTool = category === "video";
  const isImageOnlyTool = category === "remove-bg" || category === "upscale";
  const isUpscaleTool = category === "upscale";
  const isRemixTool = category === "remix";
  const isAvatarTool = category === "avatar" || category === "transfer";
  const isShootsTool = category === "shoots";
  const isAvatarAudioModel = (category === "avatar") && !!tool && (tool.inputType === "avatar");
  const isAvatarAnimateModel = isAvatarTool && !!tool && (tool.inputType === "animate");
  const isFluxKontext = !!tool && tool.isFluxKontextApi === true;
  const hasFrameMode = !!(caps?.frameMode || tool?.frameMode);
  const frameMode = caps?.frameMode || tool?.frameMode;
  const isGrokImage = !!tool && tool.model === "grok-imagine/text-to-image" && !isShootsTool;

  // Remix image limits from capabilities
  const remixMaxImages = isRemixTool ? (caps?.maxImages ?? 3) : 0;
  const remixMinImages = isRemixTool ? (caps?.minImages ?? 0) : 0;

  // Showcase: animated cycling text per category
  const showcaseTexts: Record<string, string[]> = {
    transfer: ["نقل الحركة من فيديو إلى صورة", "استبدال الشخصية في الفيديو", "تحريك صورة ثابتة بحركة واقعية", "دمج ملامح جديدة بسلاسة"],
    images: ["توليد صور بالذكاء الاصطناعي", "تصميم شخصيات واقعية", "إنشاء مشاهد خيالية", "أسلوب فني فريد بكل مرة"],
    video: ["توليد فيديو من النص", "تحويل الأفكار لمقاطع متحركة", "مؤثرات بصرية سينمائية", "حركة طبيعية وسلسة"],
    remix: ["تعديل الصور بالذكاء الاصطناعي", "دمج صورتين في واحدة", "تغيير الأسلوب الفني", "تحرير احترافي بنقرة"],
    avatar: ["تحريك صورة بالصوت", "إنشاء أفتار متحدث", "دمج الصوت مع الوجه", "شخصية رقمية نابضة بالحياة"],
  };
  const currentShowcaseTexts = showcaseTexts[category || ""] || [];
  const [showcaseTextIdx, setShowcaseTextIdx] = useState(0);
  useEffect(() => {
    if (!currentShowcaseTexts.length) return;
    const interval = setInterval(() => setShowcaseTextIdx((p) => (p + 1) % currentShowcaseTexts.length), 8500);
    return () => clearInterval(interval);
  }, [category, currentShowcaseTexts.length]);

  const ShowcaseText = () => (
    <div className="min-h-[30px] flex items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={showcaseTextIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="text-sm font-bold text-primary/80 text-center leading-relaxed"
        >
          {currentShowcaseTexts[showcaseTextIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );

  if (isShootsTool) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4" dir="rtl">
        <Sparkles className="w-12 h-12 text-primary opacity-50" />
        <h1 className="text-2xl font-bold text-primary">Coming Soon</h1>
        <p className="text-sm text-muted-foreground">قسم الشوتس قيد التطوير — ترقبوا التحديث القادم</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>العودة</Button>
      </div>
    );
  }

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

  const maxImages = isRemixTool
    ? remixMaxImages
    : (isImageOnlyTool || isShootsTool) ? 1 : (caps?.maxImages ?? 3);

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

  const cropAspectNumeric = (() => {
    if (aspectRatio === "auto") return 1; // fallback, won't be used since auto skips crop
    const [w, h] = aspectRatio.split(":").map(Number);
    return w / h;
  })();

  // Track previous aspect ratio for re-crop suggestion
  const prevAspectRatioRef = useRef(aspectRatio);
  useEffect(() => {
    const prev = prevAspectRatioRef.current;
    prevAspectRatioRef.current = aspectRatio;
    if (prev === aspectRatio) return;
    if (aspectRatio === "auto") return;
    const hasFrames = !!(firstFrame || lastFrame);
    const hasRefs = refImages.length > 0;
    if (hasFrames || hasRefs) {
      toast.info("تم تغيير القياس — اضغط على الصورة لإعادة القص بالقياس الجديد", { duration: 5000 });
    }
  }, [aspectRatio, firstFrame, lastFrame, refImages.length]);

  const handleFrameUpload = async (type: "first" | "last", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);

    if (aspectRatio === "auto") {
      // Auto mode: use image as-is without cropping
      if (type === "first") {
        if (firstFrame) URL.revokeObjectURL(firstFrame.preview);
        setFirstFrame({ file, preview });
      } else {
        if (lastFrame) URL.revokeObjectURL(lastFrame.preview);
        setLastFrame({ file, preview });
      }
    } else {
      // Open crop dialog to let user adjust framing
      setCropState({ imageSrc: preview, file, type });
    }

    if (type === "first" && firstFrameInputRef.current) firstFrameInputRef.current.value = "";
    if (type === "last" && lastFrameInputRef.current) lastFrameInputRef.current.value = "";
  };

  const handleGrokRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);

    if (aspectRatio === "auto") {
      // Auto mode: use image as-is
      setRefImages(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          URL.revokeObjectURL(updated[0].preview);
          updated[0] = { file, preview };
        } else {
          updated.push({ file, preview });
        }
        return updated;
      });
    } else {
      setCropState({ imageSrc: preview, file, type: "ref", refIndex: 0 });
    }

    if (grokRefInputRef.current) grokRefInputRef.current.value = "";
  };

  const handleCropConfirm = useCallback((blob: Blob) => {
    if (!cropState) return;
    const file = new File([blob], cropState.file.name, { type: "image/png" });
    const preview = URL.createObjectURL(blob);
    if (cropState.type === "first") {
      if (firstFrame) URL.revokeObjectURL(firstFrame.preview);
      setFirstFrame({ file, preview });
    } else if (cropState.type === "last") {
      if (lastFrame) URL.revokeObjectURL(lastFrame.preview);
      setLastFrame({ file, preview });
    } else if (cropState.type === "ref") {
      setRefImages(prev => {
        const updated = [...prev];
        const idx = cropState.refIndex ?? 0;
        if (idx < updated.length) {
          URL.revokeObjectURL(updated[idx].preview);
          updated[idx] = { file, preview };
        } else {
          updated.push({ file, preview });
        }
        return updated;
      });
    }
    URL.revokeObjectURL(cropState.imageSrc);
    setCropState(null);
  }, [cropState, firstFrame, lastFrame]);

  const handleCropCancel = useCallback(() => {
    if (cropState) URL.revokeObjectURL(cropState.imageSrc);
    setCropState(null);
  }, [cropState]);

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

  // Upload large files (videos) directly to Supabase Storage, returning a public URL
  const uploadViaStorage = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user!.id}/${prefix}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("temp-uploads")
      .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
    if (uploadError) throw new Error("فشل رفع الملف: " + uploadError.message);
    const { data: urlData } = supabase.storage.from("temp-uploads").getPublicUrl(path);
    if (!urlData?.publicUrl) throw new Error("تعذر الحصول على رابط الملف");
    return urlData.publicUrl;
  };

  // Smart upload: use Storage for large files (>3MB), base64 for smaller ones
  const smartUploadFile = async (file: File, prefix: string): Promise<string> => {
    const THREE_MB = 3 * 1024 * 1024;
    if (file.size > THREE_MB) {
      console.log(`Using Storage upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return uploadViaStorage(file, prefix);
    }
    const b64 = await fileToBase64(file);
    const ext = file.name.split(".").pop() || "bin";
    return uploadFileBase64(b64, `${prefix}_${Date.now()}.${ext}`);
  };

  const estimatedCost = price?.credits ?? 0;
  const insufficientCredits = estimatedCost > 0 && credits < estimatedCost;

  const handleGenerate = async () => {
    if (!tool) return;
    if (isImageOnlyTool && refImages.length === 0) {
      toast.error("يجب رفع صورة أولاً");
      return;
    }
    if (isShootsTool && refImages.length === 0 && !prompt.trim()) {
      toast.error("اكتب وصفاً أو ارفع صورة");
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
    if (isAvatarAudioModel && mediaDurationSeconds === null) {
      toast.error("لم يتم استخراج مدة الملف الصوتي — يرجى إعادة رفعه");
      return;
    }
    if (isAvatarAnimateModel && (!avatarImage || !avatarVideo)) {
      toast.error("يجب رفع صورة وفيديو مرجعي");
      return;
    }
    if (isAvatarAnimateModel && mediaDurationSeconds === null) {
      toast.error("لم يتم استخراج مدة الفيديو — يرجى إعادة رفعه");
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
    setStatus("جاري التحضير...");
    setProgress(1);
    setResultUrls([]);
    setResultNaturalRatio(null);

    let reservationId: string | null = null;

    try {
      // ── Step 1: Upload files ──
      let imageUrls: string[] | undefined;

      if (hasFrameMode && (firstFrame || lastFrame)) {
        setStatus("جاري رفع الصور...");
        setProgress(3);
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
        setProgress(9);
      } else if (refImages.length > 0) {
        setStatus("جاري رفع الصور...");
        setProgress(3);
        imageUrls = [];
        for (let i = 0; i < refImages.length; i++) {
          const b64 = await fileToBase64(refImages[i].file);
          const url = await uploadFileBase64(b64, `ref_${Date.now()}_${i}.png`);
          imageUrls.push(url);
          setProgress(3 + ((i + 1) / refImages.length) * 6);
        }
      }

      // Avatar file uploads
      if (isAvatarTool && avatarImage) {
        setStatus("جاري رفع الملفات...");
        setProgress(3);

        if (avatarImage.file) {
          const imgB64 = await fileToBase64(avatarImage.file);
          const imgUrl = await uploadFileBase64(imgB64, `avatar_img_${Date.now()}.png`);
          imageUrls = [imgUrl];
        } else if (avatarImage.sourceUrl) {
          imageUrls = [avatarImage.sourceUrl];
        } else {
          throw new Error("تعذر قراءة الصورة المحددة");
        }

        setProgress(8);
      }

      let avatarAudioUrl = "";
      let avatarVideoUrl = "";
      if (isAvatarAudioModel && avatarAudio) {
        if (avatarAudio.file) {
          const audioB64 = await fileToBase64(avatarAudio.file);
          const ext = avatarAudio.file.name.split(".").pop() || "mp3";
          avatarAudioUrl = await uploadFileBase64(audioB64, `avatar_audio_${Date.now()}.${ext}`);
        } else if (avatarAudio.sourceUrl) {
          avatarAudioUrl = avatarAudio.sourceUrl;
        } else {
          throw new Error("تعذر قراءة الملف الصوتي المحدد");
        }
        setProgress(10);
      }
      if (isAvatarAnimateModel && avatarVideo) {
        setStatus("جاري رفع الفيديو...");
        avatarVideoUrl = await smartUploadFile(avatarVideo.file, "avatar_video");
        setProgress(10);
      }

      // ── Step 2: Build model input ──
      // For Kling Avatar: use the effective model (pro when 1080p selected)
      // For Grok Video: switch to image-to-video model when images are provided
      let apiModel = isAvatarTool ? (effectiveAvatarModel || tool.model) : tool.model;
      if (tool.model === "grok-imagine/text-to-video" && imageUrls?.length) {
        apiModel = "grok-imagine/image-to-video";
      }
      const extraParams: Record<string, unknown> = {
        upscale_factor: upscaleFactor,
        duration: videoDuration,
        resolution,
        quality,
        ...(avatarAudioUrl && { audio_url: avatarAudioUrl }),
        ...(avatarVideoUrl && { video_url: avatarVideoUrl }),
        ...(imageUrls?.[0] && isAvatarTool && { image_url: imageUrls[0] }),
      };
      const apiAspectRatio = aspectRatio === "auto" ? "1:1" : aspectRatio;
      const input = buildModelInput(apiModel, prompt, apiAspectRatio, resolution, imageUrls, extraParams);
      const apiType = isFluxKontext ? "flux-kontext" : (tool.isVeoApi ? "veo" : "standard");

      // ── Step 3: Start generation (server: auth → entitlement → price → reserve → create task + job record) ──
      setStatus("جاري التحقق والإنشاء...");
      setProgress((prev) => Math.max(prev, 12));

      const idempotencyKey = `gen_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileType = (isVideoTool || isAvatarTool) ? "video" : "image";

      // Use avatar-specific resolution and model for server
      const serverResolution = isAvatarTool ? avatarPricingResolution : (resolution || null);

      const { data: startResult, error: startError } = await supabase.functions.invoke("start-generation", {
        body: {
          toolId: tool.id,
          toolName: tool.title,
          model: apiModel,
          apiType,
          input,
          resolution: serverResolution,
          quality: quality || null,
          durationSeconds: effectiveDurationSeconds,
          hasAudio: hasAudioForPricing,
          idempotencyKey,
          prompt: prompt || tool.title,
          fileType,
          jobMetadata: {
            aspectRatio,
            resolution,
            quality,
            detected_duration_seconds: mediaDurationSeconds ? Math.ceil(mediaDurationSeconds) : null,
            selected_resolution: resolution,
            matched_rate_per_second: price?.priceUnit === "per_second" ? price?.perCharRate || (price?.credits && effectiveDurationSeconds ? Math.round((price.credits / effectiveDurationSeconds) * 10) / 10 : null) : null,
          },
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
      

      // Job was created server-side. Refresh jobs list to pick it up,
      // then find it and start polling.
      await fetchJobs();

      // Find the job by reservation_id (most reliable)
      const findJob = () => {
        // Small delay to let realtime deliver the INSERT event
        return new Promise<GenerationJob | null>((resolve) => {
          // Try immediately from the response jobId
          const jobId = startResult.jobId;
          if (jobId) {
            (supabase as any)
              .from("generation_jobs")
              .select("*")
              .eq("id", jobId)
              .single()
              .then(({ data }: any) => resolve(data as GenerationJob | null));
          } else {
            // Fallback: find by reservation_id
            (supabase as any)
              .from("generation_jobs")
              .select("*")
              .eq("reservation_id", reservationId)
              .single()
              .then(({ data }: any) => resolve(data as GenerationJob | null));
          }
        });
      };

      const job = await findJob();
      if (!job) {
        console.error("Job record not found after server creation");
        // Continue with polling anyway using a synthetic job
      }

      const jobForPolling: GenerationJob = job || {
        id: startResult.jobId || "temp",
        user_id: user.id,
        task_id: taskId,
        reservation_id: reservationId,
        tool_id: tool.id,
        tool_name: tool.title,
        model: tool.model,
        api_type: apiType || "standard",
        prompt: prompt || tool.title,
        file_type: fileType,
        status: "pending" as const,
        progress: 0,
        result_url: null,
        error_message: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        seen_at: null,
        provider_billing_state: "upstream_task_created" as const,
        reconciliation_status: "not_required" as const,
        provider_status_code: null,
        provider_status_message: null,
        reconciliation_notes: null,
      };

      // Poll via queue
      await pollJob(
        jobForPolling,
        // onSuccess
        async (urls, completedJob) => {
          setResultUrls(urls);
          toast.success("تم التوليد بنجاح!");
          setProgress(100);
          setStatus("تم!");

          const fileUrl = urls[0];
          const { data: completeResult, error: completeError } = await supabase.functions.invoke("complete-generation", {
            body: {
              reservationId,
              status: "success",
              taskId,
              toolId: tool.id,
              toolName: tool.title,
              prompt,
              fileUrl: fileUrl || "",
              fileType: fileType,
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
          setLoading(false);
        },
        // onFail
        async (errorMsg, failedJob) => {
          // If it's a "background" message from long-running timeout, don't treat as real failure
          const isBackgroundContinue = errorMsg?.includes("يعمل في الخلفية");
          if (isBackgroundContinue) {
            toast.info("النموذج يعمل في الخلفية — تابع النتيجة من قائمة \"قيد التوليد\"", { duration: 6000 });
            setStatus("");
            setProgress(0);
            setLoading(false);
            // Don't call complete-generation — job is still alive
            return;
          }

          if (reservationId) {
            try {
              await supabase.functions.invoke("complete-generation", {
                body: {
                  reservationId, status: "failed", errorMessage: errorMsg,
                  providerStatusCode: null, providerFailState: errorMsg,
                },
              });
            } catch (releaseErr) {
              console.error("Failed to release credits:", releaseErr);
            }
          }
          toast.error(errorMsg || "فشل التوليد");
          setStatus("");
          setProgress(0);
          await refreshCredits();
          setLoading(false);
        },
        // onProgress
        (progressValue, phaseLabel, state) => {
          if (state !== "success" && state !== "fail") {
            setStatus(phaseLabel);
          }
          setProgress((prev) => {
            // keep progress smooth and monotonic while loading
            const next = Math.max(prev, Math.min(progressValue, 99));
            return Number.isFinite(next) ? next : prev;
          });
        },
      );

      return;
    } catch (err: unknown) {
      // ── Release reserved credits on failure ──
      if (reservationId) {
        try {
          await supabase.functions.invoke("complete-generation", {
            body: { reservationId, status: "failed", errorMessage: "Client-side error before provider response", providerFailState: "pre_provider_error" },
          });
        } catch (releaseErr) {
          console.error("Failed to release credits:", releaseErr);
        }
      }
      const errMsg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      console.error("Generation error:", err);
      toast.error(errMsg);
      setStatus("");
      setProgress(0);
      await refreshCredits();
    } finally {
      // Only set loading false if we didn't hand off to pollJob
      // pollJob callbacks handle this
    }
  };

  const currentRatio = ratioConfig[aspectRatio] || ratioConfig["1:1"];

  const openViewer = (url: string) => {
    setViewerUrl(url);
    setViewerOpen(true);
  };

  // ── Model Selector Content (portalized via Popover/Drawer) ──
  const renderModelSelectorContent = () => {
    const groups: { provider: string; tools: AITool[] }[] = [];
    categoryTools.forEach((t) => {
      const existing = groups.find((g) => g.provider === t.provider);
      if (existing) existing.tools.push(t);
      else groups.push({ provider: t.provider, tools: [t] });
    });

    if (modelSubPage) {
      const group = groups.find((g) => g.provider === modelSubPage);
      if (!group) return null;
      return (
        <div className="p-2">
          <button onClick={() => setModelSubPage(null)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-right hover:bg-secondary/40 transition-colors mb-1 flex-row-reverse">
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            <span className="text-xs font-bold text-primary flex-1 text-right">{group.provider}</span>
          </button>
          <div className="h-px bg-border/30 mx-2 mb-1" />
          <div className="space-y-0.5">
            {group.tools.map((t) => (
              <button key={t.id}
                onClick={() => { handleSelectModel(t); setModelSubPage(null); setModelSelectorOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                  selectedTool?.id === t.id ? "bg-primary/10" : "hover:bg-secondary/40"
                }`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${selectedTool?.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                </div>
                {t.isPro && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary shrink-0">PRO</span>}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-0.5">
        {groups.map((group) => {
          if (group.tools.length === 1) {
            const t = group.tools[0];
            return (
              <button key={t.id}
                onClick={() => { handleSelectModel(t); setModelSelectorOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                  selectedTool?.id === t.id ? "bg-primary/10" : "hover:bg-secondary/40"
                }`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${selectedTool?.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                </div>
                {t.isPro && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary shrink-0">PRO</span>}
              </button>
            );
          }
          const hasSelectedInGroup = group.tools.some((t) => selectedTool?.id === t.id);
          return (
            <button key={group.provider}
              onClick={() => setModelSubPage(group.provider)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                hasSelectedInGroup ? "bg-primary/5" : "hover:bg-secondary/40"
              }`}>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${hasSelectedInGroup ? "text-primary" : "text-foreground"}`}>{group.provider}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
            </button>
          );
        })}
      </div>
    );
  };

  const modelTriggerBtn = (
    <button className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all duration-200 ${
      selectedTool ? "bg-primary/10 border-primary/50" : "bg-secondary/40 border-primary/25 hover:bg-secondary/60 hover:border-primary/40"
    }`}>
      <span className={`text-xs font-bold truncate max-w-[110px] ${selectedTool ? "text-primary" : "text-foreground"}`}>
        {selectedTool?.title || "اختر النموذج"}
      </span>
      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${modelSelectorOpen ? "rotate-180" : ""}`} />
    </button>
  );

  const renderCardContent = () => {
    if (loading) {
      return (
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex flex-col items-center justify-center gap-3">
          <CircularProgress progress={progress} size={110} status={status} />
          {isAvatarTool && (
            <p className="text-[11px] text-muted-foreground text-center max-w-[260px] leading-relaxed mt-1">
              نماذج الأفتار تستغرق وقتاً أطول (2-10 دقائق). يمكنك المتابعة من قائمة "قيد التوليد" إذا أردت المغادرة.
            </p>
          )}
        </motion.div>
      );
    }

    if (resultUrls.length > 0) {
      // Multi-image grid (e.g. Grok generating multiple images or Shoots)
      if (resultUrls.length > 1 && !isVideoTool && !isAvatarTool) {
        const cols = resultUrls.length <= 2 ? "grid-cols-2" : resultUrls.length <= 4 ? "grid-cols-2" : "grid-cols-3";
        return (
          <motion.div key="multi-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
            className={`w-full h-full grid gap-2 ${cols}`}>
            {resultUrls.map((url, i) => (
              <motion.div key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
                className={`cursor-pointer rounded-xl overflow-hidden border border-border/20 hover:border-primary/40 transition-all ${
                  resultUrls.length === 3 && i === 2 ? "col-span-2" : ""
                } ${resultUrls.length === 5 && i === 4 ? "col-span-3" : ""}`}
                onClick={() => openViewer(url)}
              >
                <img src={url} alt={`Result ${i + 1}`} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </motion.div>
        );
      }
      // Single result
      return (
        <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full h-full cursor-pointer relative group" onClick={() => openViewer(resultUrls[0])}>
          {(isVideoTool || isAvatarTool) ? (
            <video src={resultUrls[0]} controls autoPlay playsInline className="w-full h-full object-contain rounded-2xl"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) setResultNaturalRatio(`${v.videoWidth}/${v.videoHeight}`);
              }} />
          ) : (
            <img src={resultUrls[0]} alt="Result" className="w-full h-full object-contain rounded-2xl"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) setResultNaturalRatio(`${img.naturalWidth}/${img.naturalHeight}`);
              }} />
          )}
        </motion.div>
      );
    }

    if (!selectedTool) {
      return (
        <motion.div key="no-model" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col items-center justify-center gap-3 text-center px-4">
          <Sparkles className="w-9 h-9 text-primary opacity-40" />
          <h2 className="text-base font-bold text-foreground/70">اختر النموذج</h2>
          <p className="text-xs text-muted-foreground/60">اختر النموذج للبدء</p>
        </motion.div>
      );
    }

    // Showcase: show demo content when no files uploaded yet
    const showcaseCategories = ["transfer", "images", "video", "remix", "avatar"];
    const hasNoInput = !avatarImage && !avatarVideo && refImages.length === 0 && !firstFrame && !prompt.trim();
    if (category && showcaseCategories.includes(category) && hasNoInput && currentShowcaseTexts.length > 0) {
      const isTransfer = category === "transfer";
      return (
        <motion.div key={`${category}-showcase`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24, ease: "easeOut" }}
          className="w-full h-full flex flex-col items-center justify-center gap-5 px-4">
          {isTransfer ? (
            <div className="flex justify-center w-full max-w-[420px]">
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <video src="/demos/transfer-demo-1.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground/60">{tool.description}</p>
            </div>
          )}
          <ShowcaseText />
        </motion.div>
      );
    }

    return (
      <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex flex-col items-center justify-center gap-3 text-center px-4">
        <Sparkles className="w-9 h-9 text-primary opacity-40" />
        <h2 className="text-base font-bold text-foreground/70">{isShootsTool ? "شوتس" : tool.title}</h2>
        <p className="text-xs text-muted-foreground/60">{isShootsTool ? "ارفع صورة لتوليد زاويتين، أو اكتب وصفاً لتوليد 6 صور" : tool.description}</p>
        {!isShootsTool && (
          <span className="text-[10px] text-muted-foreground/50 mt-1 bg-secondary/30 px-3 py-1 rounded-full">
            {currentRatio.label} {resolution ? `• ${resolution.toUpperCase()}` : ""}
          </span>
        )}
      </motion.div>
    );
  };

  // For shoots/grok, adapt placeholder based on whether image is uploaded
  const shootsHasImage = isShootsTool && refImages.length > 0;
  const shootsPlaceholderStyle = isShootsTool ? {
    width: "100%",
    maxWidth: shootsHasImage ? "min(95vw, 700px)" : "min(95vw, 750px)",
    aspectRatio: shootsHasImage ? "2/1" : "3/2",
    maxHeight: "calc(100dvh - 180px)",
  } : undefined;

  // Determine which settings to show based on model capabilities
  const showAspect = !isShootsTool && !!(selectedTool && caps?.aspectRatios?.length);
  const showDuration = !isShootsTool && !!(selectedTool && caps?.durations && caps.durations.length > 0);
  const showRes = !isShootsTool && !!(selectedTool && caps?.resolutions?.length);
  const isGrokVideo = !!selectedTool && selectedTool.model.startsWith("grok-imagine/");
  const showQuality = !isShootsTool && !isGrokVideo && !!(selectedTool && caps?.qualities?.length);
  const showUpscale = !isShootsTool && !!(selectedTool && caps?.upscaleFactors?.length);
  const isGrokVideoRef = isVideoTool && !hasFrameMode && (caps?.maxImages ?? 0) > 0;

  // ── Label helpers ──
  const durationLabel = (d: string) => `${d} ثواني`;
  const qualityLabel = (q: string) => {
    const map: Record<string, string> = { std: "قياسي (STD)", pro: "احترافي (PRO)", normal: "عادي", fun: "مرح", basic: "أساسي", high: "عالي" };
    return map[q] || q.toUpperCase();
  };
  const aspectLabelFn = (a: string) => {
    const map: Record<string, string> = { "auto": "تلقائي — حسب الصورة", "1:1": "1:1 — مربع", "9:16": "9:16 — عمودي", "16:9": "16:9 — أفقي", "3:4": "3:4 — بورتريه", "4:3": "4:3 — أفقي عريض", "21:9": "21:9 — سينمائي", "2:3": "2:3 — بورتريه عمودي", "3:2": "3:2 — أفقي عريض" };
    return map[a] || a;
  };

  // ── Dropdown select helper ──
  const renderSelect = (
    menuId: string,
    items: { value: string; label: string; locked?: boolean; lockLabel?: string }[],
    selected: string,
    onSelect: (v: string) => void
  ) => {
    const isOpen = openMenu === menuId;
    const selectedItem = items.find(i => i.value === selected);
    return (
      <Popover open={isOpen} onOpenChange={(v) => setOpenMenu(v ? menuId : null)}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition-all">
            <span className="text-sm font-semibold text-foreground truncate">{selectedItem?.label || selected}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-[260px] p-1.5 bg-card/95 backdrop-blur-xl border-primary/30 z-[300]" dir="rtl">
          <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
            {items.map(item => (
              <button key={item.value}
                disabled={item.locked}
                onClick={() => { if (!item.locked) { onSelect(item.value); setOpenMenu(null); } }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-right text-sm font-medium transition-colors ${
                  item.locked ? "opacity-40 cursor-not-allowed text-muted-foreground" :
                  selected === item.value ? "bg-primary/10 text-primary font-bold" : "hover:bg-secondary/50 text-foreground"
                }`}>
                <span>{item.label}</span>
                {item.locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // ── Setting chips helper (kept for upscale factors) ──
  const renderChips = (
    items: { value: string; label: string; locked?: boolean; lockLabel?: string }[],
    selected: string,
    onSelect: (v: string) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.value}
          disabled={item.locked}
          onClick={() => !item.locked && onSelect(item.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            item.locked
              ? "opacity-40 cursor-not-allowed bg-secondary/30 text-muted-foreground"
              : selected === item.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary/60 text-foreground hover:bg-secondary"
          }`}
        >
          {item.label}
          {item.locked && <Lock className="w-2.5 h-2.5 inline mr-1" />}
        </button>
      ))}
    </div>
  );

  // ── Shared settings content (desktop panel & mobile sheet) ──
  const renderSettingsContent = () => (
    <div className="space-y-5">
      {/* Model Selector */}
      {!isShootsTool && (
        <div>
          <Popover open={modelSelectorOpen} onOpenChange={(v) => { setModelSelectorOpen(v); if (!v) setModelSubPage(null); }}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition-all">
                <span className={`text-sm font-bold truncate ${selectedTool ? "text-primary" : "text-muted-foreground"}`}>
                  {selectedTool?.title || "اختر النموذج"}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${modelSelectorOpen ? "rotate-180" : ""}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-[280px] p-0 bg-card/95 backdrop-blur-xl border-primary/30 z-[300]" dir="rtl">
              <div className="max-h-[380px] overflow-y-auto">{renderModelSelectorContent()}</div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {!selectedTool ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <Sparkles className="w-6 h-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50">اختر نموذجاً للبدء</p>
        </div>
      ) : (
        <>
          {/* ── Aspect Ratio (first choice after model) ── */}
          {showAspect && (
            <div>
              {renderSelect("aspect", [
                { value: "auto", label: aspectLabelFn("auto") },
                ...caps!.aspectRatios!.map(r => ({ value: r, label: aspectLabelFn(r) }))
              ], aspectRatio, (v) => setAspectRatio(v as AspectRatio))}
            </div>
          )}

          {/* ── Frame uploads ── */}
          {hasFrameMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">
                {frameMode === "first-last" ? "الإطارات" : "الكادر الأول"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => !firstFrame && firstFrameInputRef.current?.click()}
                  className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden cursor-pointer ${firstFrame ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}
                  style={{ aspectRatio: "4/3" }}
                >
                  {firstFrame ? (
                    <div className="relative w-full h-full">
                      <img src={firstFrame.preview} alt="الكادر الأول" className="w-full h-full object-cover rounded-lg cursor-pointer" onClick={() => setFramePreviewUrl(firstFrame.preview)} />
                      <button onClick={(e) => { e.stopPropagation(); URL.revokeObjectURL(firstFrame.preview); setFirstFrame(null); }} className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10"><X className="w-3 h-3 text-destructive-foreground" /></button>
                      <button onClick={(e) => { e.stopPropagation(); firstFrameInputRef.current?.click(); }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 border border-border/30 flex items-center justify-center z-10"><Upload className="w-2.5 h-2.5 text-foreground" /></button>
                      <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-background/80 text-foreground px-2 py-0.5 rounded">الكادر الأول</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 h-full">
                      <Upload className="w-5 h-5 text-muted-foreground/50" />
                      <span className="text-[10px] font-semibold text-muted-foreground/60">الكادر الأول</span>
                    </div>
                  )}
                </div>
                {frameMode === "first-last" && (
                  <div
                    onClick={() => !lastFrame && lastFrameInputRef.current?.click()}
                    className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden cursor-pointer ${lastFrame ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}
                    style={{ aspectRatio: "4/3" }}
                  >
                    {lastFrame ? (
                      <div className="relative w-full h-full">
                        <img src={lastFrame.preview} alt="الكادر الأخير" className="w-full h-full object-cover rounded-lg cursor-pointer" onClick={() => setFramePreviewUrl(lastFrame.preview)} />
                        <button onClick={(e) => { e.stopPropagation(); URL.revokeObjectURL(lastFrame.preview); setLastFrame(null); }} className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10"><X className="w-3 h-3 text-destructive-foreground" /></button>
                        <button onClick={(e) => { e.stopPropagation(); lastFrameInputRef.current?.click(); }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 border border-border/30 flex items-center justify-center z-10"><Upload className="w-2.5 h-2.5 text-foreground" /></button>
                        <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-background/80 text-foreground px-2 py-0.5 rounded">الكادر الأخير</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 h-full">
                        <Upload className="w-5 h-5 text-muted-foreground/50" />
                        <span className="text-[10px] font-semibold text-muted-foreground/60">الكادر الأخير</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Reference images (non-video models with maxImages, e.g. image models) ── */}
          {!hasFrameMode && !isRemixTool && !isAvatarTool && !isImageOnlyTool && !isShootsTool && !isGrokVideoRef && (caps?.maxImages ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground/70">صور مرجعية</label>
                {refImages.length > 0 && <span className="text-[10px] text-muted-foreground">{refImages.length}/{caps?.maxImages ?? 3}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {refImages.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/50">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(i)} className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"><X className="w-2.5 h-2.5 text-destructive-foreground" /></button>
                  </div>
                ))}
                {refImages.length < (caps?.maxImages ?? 3) && (
                  <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex items-center justify-center transition-all"><Plus className="w-5 h-5 text-muted-foreground/50" /></button>
                )}
              </div>
            </div>
          )}

          {/* ── Remix image slots ── */}
          {isRemixTool && !hasFrameMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">الصور</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setRemixUploadSlot(0); remixSlotInputRef.current?.click(); }}
                  className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${refImages[0] ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}
                  style={{ aspectRatio: "4/3" }}>
                  {refImages[0] ? (
                    <div className="relative w-full h-full">
                      <img src={refImages[0].preview} alt="صورة 1" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={(e) => { e.stopPropagation(); removeImage(0); }} className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"><X className="w-3 h-3 text-destructive-foreground" /></button>
                      <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-background/80 text-foreground px-2 py-0.5 rounded">صورة 1</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 h-full"><Upload className="w-5 h-5 text-muted-foreground/50" /><span className="text-[10px] font-semibold text-muted-foreground/60">صورة 1</span></div>
                  )}
                </button>
                {remixMaxImages >= 2 && (
                  <button onClick={() => { setRemixUploadSlot(1); remixSlotInputRef.current?.click(); }}
                    className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${refImages[1] ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}
                    style={{ aspectRatio: "4/3" }}>
                    {refImages[1] ? (
                      <div className="relative w-full h-full">
                        <img src={refImages[1].preview} alt="صورة 2" className="w-full h-full object-cover rounded-lg" />
                        <button onClick={(e) => { e.stopPropagation(); removeImage(1); }} className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"><X className="w-3 h-3 text-destructive-foreground" /></button>
                        <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-background/80 text-foreground px-2 py-0.5 rounded">صورة 2</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 h-full"><Upload className="w-5 h-5 text-muted-foreground/50" /><span className="text-[10px] font-semibold text-muted-foreground/60">صورة 2</span></div>
                    )}
                  </button>
                )}
                {remixMaxImages > 2 && refImages.length >= 2 && refImages.length < remixMaxImages && (
                  <button onClick={() => { setRemixUploadSlot(refImages.length); remixSlotInputRef.current?.click(); }}
                    className="rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex flex-col items-center justify-center gap-1 transition-all"
                    style={{ aspectRatio: "4/3" }}>
                    <Plus className="w-5 h-5 text-muted-foreground/50" />
                    <span className="text-[9px] text-muted-foreground/60">{refImages.length}/{remixMaxImages}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Avatar uploads ── */}
          {isAvatarTool && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">الملفات</label>
              <div className="flex gap-2 items-stretch">
                {avatarImage ? (
                  <div className="relative w-20 h-20 rounded-xl border-2 border-primary/40 bg-primary/5 overflow-hidden shrink-0">
                    <img src={avatarImage.preview} alt="Avatar" className="w-full h-full object-cover" />
                    <button onClick={() => { if (avatarImage.preview.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview); setAvatarImage(null); }}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"><X className="w-3 h-3 text-destructive-foreground" /></button>
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-20 h-20 rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex flex-col items-center justify-center gap-1 transition-all shrink-0">
                        <ImageIcon className="w-5 h-5 text-muted-foreground/50" /><span className="text-[9px] font-semibold text-muted-foreground/60">صورة</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={8} className="w-[160px] p-1 bg-card/95 backdrop-blur-xl border-primary/30 z-[300]" dir="rtl">
                      <button onClick={() => avatarImageInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50"><Upload className="w-3.5 h-3.5 text-muted-foreground" /> رفع من الجهاز</button>
                      <button onClick={() => setImagePickerOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50"><FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> من المكتبة</button>
                    </PopoverContent>
                  </Popover>
                )}
                {isAvatarAudioModel && (
                  avatarAudio ? (
                    <div className="flex-1 rounded-xl border-2 border-primary/40 bg-primary/5 overflow-hidden flex items-center gap-2 px-3 min-h-[80px]">
                      <button onClick={toggleAvatarAudioPreview} className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center shrink-0">
                        {isAvatarAudioPlaying ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary ml-0.5" />}
                      </button>
                      <audio ref={avatarAudioPreviewRef} key={avatarAudio.previewUrl || avatarAudio.sourceUrl || ""} src={avatarAudio.previewUrl || avatarAudio.sourceUrl || ""} preload="metadata" className="hidden"
                        onPlay={() => setIsAvatarAudioPlaying(true)} onPause={() => setIsAvatarAudioPlaying(false)} onEnded={() => setIsAvatarAudioPlaying(false)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1"><Music className="w-3 h-3 text-primary shrink-0" /><span className="text-[10px] font-medium text-foreground truncate">{avatarAudio.name}</span></div>
                        {mediaDurationSeconds !== null && <span className="text-[9px] text-muted-foreground">{Math.ceil(mediaDurationSeconds)}ث</span>}
                      </div>
                      <button onClick={() => { stopAvatarAudioPreview(); if (avatarAudio.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarAudio.previewUrl); setAvatarAudio(null); setMediaDurationSeconds(null); }}
                        className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0"><X className="w-3 h-3 text-destructive-foreground" /></button>
                    </div>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex-1 min-h-[80px] rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex flex-col items-center justify-center gap-1 transition-all">
                          <Music className="w-5 h-5 text-muted-foreground/50" /><span className="text-[9px] font-semibold text-muted-foreground/60">إضافة صوت</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" sideOffset={8} className="w-[160px] p-1 bg-card/95 backdrop-blur-xl border-primary/30 z-[300]" dir="rtl">
                        <button onClick={() => avatarAudioInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50"><Upload className="w-3.5 h-3.5 text-muted-foreground" /> رفع من الجهاز</button>
                        <button onClick={() => setAudioPickerOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50"><FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> من المكتبة</button>
                      </PopoverContent>
                    </Popover>
                  )
                )}
                {isAvatarAnimateModel && (
                  <button onClick={() => avatarVideoInputRef.current?.click()}
                    className={`flex-1 min-h-[80px] relative rounded-xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center gap-1 ${avatarVideo ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}>
                    {avatarVideo ? (
                      <>
                        <Video className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-foreground truncate max-w-[80%] px-1">{avatarVideo.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setAvatarVideo(null); setMediaDurationSeconds(null); }}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"><X className="w-3 h-3 text-destructive-foreground" /></button>
                      </>
                    ) : (
                      <><Video className="w-5 h-5 text-muted-foreground/50" /><span className="text-[9px] font-semibold text-muted-foreground/60">فيديو مرجعي</span></>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Image-only upload (remove-bg, upscale) ── */}
          {isImageOnlyTool && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">الصورة</label>
              {refImages[0] ? (
                <div className="relative w-24 h-24 rounded-xl border-2 border-primary/40 overflow-hidden">
                  <img src={refImages[0].preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(0)} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"><X className="w-3 h-3 text-destructive-foreground" /></button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex flex-col items-center justify-center gap-1.5 transition-all">
                  <Upload className="w-6 h-6 text-muted-foreground/50" /><span className="text-[10px] font-semibold text-muted-foreground/60">رفع صورة</span>
                </button>
              )}
            </div>
          )}

          {/* ── Shoots image ── */}
          {isShootsTool && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">الصورة</label>
              <button onClick={() => fileInputRef.current?.click()}
                className={`w-full h-16 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all ${refImages.length > 0 ? "bg-primary/5 border-primary/40" : "bg-secondary/20 border-border/40 hover:border-primary/30"}`}>
                <Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-semibold text-foreground">{refImages.length > 0 ? "تغيير الصورة" : "رفع صورة"}</span>
              </button>
            </div>
          )}

          {/* ── Grok video reference image ── */}
          {isGrokVideoRef && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground/70">صورة مرجعية <span className="text-muted-foreground/50 font-normal">(اختياري)</span></label>
              <div
                onClick={() => !refImages[0] && grokRefInputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden cursor-pointer ${refImages[0] ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"}`}
                style={{ aspectRatio: "16/9", maxHeight: "120px" }}
              >
                {refImages[0] ? (
                  <div className="relative w-full h-full">
                    <img src={refImages[0].preview} alt="ref" className="w-full h-full object-cover cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setFramePreviewUrl(refImages[0].preview); }} />
                    <button onClick={(e) => { e.stopPropagation(); removeImage(0); }}
                      className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <Upload className="w-5 h-5 text-muted-foreground/50" />
                    <span className="text-[9px] font-semibold text-muted-foreground/60">رفع صورة</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Setting dropdowns ── */}
          {showDuration && (
            <div>
              {renderSelect("duration", caps!.durations!.map(d => ({ value: d, label: durationLabel(d) })), videoDuration, setVideoDuration)}
            </div>
          )}
          {showQuality && (
            <div>
              {renderSelect("quality", caps!.qualities!.map(q => { const a = checkAccess(null, q, null); return { value: q, label: qualityLabel(q), locked: !a.available, lockLabel: a.requiredPlanLabel }; }), quality, setQuality)}
            </div>
          )}
          {showRes && (
            <div>
              {renderSelect("resolution", caps!.resolutions!.map(r => { const a = checkAccess(r, null, null); return { value: r, label: r.toUpperCase(), locked: !a.available, lockLabel: a.requiredPlanLabel }; }), resolution, setResolution)}
            </div>
          )}
          {showUpscale && (
            <div>
              {renderChips(caps!.upscaleFactors!.map(f => ({ value: f, label: `${f}x` })), upscaleFactor, setUpscaleFactor)}
            </div>
          )}

          {/* Avatar pricing */}
          {isAvatarTool && mediaDurationSeconds !== null && price && price.priceUnit === "per_second" && effectiveDurationSeconds && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/30">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-1 flex-wrap">
                <span className="font-bold text-foreground">{resolution?.toUpperCase()}</span><span>•</span>
                <span>{effectiveDurationSeconds}ث</span><span>•</span>
                <span>{Math.round((price.credits / effectiveDurationSeconds) * 10) / 10} كريدت/ث</span><span>•</span>
                <span className="font-bold text-primary">{price.credits} كريدت</span>
              </div>
            </div>
          )}
          {mediaDurationExceedsLimit && (
            <div className="px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30">
              <span className="text-[10px] text-destructive font-medium">⚠️ المدة {Math.ceil(mediaDurationSeconds!)}ث تتجاوز الحد الأقصى (15ث). سيتم احتساب 15ث فقط.</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  const isGenerateDisabled = loading || !selectedTool || insufficientCredits
    || (isImageOnlyTool && refImages.length === 0)
    || (isShootsTool && refImages.length === 0 && !prompt.trim())
    || (isAvatarAudioModel && (!avatarImage || !avatarAudio || mediaDurationSeconds === null))
    || (isAvatarAnimateModel && (!avatarImage || !avatarVideo || mediaDurationSeconds === null));

  const generateBtnLabel = isImageOnlyTool ? (category === "remove-bg" ? "حذف الخلفية" : "رفع الجودة") : "بدء التوليد";

  // ── Preview card (shared between desktop & mobile) ──
  const previewCard = (maxH: string) => (
    <>
      <motion.div
        layout
        transition={{ duration: 0.28, ease: "easeOut" }}
        className={`relative rounded-2xl overflow-hidden flex items-center justify-center border ${
          resultUrls.length > 0 && !loading ? "border-transparent" : loading ? "border-primary/30" : "border-transparent"
        }`}
        style={shootsPlaceholderStyle || (() => {
          const hasResult = resultUrls.length > 0 && !loading;
          const useNatural = hasResult && resultNaturalRatio;
          return {
            width: "100%",
            maxWidth: useNatural ? "min(96vw, 820px)" : currentRatio.placeholderMaxW,
            aspectRatio: useNatural ? resultNaturalRatio! : currentRatio.cssAspect,
            maxHeight: maxH,
            background: hasResult ? "transparent" : undefined,
          };
        })()}
      >
        {resultUrls.length === 0 && !loading && <div className="absolute inset-0 shimmer-effect opacity-[0.06] pointer-events-none" />}
        {loading && (
          <>
            <div className="absolute inset-0 shimmer-effect opacity-[0.15] pointer-events-none" />
            <div className="absolute inset-0 bg-background/65 pointer-events-none" />
          </>
        )}
        {(resultUrls.length === 0 || loading) && <div className="absolute inset-0 bg-secondary/20 pointer-events-none" />}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-2">
          <AnimatePresence mode="wait" initial={false}>
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
    </>
  );

  // ── Hidden file inputs ──
  const hiddenInputs = (
    <>
      <input ref={grokRefInputRef} type="file" accept="image/*" className="hidden" onChange={handleGrokRefUpload} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple={!isImageOnlyTool} className="hidden" onChange={handleImageUpload} />
      <input ref={remixSlotInputRef} type="file" accept="image/*" className="hidden" onChange={handleRemixSlotUpload} />
      <input ref={firstFrameInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFrameUpload("first", e)} />
      <input ref={lastFrameInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFrameUpload("last", e)} />
      <input ref={avatarImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        if (avatarImage?.preview?.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview);
        setAvatarImage({ file, preview: objectUrl, sourceUrl: objectUrl });
        if (avatarImageInputRef.current) avatarImageInputRef.current.value = "";
      }} />
      <input ref={avatarAudioInputRef} type="file" accept="audio/*" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        if (avatarAudio?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarAudio.previewUrl);
        stopAvatarAudioPreview();
        setAvatarAudio({ file, name: file.name, previewUrl: objectUrl, sourceUrl: objectUrl });
        const duration = await detectAudioDuration(objectUrl);
        if (duration !== null) setMediaDurationSeconds(duration);
        else { setMediaDurationSeconds(null); toast.error("تعذر قراءة مدة الملف الصوتي"); }
        if (avatarAudioInputRef.current) avatarAudioInputRef.current.value = "";
      }} />
      <input ref={avatarVideoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarVideo({ file, name: file.name });
        const videoEl = document.createElement("video");
        videoEl.preload = "metadata";
        videoEl.src = URL.createObjectURL(file);
        videoEl.addEventListener("loadedmetadata", () => {
          if (videoEl.duration && isFinite(videoEl.duration)) setMediaDurationSeconds(videoEl.duration);
          URL.revokeObjectURL(videoEl.src);
        });
        videoEl.addEventListener("error", () => URL.revokeObjectURL(videoEl.src));
        if (avatarVideoInputRef.current) avatarVideoInputRef.current.value = "";
      }} />
    </>
  );

  return (
    <div className="h-[100dvh] bg-background flex overflow-hidden" dir="rtl">
      {hiddenInputs}

      {!isMobile ? (
        /* ═══════════ DESKTOP LAYOUT ═══════════ */
        <>
          {/* ── Left Control Panel ── */}
          <aside className="w-[340px] shrink-0 h-full bg-card/50 backdrop-blur-xl border-l border-border/20 flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
              <h1 className="text-sm font-bold text-foreground">{categoryTitleMap[category!] || ""}</h1>
              <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide">
              {renderSettingsContent()}
            </div>
            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-border/15 space-y-3">
              {!isImageOnlyTool && (
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isShootsTool ? "صف الزوايا المطلوبة..." : isAvatarTool ? "وصف اختياري للأداء..." : isRemixTool ? "صف التعديل المطلوب..." : "اكتب وصفاً لما تريد توليده..."}
                  className="min-h-[80px] max-h-[140px] resize-none rounded-xl bg-secondary/30 border-border/30 text-sm placeholder:text-muted-foreground/50"
                  dir="rtl"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleGenerate(); } }}
                />
              )}
              <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full rounded-xl gap-2 h-11 text-sm font-bold shadow-lg">
                <Sparkles className="w-4 h-4" />
                <span>{generateBtnLabel}</span>
                {estimatedCost > 0 && <span className="text-[11px] font-bold opacity-80">{estimatedCost} كريدت</span>}
              </Button>
            </div>
          </aside>

          {/* ── Center Preview ── */}
          <main className="flex-1 flex flex-col items-center justify-center min-h-0 px-8">
            {previewCard("calc(100dvh - 80px)")}
          </main>
        </>
      ) : (
        /* ═══════════ MOBILE LAYOUT ═══════════ */
        <div className="flex-1 flex flex-col">
          {/* ── Top Bar ── */}
          <header ref={headerRef} className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border/20 z-50">
            <button onClick={() => setSettingsSheetOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all">
              <SlidersHorizontal className="w-4 h-4 text-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground">{categoryTitleMap[category!] || ""}</span>
            <button onClick={() => navigate("/")}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary/50 transition-all text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </header>

          {/* ── Center Preview ── */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
            {previewCard("calc(100dvh - 200px)")}
          </div>

          {/* ── Bottom Bar ── */}
          <div ref={bottomBarRef} className="shrink-0 bg-card/80 backdrop-blur-xl border-t border-border/20 px-4 py-3 z-50 space-y-2">
            {isImageOnlyTool ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                      refImages.length > 0 ? "bg-primary/10 border-primary/40" : "bg-secondary border-border/50 hover:bg-secondary/80"
                    }`}>
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="flex-1 text-xs text-muted-foreground text-right" dir="rtl">
                    {refImages.length > 0 ? `تم اختيار ${refImages.length} صورة` : "اختر صورة للمعالجة"}
                  </span>
                </div>
                <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full rounded-xl gap-2 h-11 text-sm font-bold shadow-lg">
                  <Sparkles className="w-4 h-4" /><span>{generateBtnLabel}</span>
                  {estimatedCost > 0 && <span className="text-[11px] font-bold opacity-80">{estimatedCost} كريدت</span>}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {!hasFrameMode && !isRemixTool && !isAvatarTool && !isShootsTool && (caps?.maxImages ?? 0) > 0 && refImages.length < (caps?.maxImages ?? 0) && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-10 h-10 rounded-xl bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {isShootsTool && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className={`shrink-0 h-10 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                        refImages.length > 0 ? "bg-primary/10 border-primary/40" : "bg-secondary border-border/50"
                      }`}>
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-foreground">{refImages.length > 0 ? "تغيير" : "صورة"}</span>
                    </button>
                  )}
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isShootsTool ? "صف الزوايا..." : isAvatarTool ? "وصف اختياري..." : isRemixTool ? "صف التعديل..." : "اكتب وصفاً لما تريد توليده..."}
                    className="flex-1 min-h-[40px] max-h-[80px] resize-none rounded-xl bg-secondary/40 border border-border/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50"
                    dir="rtl"
                    rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleGenerate(); } }}
                  />
                </div>
                <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full rounded-xl gap-2 h-11 text-sm font-bold shadow-lg">
                  <Sparkles className="w-4 h-4" />
                  <span>{generateBtnLabel}</span>
                  {estimatedCost > 0 && <span className="text-[11px] font-bold opacity-80">{estimatedCost} كريدت</span>}
                </Button>
              </div>
            )}
          </div>

          {/* ── Settings Sidebar ── */}
          <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
            <SheetContent side="right" className="w-[85vw] max-w-[360px] p-0 border-r border-border/20 [&>button]:left-4 [&>button]:right-auto">
              <div className="px-5 pt-12 pb-8 h-full overflow-y-auto space-y-1 scrollbar-hide" dir="rtl">
                {renderSettingsContent()}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ── Viewers & Dialogs ── */}
      <ImageViewer src={viewerUrl} open={viewerOpen} onClose={() => setViewerOpen(false)} type={(isVideoTool || isAvatarTool) ? "video" : "image"} />
      {framePreviewUrl && <ImageViewer src={framePreviewUrl} open={!!framePreviewUrl} onClose={() => setFramePreviewUrl(null)} type="image" />}
      {cropState && (
        <CropDialog open={!!cropState} imageSrc={cropState.imageSrc} aspectRatio={cropAspectNumeric}
          onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}
      <MediaPickerDialog open={imagePickerOpen} onClose={() => setImagePickerOpen(false)} mediaType="image"
        onSelect={(url) => { if (avatarImage?.preview?.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview); setAvatarImage({ preview: url, sourceUrl: url }); }} />
      <MediaPickerDialog open={audioPickerOpen} onClose={() => setAudioPickerOpen(false)} mediaType="audio"
        onSelect={async (url, fileName) => { await applyAvatarAudioFromSource(url, fileName || "library_audio.mp3"); }} />
    </div>
  );
};

export default StudioPage;
