import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Menu,
  X,
  Play,
  Pause,
  Download,
  Trash2,
  Volume2,
  Mic,
  Sparkles,
  Loader2,
  Library,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePricing } from "@/hooks/use-pricing";

// ─── Official Gemini Voices (all 30) ───
interface GeminiVoice {
  name: string;
  label: string;
  gender: "male" | "female";
  trait: string;
  description: string;
}

// ─── Fusion Voice tiers ───
type VoiceTier = "standard" | "pro";

interface VoiceTierConfig {
  id: VoiceTier;
  label: string;
  badge: string;
  modelId: string;
  geminiModel: string;
  description: string;
}

const VOICE_TIERS: Record<VoiceTier, VoiceTierConfig> = {
  standard: {
    id: "standard",
    label: "Fusion Voice",
    badge: "Gemini 2.5",
    modelId: "gemini-tts",
    geminiModel: "gemini-2.5-flash-preview-tts",
    description: "أصوات طبيعية بأداء عربي ممتاز — مدعوم بـ Gemini 2.5 Flash TTS.",
  },
  pro: {
    id: "pro",
    label: "Fusion Voice Pro",
    badge: "Gemini 3.1 · Audio Tags",
    modelId: "gemini-tts-pro",
    geminiModel: "gemini-3.1-flash-tts-preview",
    description: "النموذج الأحدث بأعلى جودة وتعبير، مع دعم Audio Tags إنجليزية لتحكم دقيق.",
  },
};

const STORAGE_KEY_TIER = "fusion-voice-tier";
const STORAGE_KEY_VOICE = "fusion-voice-selected";

const geminiVoices: GeminiVoice[] = [
  // ─── Male Voices (17) ───
  { name: "Puck", label: "حيدر", gender: "male", trait: "حيوي", description: "صوت شاب حماسي ومفعم بالطاقة" },
  { name: "Charon", label: "كريم", gender: "male", trait: "إخباري", description: "صوت عميق ورصين للسرد والأخبار" },
  { name: "Fenrir", label: "باسل", gender: "male", trait: "متحمس", description: "صوت حاد وجريء مليء بالحماس" },
  { name: "Orus", label: "عمر", gender: "male", trait: "حازم", description: "صوت واضح ومهني وحازم" },
  { name: "Achird", label: "سامر", gender: "male", trait: "ودود", description: "صوت دافئ وودود وقريب من المستمع" },
  { name: "Algenib", label: "ثامر", gender: "male", trait: "خشن", description: "صوت غليظ وخشن ذو طابع قوي" },
  { name: "Alnilam", label: "فاضل", gender: "male", trait: "صارم", description: "صوت رسمي وصارم ومتماسك" },
  { name: "Iapetus", label: "ياسر", gender: "male", trait: "صافي", description: "صوت صافي ونقي ومتوازن" },
  { name: "Umbriel", label: "رائد", gender: "male", trait: "مريح", description: "صوت هادئ ومسترخي ومريح للسمع" },
  { name: "Gacrux", label: "أبو حسن", gender: "male", trait: "ناضج", description: "صوت ناضج وعميق بخبرة واضحة" },
  { name: "Rasalgethi", label: "منير", gender: "male", trait: "معلوماتي", description: "صوت واثق مناسب للشرح والتعليم" },
  { name: "Schedar", label: "وليد", gender: "male", trait: "متزن", description: "صوت ثابت ومتزن ومحايد" },
  { name: "Sadachbia", label: "مصطفى", gender: "male", trait: "نشيط", description: "صوت حيوي ونشيط ومبتهج" },
  { name: "Sadaltager", label: "طارق", gender: "male", trait: "عارف", description: "صوت حكيم ومتمكن وواسع المعرفة" },
  { name: "Zubenelgenubi", label: "علي", gender: "male", trait: "عفوي", description: "صوت عفوي وطبيعي للمحادثات اليومية" },
  { name: "Enceladus", label: "همام", gender: "male", trait: "هامس", description: "صوت ناعم وهامس ذو نفس عميق" },
  { name: "Algieba", label: "نبيل", gender: "male", trait: "ناعم", description: "صوت أنيق وناعم وسلس" },

  // ─── Female Voices (13) ───
  { name: "Kore", label: "زينب", gender: "female", trait: "حازمة", description: "صوت أنثوي قوي وحازم وواثق" },
  { name: "Zephyr", label: "نور", gender: "female", trait: "مشرقة", description: "صوت مشرق وحيوي مليء بالنشاط" },
  { name: "Leda", label: "سارة", gender: "female", trait: "شابة", description: "صوت شبابي ناعم ومفعم بالحيوية" },
  { name: "Aoede", label: "ريم", gender: "female", trait: "منعشة", description: "صوت منعش وخفيف كنسيم الصباح" },
  { name: "Achernar", label: "هديل", gender: "female", trait: "ناعمة", description: "صوت ناعم وهادئ ومريح جداً" },
  { name: "Pulcherrima", label: "مريم", gender: "female", trait: "جريئة", description: "صوت أنثوي جريء وواضح ومباشر" },
  { name: "Vindemiatrix", label: "لمى", gender: "female", trait: "رقيقة", description: "صوت رقيق ولطيف وهادئ" },
  { name: "Sulafat", label: "دانية", gender: "female", trait: "دافئة", description: "صوت دافئ وحنون ومطمئن" },
  { name: "Laomedeia", label: "فرح", gender: "female", trait: "مبتهجة", description: "صوت مبتهج ومتفائل ومرح" },
  { name: "Autonoe", label: "آلاء", gender: "female", trait: "ساطعة", description: "صوت ساطع وواضح ونقي" },
  { name: "Callirrhoe", label: "رغد", gender: "female", trait: "مسترخية", description: "صوت مسترخي وطبيعي وعفوي" },
  { name: "Despina", label: "جنى", gender: "female", trait: "سلسة", description: "صوت سلس وانسيابي وراقي" },
  { name: "Erinome", label: "حلا", gender: "female", trait: "واضحة", description: "صوت واضح ونظيف ودقيق النطق" },
];

// ─── Enhancement Presets ───
const presets = [
  { label: "محادثة يومية", style: "كلام يومي طبيعي، بدون تكلف، قريب من السامع" },
  { label: "خبر", style: "نبرة إخبارية واضحة، رسمية قليلاً، سرعة متوسطة" },
  { label: "إعلان", style: "صوت حماسي، طاقة عالية، جذب انتباه" },
  { label: "إنفلونسر", style: "كلام عفوي، مرح، شبابي، طاقة إيجابية" },
];

// ─── Inline Tags with Emoji ───
interface InlineTag {
  id: string;
  emoji: string;
  label: string;
  tag: string; // the actual tag sent to backend
}

// Tags categorized by valid placement:
// "start" = can appear at beginning of speech
// "mid" = can appear between words/sentences (not at start)
// "any" = can appear anywhere
const inlineTags: InlineTag[] = [
  // ── Pauses: only mid/end, never at the start ──
  { id: "short-pause", emoji: "⏸️", label: "وقفة قصيرة", tag: "..." },
  { id: "medium-pause", emoji: "⏯️", label: "وقفة متوسطة", tag: "...... " },
  { id: "long-pause", emoji: "⏹️", label: "وقفة طويلة", tag: "......... " },
  // ── Emotions/Effects: can appear at start or mid ──
  { id: "whispering", emoji: "🤫", label: "همس", tag: "*يهمس*" },
  { id: "shouting", emoji: "🗣️", label: "صراخ", tag: "*يصرخ*" },
  { id: "sarcasm", emoji: "😏", label: "سخرية", tag: "*بسخرية*" },
  { id: "laughing", emoji: "😂", label: "ضحك", tag: "*يضحك* هههه" },
  { id: "sigh", emoji: "😮‍💨", label: "تنهيدة", tag: "*تنهيدة* آه" },
  { id: "fast", emoji: "⚡", label: "سريع", tag: "*بسرعة*" },
  { id: "scared", emoji: "😨", label: "خوف", tag: "*بخوف*" },
  { id: "curious", emoji: "🤔", label: "فضول", tag: "*بفضول*" },
  { id: "bored", emoji: "😑", label: "ملل", tag: "*بملل*" },
  { id: "uhm", emoji: "🤨", label: "تردد", tag: "اممم" },
  { id: "gasp", emoji: "😲", label: "شهقة", tag: "*شهقة*" },
];

// ─── Pro Audio Tags (English brackets, official Gemini 3.1 syntax) ───
interface ProAudioTag {
  id: string;
  emoji: string;
  label: string;
  tag: string; // English bracket tag, e.g. "[whispers]"
}

const proAudioTags: ProAudioTag[] = [
  { id: "p-whispers", emoji: "🤫", label: "همس", tag: "[whispers]" },
  { id: "p-shouting", emoji: "🗣️", label: "صراخ", tag: "[shouting]" },
  { id: "p-laughs", emoji: "😂", label: "ضحك", tag: "[laughs]" },
  { id: "p-giggles", emoji: "😊", label: "ضحكة خفيفة", tag: "[giggles]" },
  { id: "p-sighs", emoji: "😮‍💨", label: "تنهيدة", tag: "[sighs]" },
  { id: "p-gasp", emoji: "😲", label: "شهقة", tag: "[gasp]" },
  { id: "p-sarcastic", emoji: "😏", label: "سخرية", tag: "[sarcastic]" },
  { id: "p-excited", emoji: "🤩", label: "حماس", tag: "[excited]" },
  { id: "p-amazed", emoji: "😍", label: "إعجاب", tag: "[amazed]" },
  { id: "p-curious", emoji: "🤔", label: "فضول", tag: "[curious]" },
  { id: "p-bored", emoji: "😑", label: "ملل", tag: "[bored]" },
  { id: "p-tired", emoji: "😴", label: "تعب", tag: "[tired]" },
  { id: "p-panicked", emoji: "😨", label: "ذعر", tag: "[panicked]" },
  { id: "p-trembling", emoji: "😟", label: "ارتجاف", tag: "[trembling]" },
  { id: "p-serious", emoji: "😐", label: "جدية", tag: "[serious]" },
  { id: "p-mischievous", emoji: "😈", label: "مكر", tag: "[mischievously]" },
  { id: "p-crying", emoji: "😢", label: "بكاء", tag: "[crying]" },
  { id: "p-fast", emoji: "⚡", label: "سريع", tag: "[very fast]" },
  { id: "p-slow", emoji: "🐢", label: "بطيء", tag: "[very slow]" },
];

// Build emoji↔tag maps (combined for both standard and pro)
const allTagsForMaps = [...inlineTags, ...proAudioTags];
const emojiToTag = new Map(allTagsForMaps.map((t) => [t.emoji, t.tag]));
const tagToEmoji = new Map(allTagsForMaps.map((t) => [t.tag, t.emoji]));

// Convert emojis back to [tags] before sending to backend
function emojisToTags(input: string): string {
  let result = input;
  for (const [emoji, tag] of emojiToTag) {
    result = result.split(emoji).join(tag);
  }
  return result;
}

function tagsToEmojis(input: string): string {
  let result = input;
  for (const [tag, emoji] of tagToEmoji) {
    result = result.split(tag).join(emoji);
  }
  return result;
}

const AudioStudioPage = () => {
  const navigate = useNavigate();
  const { user, credits, refreshCredits } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  // ─── Per-character TTS pricing ───
  const MAX_TTS_CHARS = 5000;

  // ─── State ───
  const [voiceTier, setVoiceTier] = useState<VoiceTier>(() => {
    if (typeof window === "undefined") return "standard";
    const saved = localStorage.getItem(STORAGE_KEY_TIER);
    return saved === "pro" ? "pro" : "standard";
  });
  const tierConfig = VOICE_TIERS[voiceTier];

  const [styleInstruction, setStyleInstruction] = useState("");
  const [text, setText] = useState("");
  const [voiceGenderTab, setVoiceGenderTab] = useState<"male" | "female">("male");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIER, voiceTier);
  }, [voiceTier]);

  // Count only spoken characters (exclude emoji tags)
  const getSpokenCharCount = useCallback((input: string): number => {
    let clean = input;
    for (const [emoji] of emojiToTag) clean = clean.split(emoji).join("");
    return clean.replace(/\s+/g, " ").trim().length;
  }, []);

  const charCount = useMemo(() => getSpokenCharCount(text), [text, getSpokenCharCount]);
  const isOverLimit = charCount > MAX_TTS_CHARS;

  // Dynamic pricing based on character count + selected tier
  const pricingParams = useMemo(() => ({
    model: tierConfig.modelId,
    resolution: null,
    quality: null,
    durationSeconds: null,
    hasAudio: null,
    characterCount: charCount > 0 ? charCount : null,
  }), [charCount, tierConfig.modelId]);

  const { price } = usePricing(pricingParams);
  const estimatedCost = price?.credits ?? 0;
  const insufficientCredits = charCount > 0 && credits < estimatedCost;

  // Persist selected voice across sessions AND generations
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice>(() => {
    if (typeof window === "undefined") return geminiVoices[0];
    const saved = localStorage.getItem(STORAGE_KEY_VOICE);
    const found = saved ? geminiVoices.find((v) => v.name === saved) : null;
    return found || geminiVoices[0];
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOICE, selectedVoice.name);
  }, [selectedVoice.name]);

  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [stability, setStability] = useState(0.7);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [librarySidebarOpen, setLibrarySidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // ─── Audio Library State ───
  interface AudioGeneration {
    id: string;
    tool_id: string;
    tool_name: string | null;
    prompt: string | null;
    file_url: string;
    file_type: string;
    created_at: string;
  }
  const [audioLibrary, setAudioLibrary] = useState<AudioGeneration[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [playingLibId, setPlayingLibId] = useState<string | null>(null);
  const [deletingLibId, setDeletingLibId] = useState<string | null>(null);
  const libAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAudioLibrary = useCallback(async () => {
    if (!user) return;
    setLibraryLoading(true);
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("file_type", "audio")
      .order("created_at", { ascending: false });
    setAudioLibrary((data as AudioGeneration[]) || []);
    setLibraryLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchAudioLibrary();
  }, [user, fetchAudioLibrary]);

  const handleLibPlay = (item: AudioGeneration) => {
    if (playingLibId === item.id) {
      libAudioRef.current?.pause();
      setPlayingLibId(null);
      return;
    }
    if (libAudioRef.current) libAudioRef.current.pause();
    const audio = new Audio(item.file_url);
    libAudioRef.current = audio;
    audio.play();
    setPlayingLibId(item.id);
    audio.onended = () => setPlayingLibId(null);
  };

  const handleLibDownload = async (item: AudioGeneration) => {
    try {
      const res = await fetch(item.file_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `audio_${item.id.slice(0, 6)}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("فشل في التحميل");
    }
  };

  const handleLibDelete = async (item: AudioGeneration) => {
    setDeletingLibId(item.id);
    try {
      const urlParts = item.file_url.split("/generations/");
      if (urlParts[1]) {
        await supabase.storage.from("generations").remove([decodeURIComponent(urlParts[1])]);
      }
      await supabase.from("generations").delete().eq("id", item.id);
      setAudioLibrary((prev) => prev.filter((g) => g.id !== item.id));
      toast.success("تم الحذف");
    } catch {
      toast.error("فشل في الحذف");
    } finally {
      setDeletingLibId(null);
    }
  };

  const maleVoices = useMemo(() => geminiVoices.filter((v) => v.gender === "male"), []);
  const femaleVoices = useMemo(() => geminiVoices.filter((v) => v.gender === "female"), []);

  const base64ToAudioUrl = (base64: string, mimeType: string): string => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("اكتب النص المراد تحويله إلى صوت");
      return;
    }
    if (isOverLimit) {
      toast.error(`تجاوزت الحد الأقصى (${MAX_TTS_CHARS} حرف). عدد الأحرف الحالي: ${charCount}`);
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
    const idempotencyKey = `tts_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let reservationId: string | null = null;
    
    try {
      // Always use Iraqi dialect as default
      const dialectHint = "لهجة عراقية عامية طبيعية";
      // Convert emojis to tags before sending
      const textForBackend = emojisToTags(text);

      // ── Step 1: Start generation (server: auth → entitlement → price → reserve → TTS) ──
      const { data: startResult, error: startError } = await supabase.functions.invoke("start-generation", {
        body: {
          toolId: tierConfig.modelId,
          model: tierConfig.modelId,
          apiType: "tts",
          characterCount: charCount,
          idempotencyKey,
          ttsParams: {
            text: textForBackend,
            voiceName: selectedVoice.name,
            styleInstruction: styleInstruction.trim(),
            speakingRate,
            pitch,
            stability,
            dialectHint,
            // Do NOT auto-inject generic emotionHint/toneHint — they dilute the
            // user's real style direction and make all voices sound similar.
            emotionHint: "",
            toneHint: "",
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
          toast.error("ليس لديك صلاحية لاستخدام هذه الأداة");
          return;
        }
        if (err === "provider_error") {
          toast.error("خطأ مؤقت في مزود الخدمة. يرجى المحاولة لاحقاً. لم يتم خصم أي رصيد.");
          return;
        }
        throw new Error(startResult?.message || err || "فشل بدء التوليد");
      }

      reservationId = startResult.reservationId;

      if (startResult?.audioBase64) {
        // Cleanup previous URL
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const localUrl = base64ToAudioUrl(startResult.audioBase64, startResult.mimeType || "audio/wav");
        setAudioUrl(localUrl);
        toast.success("تم توليد الصوت بنجاح!");

        // Upload audio to persistent storage
        const ext = (startResult.mimeType || "audio/wav").includes("wav") ? "wav" : "mp3";
        const fileName = `tts_${user.id}_${Date.now()}.${ext}`;
        const byteChars = atob(startResult.audioBase64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const audioBlob = new Blob([byteArray], { type: startResult.mimeType || "audio/wav" });

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("generations")
          .upload(`${user.id}/audio/${fileName}`, audioBlob, { contentType: startResult.mimeType || "audio/wav", upsert: false });

        let permanentUrl: string | null = null;
        if (!uploadError && uploadData?.path) {
          const { data: publicData } = supabase.storage.from("generations").getPublicUrl(uploadData.path);
          permanentUrl = publicData?.publicUrl || null;
        }

        if (!permanentUrl) {
          console.error("Audio upload failed, cannot save with blob URL:", uploadError);
          toast.error("تم التوليد لكن فشل رفع الملف الصوتي — حاول مرة أخرى");
          // Release credits since we can't persist the file
          if (reservationId) {
            await supabase.functions.invoke("complete-generation", {
              body: { reservationId, status: "failed", errorMessage: "Storage upload failed", providerFailState: "storage_upload_failed" },
            });
          }
          await refreshCredits();
          return;
        }

        // Settle credits + save generation via complete-generation
        if (reservationId) {
          const { data: completeResult, error: completeError } = await supabase.functions.invoke("complete-generation", {
            body: {
              reservationId,
              status: "success",
              toolId: "gemini-tts",
              toolName: `Gemini TTS - ${selectedVoice.label}`,
              prompt: text.slice(0, 200),
              fileUrl: permanentUrl,
              fileType: "audio",
              metadata: { voice: selectedVoice.name, styleInstruction, speakingRate, pitch, stability },
            },
          });
          if (completeError || !completeResult?.success) {
            console.error("Settlement failed:", completeError || completeResult);
            toast.error("تم التوليد لكن فشل تأكيد الخصم — سيتم المراجعة تلقائياً");
          } else {
            reservationId = null;
          }
        }

        await refreshCredits();
        await fetchAudioLibrary();
      } else {
        throw new Error("لم يتم توليد صوت");
      }
    } catch (err: unknown) {
      // Release reserved credits on failure
      if (reservationId) {
        try {
          await supabase.functions.invoke("complete-generation", {
            body: { reservationId, status: "failed", errorMessage: err instanceof Error ? err.message : "Unknown error", providerFailState: "tts_error" },
          });
        } catch (releaseErr) {
          console.error("Failed to release credits:", releaseErr);
        }
      }
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
      await refreshCredits();
    } finally {
      setLoading(false);
    }
  };

  // Keep ref to currently-playing preview audio so we can cancel it
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreviewVoice = async (voice?: GeminiVoice) => {
    const v = voice || selectedVoice;

    // Stop any prior preview / library audio so playback isn't blocked
    if (previewAudioRef.current) {
      try { previewAudioRef.current.pause(); } catch { /* noop */ }
      previewAudioRef.current = null;
    }
    if (libAudioRef.current) {
      try { libAudioRef.current.pause(); } catch { /* noop */ }
    }

    setPreviewingVoice(v.name);
    try {
      const { data, error } = await supabase.functions.invoke("gemini-tts", {
        body: {
          action: "preview",
          prebuiltModel: tierConfig.geminiModel,
          voiceName: v.name,
          previewText: "مرحباً، أنا صوتك الجديد. كيف أبدو؟",
          styleInstruction: styleInstruction.trim(),
          dialectHint: "لهجة عراقية عامية طبيعية",
          // Keep previews clean — let the chosen voice's natural character come through.
          emotionHint: "",
          toneHint: "",
          stability,
        },
      });
      if (error) {
        console.error("Preview invoke error:", error);
        throw new Error(error.message || "فشل استدعاء المعاينة");
      }
      if (data?.error) {
        console.error("Preview server error:", data);
        throw new Error(typeof data.error === "string" ? data.error : "خطأ من الخادم");
      }
      if (!data?.audioBase64) {
        throw new Error("لم يتم استلام صوت من المعاينة");
      }
      const url = base64ToAudioUrl(data.audioBase64, data.mimeType || "audio/wav");
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (previewAudioRef.current === audio) previewAudioRef.current = null;
      };
      try {
        await audio.play();
      } catch (playErr) {
        URL.revokeObjectURL(url);
        throw new Error("المتصفح منع التشغيل التلقائي. اضغط زر المعاينة مرة أخرى.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطأ في المعاينة");
    } finally {
      setPreviewingVoice(null);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `tts_${selectedVoice.name}_${Date.now()}.wav`;
    a.click();
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: InlineTag) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + ` ${tag.emoji} `);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const insertion = ` ${tag.emoji} `;
    const newText = before + insertion + after;
    setText(newText);
    // Restore cursor position after the inserted emoji
    requestAnimationFrame(() => {
      const newPos = start + insertion.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  const applyPreset = (style: string) => {
    setStyleInstruction(style);
    toast.success("تم تطبيق القالب");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
      setAudioDuration(audioRef.current.duration || 0);
    }
  }, []);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="shrink-0 bg-nav-bg/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 z-50">
        <div className="flex items-center justify-between w-full">
          {/* Right side (start in RTL): Voice settings sidebar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors lg:hidden"
            >
              <Menu className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
              {tierConfig.label} · {selectedVoice.label}
            </span>
          </div>

          {/* Center: Title */}
          <h1 className="text-base font-bold text-foreground">استوديو الصوت</h1>

          {/* Left side (end in RTL): Library + Back */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLibrarySidebarOpen(true)}
              className="w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors relative"
            >
              <Library className="w-4 h-4 text-muted-foreground" />
              {audioLibrary.length > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {audioLibrary.length}
                </span>
              )}
            </button>
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Desktop: two columns */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="w-full flex flex-col lg:flex-row gap-6">
          {/* Left Column - Main content */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* ─── Voice Tier Tabs (Fusion Voice / Fusion Voice Pro) ─── */}
            <div className="space-y-2">
              <div className="flex rounded-xl bg-secondary/40 p-1 border border-border/40">
                {(Object.keys(VOICE_TIERS) as VoiceTier[]).map((tierId) => {
                  const t = VOICE_TIERS[tierId];
                  const active = voiceTier === tierId;
                  return (
                    <button
                      key={tierId}
                      onClick={() => setVoiceTier(tierId)}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold">{t.label}</span>
                      <span className={`text-[9px] ${active ? "opacity-90" : "opacity-60"}`}>
                        {t.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                {tierConfig.description}
              </p>
            </div>

            {/* Style Instructions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                أسلوب الأداء
              </label>
              <Textarea
                value={styleInstruction}
                onChange={(e) => setStyleInstruction(e.target.value)}
                placeholder="مثال: رجل عراقي متوسط العمر، لهجة عامية، نبرة طبيعية وقريبة من المستمع..."
                className="min-h-[80px] bg-card border-border/50 text-sm resize-none focus:border-primary/50"
                dir="rtl"
              />
              {/* Enhancement Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.style)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-secondary border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                النص
              </label>
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  const newText = tagsToEmojis(e.target.value);
                  setText(newText);
                }}
                placeholder="اكتب النص الذي تريد تحويله إلى صوت..."
                className={`min-h-[120px] lg:min-h-[180px] bg-card border-border/50 text-sm resize-none focus:border-primary/50 ${isOverLimit ? "border-destructive focus:border-destructive" : ""}`}
                dir="rtl"
              />
              {/* Character counter & cost indicator */}
              <div className="flex items-center justify-between text-[10px] px-1">
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${isOverLimit ? "text-destructive font-bold" : charCount > MAX_TTS_CHARS * 0.8 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {charCount.toLocaleString()} / {MAX_TTS_CHARS.toLocaleString()} حرف
                  </span>
                  {charCount > 0 && (
                    <span className="text-muted-foreground">
                      ({(price?.perCharRate ?? 0.005).toFixed(3)} كريديت/حرف)
                    </span>
                  )}
                </div>
                {charCount > 0 && (
                  <span className="text-primary font-bold">
                    {estimatedCost} كريديت
                  </span>
                )}
              </div>
              {/* Inline Tags - switch by tier (Standard = Arabic emoji tags, Pro = English Audio Tags) */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                {voiceTier === "standard"
                  ? inlineTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => insertTag({ id: tag.id, emoji: tag.emoji, label: tag.label, tag: tag.tag })}
                        title={tag.label}
                        className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-foreground transition-all border border-primary/10 hover:border-primary/30"
                      >
                        <span className="text-sm">{tag.emoji}</span>
                        <span className="text-[10px] text-muted-foreground">{tag.label}</span>
                      </button>
                    ))
                  : proAudioTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => insertTag({ id: tag.id, emoji: tag.emoji, label: tag.label, tag: tag.tag })}
                        title={`${tag.label} — ${tag.tag}`}
                        className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-foreground transition-all border border-primary/10 hover:border-primary/30"
                      >
                        <span className="text-sm">{tag.emoji}</span>
                        <span className="text-[10px] text-muted-foreground">{tag.label}</span>
                      </button>
                    ))}
              </div>
            </div>

            {/* Audio Player - Always visible */}
            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
              <audio
                ref={audioRef}
                src={audioUrl || undefined}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={handleTimeUpdate}
              />

              {/* Waveform-style progress */}
              <div className="relative h-12 flex items-center gap-[2px] px-2">
                {Array.from({ length: 60 }).map((_, i) => {
                  const filled = audioDuration > 0 && (i / 60) <= (audioProgress / audioDuration);
                  const height = 15 + Math.sin(i * 0.5) * 10 + Math.sin(i * 1.3) * 5;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-colors duration-150 cursor-pointer ${
                        !audioUrl ? "bg-secondary/50" : filled ? "bg-primary" : "bg-secondary"
                      }`}
                      style={{ height: `${height}px` }}
                      onClick={() => {
                        if (audioRef.current && audioDuration > 0) {
                          audioRef.current.currentTime = (i / 60) * audioDuration;
                        }
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2">
                <span>{formatTime(audioProgress)}</span>
                <span>{audioDuration > 0 ? formatTime(audioDuration) : "0:00"}</span>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={togglePlay}
                  disabled={!audioUrl}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                    audioUrl
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={loading || !text.trim() || insufficientCredits || isOverLimit}
                className={`flex-1 gap-2 h-11 rounded-xl text-sm font-bold shadow-md ${insufficientCredits ? "bg-destructive hover:bg-destructive/90" : ""}`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? "جاري التوليد..." : (
                  <span className="flex items-center gap-1.5">
                    توليد الصوت
                    {estimatedCost > 0 && (
                      <span className="text-xs font-bold opacity-90">{estimatedCost}</span>
                    )}
                  </span>
                )}
              </Button>

              <Button variant="outline" onClick={handleDownload} disabled={!audioUrl} className="gap-2">
                <Download className="w-4 h-4" />
                تحميل
              </Button>

              <Button
                variant="outline"
                disabled={!audioUrl}
                className="gap-2"
                onClick={() => {
                  if (!audioUrl) return;
                  // Store audio URL in sessionStorage and navigate to avatar studio
                  sessionStorage.setItem("avatar-audio-url", audioUrl);
                  sessionStorage.setItem("avatar-audio-name", `صوت_${selectedVoice.label}_${Date.now()}`);
                  navigate("/studio/avatar");
                }}
              >
                <Video className="w-4 h-4" />
                استخدام في أفتار
              </Button>
            </div>
          </div>

          {/* Right Column - Desktop inline voice settings (hidden on mobile, shown on lg+) */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4 sticky top-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" />
                إعدادات الصوت
              </h2>

              {/* Gender Tabs */}
              <div className="flex rounded-lg bg-secondary/50 p-0.5">
                <button
                  onClick={() => setVoiceGenderTab("male")}
                  className={`flex-1 text-xs py-2 rounded-md font-semibold transition-all ${
                    voiceGenderTab === "male" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  أصوات الرجال ({maleVoices.length})
                </button>
                <button
                  onClick={() => setVoiceGenderTab("female")}
                  className={`flex-1 text-xs py-2 rounded-md font-semibold transition-all ${
                    voiceGenderTab === "female" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  أصوات النساء ({femaleVoices.length})
                </button>
              </div>

              {/* Voice List */}
              <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-hide">
                {(voiceGenderTab === "male" ? maleVoices : femaleVoices).map((v) => (
                  <div
                    key={v.name}
                    onClick={() => setSelectedVoice(v)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      selectedVoice.name === v.name
                        ? "bg-primary/15 border border-primary/30"
                        : "hover:bg-secondary/50 border border-transparent"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      selectedVoice.name === v.name ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}>
                      {v.label[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold ${selectedVoice.name === v.name ? "text-primary" : "text-foreground"}`}>
                          {v.label}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{v.trait}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{v.description}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v); }}
                      disabled={previewingVoice === v.name}
                      className="w-6 h-6 rounded-full flex items-center justify-center bg-secondary hover:bg-primary/20 transition-colors shrink-0"
                    >
                      {previewingVoice === v.name ? (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      ) : (
                        <Play className="w-3 h-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">السرعة</label>
                  <span className="text-[10px] text-primary font-mono">{speakingRate.toFixed(1)}x</span>
                </div>
                <Slider value={[speakingRate]} onValueChange={([v]) => setSpeakingRate(v)} min={0.5} max={2.0} step={0.1} />
              </div>

              {/* Stability */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">الثبات</label>
                  <span className="text-[10px] text-primary font-mono">{(stability * 100).toFixed(0)}%</span>
                </div>
                <Slider value={[stability]} onValueChange={([v]) => setStability(v)} min={0} max={1} step={0.05} />
              </div>

              {/* Pitch */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">درجة الصوت</label>
                  <span className="text-[10px] text-primary font-mono">{pitch > 0 ? "+" : ""}{pitch}</span>
                </div>
                <Slider value={[pitch]} onValueChange={([v]) => setPitch(v)} min={-10} max={10} step={1} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Voice Settings Sidebar (Mobile only) ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-card/95 backdrop-blur-xl border-l border-border/50 z-[70] flex flex-col rounded-tl-2xl rounded-bl-2xl overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="shrink-0 px-4 py-4 border-b border-border/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  إعدادات الصوت
                </h2>
                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Gender Tabs */}
                <div className="flex rounded-lg bg-secondary/50 p-0.5">
                  <button
                    onClick={() => setVoiceGenderTab("male")}
                    className={`flex-1 text-xs py-2 rounded-md font-semibold transition-all ${
                      voiceGenderTab === "male" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    أصوات الرجال ({maleVoices.length})
                  </button>
                  <button
                    onClick={() => setVoiceGenderTab("female")}
                    className={`flex-1 text-xs py-2 rounded-md font-semibold transition-all ${
                      voiceGenderTab === "female" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    أصوات النساء ({femaleVoices.length})
                  </button>
                </div>

                {/* Voice List */}
                <div className="space-y-1">
                  {(voiceGenderTab === "male" ? maleVoices : femaleVoices).map((v) => (
                    <div
                      key={v.name}
                      onClick={() => setSelectedVoice(v)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        selectedVoice.name === v.name
                          ? "bg-primary/15 border border-primary/30"
                          : "hover:bg-secondary/50 border border-transparent"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        selectedVoice.name === v.name ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}>
                        {v.label[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-semibold ${selectedVoice.name === v.name ? "text-primary" : "text-foreground"}`}>
                            {v.label}
                          </p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{v.trait}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{v.description}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v); }}
                        disabled={previewingVoice === v.name}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-secondary hover:bg-primary/20 transition-colors shrink-0"
                      >
                        {previewingVoice === v.name ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">السرعة</label>
                    <span className="text-[10px] text-primary font-mono">{speakingRate.toFixed(1)}x</span>
                  </div>
                  <Slider value={[speakingRate]} onValueChange={([v]) => setSpeakingRate(v)} min={0.5} max={2.0} step={0.1} />
                </div>

                {/* Stability */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">الثبات</label>
                    <span className="text-[10px] text-primary font-mono">{(stability * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[stability]} onValueChange={([v]) => setStability(v)} min={0} max={1} step={0.05} />
                </div>

                {/* Pitch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">درجة الصوت</label>
                    <span className="text-[10px] text-primary font-mono">{pitch > 0 ? "+" : ""}{pitch}</span>
                  </div>
                  <Slider value={[pitch]} onValueChange={([v]) => setPitch(v)} min={-10} max={10} step={1} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Audio Library Sidebar (slides from LEFT) ─── */}
      <AnimatePresence>
        {librarySidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setLibrarySidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-card/95 backdrop-blur-xl border-r border-border/50 z-[70] flex flex-col rounded-tr-2xl rounded-br-2xl overflow-hidden"
            >
              {/* Library Header */}
              <div className="shrink-0 px-4 py-4 border-b border-border/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Library className="w-4 h-4 text-primary" />
                  مكتبة الأصوات
                </h2>
                <button onClick={() => setLibrarySidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Library Content */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-hide" dir="rtl">
                {libraryLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : audioLibrary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Volume2 className="w-10 h-10 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">لا توجد أصوات مولدة</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">ستظهر هنا بعد التوليد</p>
                  </div>
                ) : (
                  audioLibrary.map((item) => (
                    <div
                      key={item.id}
                      className="bg-secondary/30 border border-border/20 rounded-xl p-3 space-y-2"
                    >
                      {/* Info */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-primary font-medium">{item.tool_name || "Gemini TTS"}</p>
                          {item.prompt && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{item.prompt}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                            {new Date(item.created_at).toLocaleDateString("ar-IQ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleLibPlay(item)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                            playingLibId === item.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-secondary/80 text-foreground"
                          }`}
                        >
                          {playingLibId === item.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {playingLibId === item.id ? "إيقاف" : "تشغيل"}
                        </button>
                        <button
                          onClick={() => handleLibDownload(item)}
                          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                          title="تحميل"
                        >
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            sessionStorage.setItem("avatar-audio-url", item.file_url);
                            sessionStorage.setItem("avatar-audio-name", item.prompt?.slice(0, 30) || "مقطع صوتي");
                            navigate("/studio/avatar");
                          }}
                          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                          title="استخدام في أفتار"
                        >
                          <Video className="w-3.5 h-3.5 text-primary" />
                        </button>
                        <button
                          onClick={() => handleLibDelete(item)}
                          disabled={deletingLibId === item.id}
                          className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioStudioPage;
