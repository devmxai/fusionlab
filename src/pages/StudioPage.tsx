import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tools, buildModelInput, AITool } from "@/data/tools";
import { getModelCapabilities } from "@/data/model-capabilities";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon, Send, X, Sparkles, ChevronDown, Upload, Plus, Music, Video, Lock, Play, Pause, FolderOpen } from "lucide-react";
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
  shoots: "شوتس",
};

const categoryTitleMap: Record<string, string> = {
  images: "استديو الصور",
  video: "استديو الفيديو",
  remix: "استديو الريمكس",
  audio: "استديو الصوت",
  avatar: "استديو الأفتار",
  "remove-bg": "حذف الخلفية",
  upscale: "رفع الجودة",
  shoots: "شوتس",
};

const ratioConfig: Record<string, { label: string; cssAspect: string; placeholderMaxW: string }> = {
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
      if (!inHeader && !inBottomBar) {
        setOpenMenu(null);
        setModelSubPage(null);
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

  // Get the correct resolution for avatar models (fixed per model, not from dropdown)
  const avatarPricingResolution = useMemo((): string | null => {
    if (!selectedTool) return null;
    if (selectedTool.model === "kling/ai-avatar-standard") return "720p";
    if (selectedTool.model === "kling/ai-avatar-pro") return "1080p";
    if (selectedTool.model === "infinitalk/from-audio") return resolution; // user-selected
    if (selectedTool.model === "wan/2-2-animate-move") return resolution; // user-selected
    return null;
  }, [selectedTool, resolution]);

  // Dynamic pricing based on selected model + options
  const pricingParams = useMemo(() => {
    if (!selectedTool) return null;
    const t = selectedTool;
    const isAvatar = t.inputType === "avatar" || t.inputType === "animate";

    return {
      model: t.model,
      resolution: isAvatar ? avatarPricingResolution : (resolution || null),
      quality: quality || null,
      durationSeconds: effectiveDurationSeconds,
      hasAudio: hasAudioForPricing,
    };
  }, [selectedTool, resolution, quality, effectiveDurationSeconds, hasAudioForPricing, avatarPricingResolution]);

  const { price } = usePricing(pricingParams);
  const { checkAccess } = usePlanGating(selectedTool?.model || null);

  // Reset settings when model changes
  const handleSelectModel = (t: AITool) => {
    setSelectedTool(t);
    setOpenMenu(null);
    setResultUrls([]);
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
    if (c.qualities?.length) setQuality(c.qualities[0]);
  };

  // Pre-select model from query param (e.g. ?model=kling-3)
  // and ensure each category always has a valid selected model.
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

    const selectedIsValidInCategory = !!selectedTool && categoryTools.some((t) => t.id === selectedTool.id);
    if (!selectedIsValidInCategory) {
      handleSelectModel(categoryTools[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTools, selectedTool, searchParams, setSearchParams]);

  const tool = selectedTool || categoryTools[0] || null;
  const isVideoTool = category === "video";
  const isImageOnlyTool = category === "remove-bg" || category === "upscale";
  const isUpscaleTool = category === "upscale";
  const isRemixTool = category === "remix";
  const isAvatarTool = category === "avatar";
  const isShootsTool = category === "shoots";
  const isAvatarAudioModel = isAvatarTool && !!tool && (tool.inputType === "avatar");
  const isAvatarAnimateModel = isAvatarTool && !!tool && (tool.inputType === "animate");
  const isFluxKontext = !!tool && tool.isFluxKontextApi === true;
  const hasFrameMode = !!(caps?.frameMode || tool?.frameMode);
  const frameMode = caps?.frameMode || tool?.frameMode;
  const isGrokImage = !!tool && tool.model === "grok-imagine/text-to-image" && !isShootsTool;

  // Remix image limits from capabilities
  const remixMaxImages = isRemixTool ? (caps?.maxImages ?? 3) : 0;
  const remixMinImages = isRemixTool ? (caps?.minImages ?? 0) : 0;

  // Shoots: Coming Soon page
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

        if (avatarImage.file) {
          const imgB64 = await fileToBase64(avatarImage.file);
          const imgUrl = await uploadFileBase64(imgB64, `avatar_img_${Date.now()}.png`);
          imageUrls = [imgUrl];
        } else if (avatarImage.sourceUrl) {
          imageUrls = [avatarImage.sourceUrl];
        } else {
          throw new Error("تعذر قراءة الصورة المحددة");
        }

        setProgress(18);
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

      // ── Step 3: Start generation (server: auth → entitlement → price → reserve → create task + job record) ──
      setStatus("جاري التحقق والإنشاء...");
      setProgress((prev) => Math.max(prev, 5));

      const idempotencyKey = `gen_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileType = (isVideoTool || isAvatarTool) ? "video" : "image";

      // Use avatar-specific resolution for avatar models, general resolution otherwise
      const serverResolution = isAvatarTool ? avatarPricingResolution : (resolution || null);

      const { data: startResult, error: startError } = await supabase.functions.invoke("start-generation", {
        body: {
          toolId: tool.id,
          toolName: tool.title,
          model: tool.model,
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
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
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

  // ── Dropdown Button Component ──
  const DropdownBtn = ({ id, label, value, hasValue }: { id: string; label: string; value: string; hasValue: boolean }) => (
    <button
      onClick={() => {
        if (openMenu === id) {
          setOpenMenu(null);
        } else {
          setOpenMenu(id);
          if (id === "model") setModelSubPage(null);
        }
      }}
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
  const DropdownMenu = ({ id, children, minW = "min-w-[120px]" }: { id: string; children: React.ReactNode; minW?: string }) => {
    if (openMenu !== id) return null;
    return (
      <div
        className={`absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden z-[220] ${minW}`}
      >
        <div className="max-h-72 overflow-y-auto p-1.5 scrollbar-hide">{children}</div>
      </div>
    );
  };

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
          <motion.div key="multi-result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className={`w-full h-full grid gap-2 ${cols}`}>
            {resultUrls.map((url, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
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
        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="w-full h-full cursor-pointer relative group" onClick={() => openViewer(resultUrls[0])}>
          {(isVideoTool || isAvatarTool) ? (
            <video src={resultUrls[0]} controls autoPlay playsInline className="w-full h-full object-contain rounded-2xl" />
          ) : (
            <img src={resultUrls[0]} alt="Result" className="w-full h-full object-contain rounded-2xl" />
          )}
        </motion.div>
      );
    }

    if (!selectedTool) {
      return (
        <motion.div key="no-model" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center gap-3 text-center px-4">
          <Sparkles className="w-9 h-9 text-primary opacity-40" />
          <h2 className="text-base font-bold text-foreground/70">اختر النموذج</h2>
          <p className="text-xs text-muted-foreground/60">اختر نموذج من الأعلى للبدء</p>
        </motion.div>
      );
    }

    return (
      <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
  const showQuality = !isShootsTool && !!(selectedTool && caps?.qualities?.length);
  const showUpscale = !isShootsTool && !!(selectedTool && caps?.upscaleFactors?.length);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* ── Header / App Bar ── */}
      <header ref={headerRef} className="relative shrink-0 bg-card/90 backdrop-blur-xl border-b border-border/30 z-[120] rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2.5 w-full flex-row-reverse relative">
          {/* Back button - pinned to left edge */}
          <button
            onClick={() => navigate("/")}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all absolute left-3 top-1/2 -translate-y-1/2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Settings dropdowns - only show after model is selected */}
          {selectedTool && (
              <div className="flex items-center gap-2">
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

                {/* Quality / Mode with Plan Gating */}
                {showQuality && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="quality" label="الجودة" value={quality.toUpperCase()} hasValue={!!selectedTool} />
                    <DropdownMenu id="quality">
                      {caps!.qualities!.map((q) => {
                        const access = checkAccess(null, q, null);
                        const locked = !access.available;
                        return (
                          <button key={q}
                            disabled={locked}
                            onClick={() => { if (!locked) { setQuality(q); setOpenMenu(null); } }}
                            className={`w-full px-3.5 py-2.5 rounded-lg text-right text-sm font-semibold transition-colors flex items-center justify-between gap-2 ${
                              locked ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                : quality === q ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"
                            }`}
                          >
                            <span>{q.toUpperCase()}</span>
                            {locked && (
                              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                                <Lock className="w-2.5 h-2.5" />{access.requiredPlanLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </DropdownMenu>
                  </div>
                )}

                {/* Resolution with Plan Gating */}
                {showRes && (
                  <div className="relative shrink-0">
                    <DropdownBtn id="resolution" label="الدقة" value={resolution.toUpperCase()} hasValue={!!selectedTool} />
                    <DropdownMenu id="resolution">
                      {caps!.resolutions!.map((r) => {
                        const access = checkAccess(r, null, null);
                        const locked = !access.available;
                        return (
                          <button key={r}
                            disabled={locked}
                            onClick={() => { if (!locked) { setResolution(r); setOpenMenu(null); } }}
                            className={`w-full px-3.5 py-2.5 rounded-lg text-right text-sm font-semibold transition-colors flex items-center justify-between gap-2 ${
                              locked
                                ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                : resolution === r
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-secondary/50"
                            }`}
                          >
                            <span>{r.toUpperCase()}</span>
                            {locked && (
                              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                                <Lock className="w-2.5 h-2.5" />
                                {access.requiredPlanLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
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
              </div>
            )}

          {/* Model dropdown - hidden for shoots */}
          {!isShootsTool && (
          <div className="relative shrink-0">
            <DropdownBtn id="model" label="النموذج" value={selectedTool?.title || ""} hasValue={!!selectedTool} />
            {openMenu === "model" && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-2xl shadow-2xl overflow-hidden z-[220] min-w-[260px] w-[280px]"
              >
                <div className="max-h-[380px] overflow-y-auto">
                  {(() => {
                    // Group tools by provider
                    const groups: { provider: string; tools: AITool[] }[] = [];
                    categoryTools.forEach((t) => {
                      const existing = groups.find((g) => g.provider === t.provider);
                      if (existing) existing.tools.push(t);
                      else groups.push({ provider: t.provider, tools: [t] });
                    });

                    // Sub-page mode: showing models of a specific provider
                    if (modelSubPage) {
                      const group = groups.find((g) => g.provider === modelSubPage);
                      if (!group) return null;
                      return (
                        <div className="p-2">
                          {/* Sub-page header with back */}
                          <button
                            onClick={() => setModelSubPage(null)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-right hover:bg-secondary/40 transition-colors mb-1 flex-row-reverse"
                          >
                            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                            <span className="text-xs font-bold text-primary flex-1 text-right">{group.provider}</span>
                          </button>
                          <div className="h-px bg-border/30 mx-2 mb-1" />
                          <div className="space-y-0.5">
                            {group.tools.map((t) => (
                              <button key={t.id}
                                onClick={() => { handleSelectModel(t); setModelSubPage(null); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                                  tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/40"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                                </div>
                                {t.isPro && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary shrink-0">PRO</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Main page: list providers
                    return (
                      <div className="p-2 space-y-0.5">
                        {groups.map((group) => {
                          if (group.tools.length === 1) {
                            const t = group.tools[0];
                            return (
                              <button key={t.id}
                                onClick={() => handleSelectModel(t)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                                  tool.id === t.id ? "bg-primary/10" : "hover:bg-secondary/40"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${tool.id === t.id ? "text-primary" : "text-foreground"}`}>{t.title}</p>
                                </div>
                                {t.isPro && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary shrink-0">PRO</span>}
                              </button>
                            );
                          }

                          // Multi-model provider: navigate to sub-page on click
                          const hasSelectedInGroup = group.tools.some((t) => tool.id === t.id);
                          return (
                            <button key={group.provider}
                              onClick={() => setModelSubPage(group.provider)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors ${
                                hasSelectedInGroup ? "bg-primary/5" : "hover:bg-secondary/40"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${hasSelectedInGroup ? "text-primary" : "text-foreground"}`}>{group.provider}</p>
                                
                              </div>
                              <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </div>
          )}
        </div>
      </header>

      {/* ── Center area ── */}
      <div className="relative z-0 flex-1 flex flex-col items-center justify-center px-4 md:px-8 min-h-0">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`relative rounded-2xl overflow-hidden flex items-center justify-center border ${
            resultUrls.length > 0 && !loading ? "border-transparent" : loading ? "border-primary/30" : "border-border/30"
          }`}
          style={shootsPlaceholderStyle || {
            width: "100%",
            maxWidth: currentRatio.placeholderMaxW,
            aspectRatio: currentRatio.cssAspect,
            maxHeight: "calc(100dvh - 180px)",
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
          <div className="relative z-10 w-full h-full flex items-center justify-center p-2">
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
      <div ref={bottomBarRef} className="shrink-0 bg-card/90 backdrop-blur-xl border-t border-border/30 px-4 py-3 z-50">
        <div className="w-full space-y-2">
          {/* Hidden file inputs */}
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
            if (duration !== null) {
              setMediaDurationSeconds(duration);
            } else {
              setMediaDurationSeconds(null);
              toast.error("تعذر قراءة مدة الملف الصوتي");
            }
            if (avatarAudioInputRef.current) avatarAudioInputRef.current.value = "";
          }} />
          <input ref={avatarVideoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAvatarVideo({ file, name: file.name });
            // Detect video duration for animate models
            const videoEl = document.createElement("video");
            videoEl.preload = "metadata";
            videoEl.src = URL.createObjectURL(file);
            videoEl.addEventListener("loadedmetadata", () => {
              if (videoEl.duration && isFinite(videoEl.duration)) {
                setMediaDurationSeconds(videoEl.duration);
              }
              URL.revokeObjectURL(videoEl.src);
            });
            videoEl.addEventListener("error", () => {
              URL.revokeObjectURL(videoEl.src);
            });
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
            <div className="flex gap-2 items-stretch">
              {/* Image slot - single icon with dropdown */}
              {avatarImage ? (
                <div
                  className="relative rounded-xl border-2 border-primary/40 bg-primary/5 overflow-hidden flex-shrink-0"
                  style={{ width: "56px", height: "56px" }}
                >
                  <img src={avatarImage.preview} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => {
                      if (avatarImage.preview.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview);
                      setAvatarImage(null);
                    }}
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === "avatar-img" ? null : "avatar-img")}
                    className="rounded-xl border-2 border-dashed border-border/40 bg-secondary/30 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-0.5"
                    style={{ width: "56px", height: "56px" }}
                  >
                    <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                    <span className="text-[7px] font-semibold text-muted-foreground/70">صورة</span>
                  </button>
                  {openMenu === "avatar-img" && (
                    <div className="absolute bottom-full mb-1.5 right-0 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden z-[220] min-w-[130px]">
                      <div className="p-1">
                        <button
                          onClick={() => { setOpenMenu(null); avatarImageInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          رفع من الجهاز
                        </button>
                        <button
                          onClick={() => { setOpenMenu(null); setImagePickerOpen(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          من المكتبة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audio slot - single icon with dropdown */}
              {isAvatarAudioModel && (
                <div
                  className={`flex-1 relative rounded-xl border-2 border-dashed transition-all ${
                    avatarAudio ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30 hover:border-primary/30"
                  }`}
                  style={{ minHeight: "56px" }}
                >
                  {avatarAudio ? (
                    <div className="relative w-full h-14 flex items-center gap-3 px-3">
                      {(() => {
                        const audioSrc = avatarAudio.previewUrl || avatarAudio.sourceUrl || "";
                        return (
                          <>
                            <button
                              onClick={toggleAvatarAudioPreview}
                              className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center flex-shrink-0 transition-colors"
                            >
                              {isAvatarAudioPlaying ? (
                                <Pause className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
                              )}
                            </button>
                            <audio
                              ref={avatarAudioPreviewRef}
                              key={audioSrc}
                              src={audioSrc}
                              preload="metadata"
                              className="hidden"
                              onPlay={() => setIsAvatarAudioPlaying(true)}
                              onPause={() => setIsAvatarAudioPlaying(false)}
                              onEnded={() => setIsAvatarAudioPlaying(false)}
                            />
                          </>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <Music className="w-3.5 h-3.5 text-primary inline-block mr-1" />
                        <span className="text-[10px] font-medium text-foreground truncate">{avatarAudio.name}</span>
                        {mediaDurationSeconds !== null && (
                          <span className="text-[9px] text-muted-foreground mr-1">({Math.ceil(mediaDurationSeconds)}ث)</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          stopAvatarAudioPreview();
                          if (avatarAudio.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(avatarAudio.previewUrl);
                          setAvatarAudio(null);
                          setMediaDurationSeconds(null);
                        }}
                        className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center flex-shrink-0"
                      >
                        <X className="w-2.5 h-2.5 text-destructive-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center w-full h-full">
                      <button
                        onClick={() => setOpenMenu(openMenu === "avatar-audio" ? null : "avatar-audio")}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-secondary/60 transition-colors"
                      >
                        <Music className="w-4 h-4 text-muted-foreground/60" />
                        <span className="text-[10px] font-semibold text-muted-foreground/70">إضافة صوت</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                      </button>
                      {openMenu === "avatar-audio" && (
                        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden z-[220] min-w-[150px]">
                          <div className="p-1">
                            <button
                              onClick={() => { setOpenMenu(null); avatarAudioInputRef.current?.click(); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                              رفع من الجهاز
                            </button>
                            <button
                              onClick={() => { setOpenMenu(null); setAudioPickerOpen(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                              من المكتبة
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                        onClick={(e) => { e.stopPropagation(); setAvatarVideo(null); setMediaDurationSeconds(null); }}
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

          {/* ── Avatar Pricing Breakdown ── */}
          {isAvatarTool && selectedTool && mediaDurationSeconds !== null && price && price.priceUnit === "per_second" && effectiveDurationSeconds && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50 border border-border/30">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-1">
                <span className="font-bold text-foreground">{resolution?.toUpperCase()}</span>
                <span>•</span>
                <span>{effectiveDurationSeconds}ث</span>
                <span>•</span>
                <span>{Math.round((price.credits / effectiveDurationSeconds) * 10) / 10} كريدت/ث</span>
                <span>•</span>
                <span className="font-bold text-primary">{price.credits} كريدت</span>
              </div>
            </div>
          )}

          {/* Duration exceeded warning */}
          {mediaDurationExceedsLimit && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30">
              <span className="text-[10px] text-destructive font-medium">
                ⚠️ المدة {Math.ceil(mediaDurationSeconds!)}ث تتجاوز الحد الأقصى (15ث). سيتم احتساب 15ث فقط.
              </span>
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
            {!hasFrameMode && !isRemixTool && !isAvatarTool && !isImageOnlyTool && !isShootsTool && (caps?.maxImages ?? 0) > 0 && refImages.length < (caps?.maxImages ?? 0) && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Shoots: always show image upload button */}
            {isShootsTool && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`shrink-0 h-9 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                  refImages.length > 0 ? "bg-primary/10 border-primary/40" : "bg-secondary border-border/50 hover:bg-secondary/80"
                }`}
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-foreground">{refImages.length > 0 ? "تغيير" : "صورة"}</span>
              </button>
            )}

            {isImageOnlyTool ? (
              <>
                {/* Small upload icon button — same style as other studios */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                    refImages.length > 0 ? "bg-primary/10 border-primary/40" : "bg-secondary border-border/50 hover:bg-secondary/80"
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Wide action button */}
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !selectedTool || insufficientCredits || refImages.length === 0}
                  className="flex-1 rounded-xl gap-2 h-10 text-xs font-bold shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{category === "remove-bg" ? "حذف الخلفية" : "رفع الجودة"}</span>
                  {estimatedCost > 0 && (
                    <span className="text-[10px] opacity-80">{estimatedCost} كريدت</span>
                  )}
                </Button>
              </>
            ) : (
              <>
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isShootsTool ? "صف الزوايا المطلوبة..." : isAvatarTool ? "وصف اختياري للأداء..." : isRemixTool ? "صف التعديل المطلوب..." : "اكتب وصفاً لما تريد توليده..."}
                  className="flex-1 h-9 rounded-lg bg-secondary/40 border border-border/30 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                  dir="rtl"
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
                />

                <Button
                  onClick={handleGenerate}
                  disabled={loading || !selectedTool || insufficientCredits || (isShootsTool && refImages.length === 0 && !prompt.trim()) || (isAvatarAudioModel && (!avatarImage || !avatarAudio || mediaDurationSeconds === null)) || (isAvatarAnimateModel && (!avatarImage || !avatarVideo || mediaDurationSeconds === null))}
                  className="shrink-0 rounded-xl gap-2 px-4 h-10 text-xs font-bold shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAvatarTool && mediaDurationSeconds !== null && estimatedCost > 0 ? (
                    <span className="text-[11px] font-bold">{estimatedCost}</span>
                  ) : isAvatarTool && mediaDurationSeconds === null ? (
                    <span className="text-[11px] font-bold opacity-50">—</span>
                  ) : estimatedCost > 0 ? (
                    <span className="text-[11px] font-bold">{estimatedCost}</span>
                  ) : null}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ImageViewer src={viewerUrl} open={viewerOpen} onClose={() => setViewerOpen(false)} type={(isVideoTool || isAvatarTool) ? "video" : "image"} />

      {/* Media picker dialogs */}
      <MediaPickerDialog
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        mediaType="image"
        onSelect={(url) => {
          if (avatarImage?.preview?.startsWith("blob:")) URL.revokeObjectURL(avatarImage.preview);
          setAvatarImage({ preview: url, sourceUrl: url });
        }}
      />
      <MediaPickerDialog
        open={audioPickerOpen}
        onClose={() => setAudioPickerOpen(false)}
        mediaType="audio"
        onSelect={async (url, fileName) => {
          await applyAvatarAudioFromSource(url, fileName || "library_audio.mp3");
        }}
      />
    </div>
  );
};

export default StudioPage;
