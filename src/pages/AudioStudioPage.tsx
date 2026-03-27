import { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  ArrowRight,
  Menu,
  X,
  Play,
  Pause,
  Download,
  Send,
  Volume2,
  Mic,
  Sparkles,
  Loader2,
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

const GEMINI_FLASH_TTS_MODEL = "gemini-2.5-flash-preview-tts";

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

const inlineTags: InlineTag[] = [
  { id: "short-pause", emoji: "⏸️", label: "وقفة قصيرة", tag: "[short pause]" },
  { id: "medium-pause", emoji: "⏯️", label: "وقفة متوسطة", tag: "[medium pause]" },
  { id: "long-pause", emoji: "⏹️", label: "وقفة طويلة", tag: "[long pause]" },
  { id: "whispering", emoji: "🤫", label: "همس", tag: "[whispering]" },
  { id: "shouting", emoji: "🗣️", label: "صراخ", tag: "[shouting]" },
  { id: "sarcasm", emoji: "😏", label: "سخرية", tag: "[sarcasm]" },
  { id: "laughing", emoji: "😂", label: "ضحك", tag: "[laughing]" },
  { id: "sigh", emoji: "😮‍💨", label: "تنهيدة", tag: "[sigh]" },
  { id: "fast", emoji: "⚡", label: "سريع", tag: "[fast]" },
  { id: "scared", emoji: "😨", label: "خوف", tag: "[scared]" },
  { id: "curious", emoji: "🤔", label: "فضول", tag: "[curious]" },
  { id: "bored", emoji: "😑", label: "ملل", tag: "[bored]" },
  { id: "uhm", emoji: "🤨", label: "تردد", tag: "[uhm]" },
  { id: "gasp", emoji: "😲", label: "شهقة", tag: "[gasp]" },
];

// Build emoji↔tag maps
const emojiToTag = new Map(inlineTags.map((t) => [t.emoji, t.tag]));
const tagToEmoji = new Map(inlineTags.map((t) => [t.tag, t.emoji]));

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
  const [styleInstruction, setStyleInstruction] = useState("");
  const [text, setText] = useState("");
  const [voiceGenderTab, setVoiceGenderTab] = useState<"male" | "female">("male");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  // Count only spoken characters (exclude emoji tags)
  const getSpokenCharCount = useCallback((input: string): number => {
    let clean = input;
    for (const [emoji] of emojiToTag) clean = clean.split(emoji).join("");
    return clean.replace(/\s+/g, " ").trim().length;
  }, []);

  const charCount = useMemo(() => getSpokenCharCount(text), [text, getSpokenCharCount]);
  const isOverLimit = charCount > MAX_TTS_CHARS;

  // Dynamic pricing based on character count
  const pricingParams = useMemo(() => ({
    model: "gemini-tts",
    resolution: null,
    quality: null,
    durationSeconds: null,
    hasAudio: null,
    characterCount: charCount > 0 ? charCount : null,
  }), [charCount]);

  const { price } = usePricing(pricingParams);
  const estimatedCost = price?.credits ?? 0;
  const insufficientCredits = charCount > 0 && credits < estimatedCost;

  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice>(geminiVoices[0]);
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [stability, setStability] = useState(0.7);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

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
          toolId: "gemini-tts",
          model: "gemini-tts",
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
            emotionHint: styleInstruction.trim() ? "طبيعي وبشري" : "",
            toneHint: styleInstruction.trim() ? "واضح وقريب من المستمع" : "",
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
          .upload(`audio/${fileName}`, audioBlob, { contentType: startResult.mimeType || "audio/wav", upsert: false });

        let permanentUrl = localUrl;
        if (!uploadError && uploadData?.path) {
          const { data: publicData } = supabase.storage.from("generations").getPublicUrl(uploadData.path);
          permanentUrl = publicData?.publicUrl || localUrl;
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

  const handlePreviewVoice = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gemini-tts", {
        body: {
          action: "preview",
          prebuiltModel: GEMINI_FLASH_TTS_MODEL,
          voiceName: selectedVoice.name,
          previewText: "مرحباً، أنا صوتك الجديد. كيف أبدو؟",
          styleInstruction: styleInstruction.trim(),
          dialectHint: "لهجة عراقية عامية طبيعية",
          emotionHint: styleInstruction.trim() ? "طبيعي وبشري" : "",
          toneHint: styleInstruction.trim() ? "واضح وقريب من المستمع" : "",
          stability,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.audioBase64) {
        const url = base64ToAudioUrl(data.audioBase64, data.mimeType || "audio/mp3");
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطأ في المعاينة");
    } finally {
      setPreviewing(false);
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
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">استوديو الصوت</h1>
          <div className="mr-auto flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
              {selectedVoice.label}
            </span>
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <Menu className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
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
              className={`min-h-[120px] bg-card border-border/50 text-sm resize-none focus:border-primary/50 ${isOverLimit ? "border-destructive focus:border-destructive" : ""}`}
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
            {/* Inline Tags - Emoji Chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              {inlineTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => insertTag(tag)}
                  title={tag.label}
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
          </div>
        </div>
      </div>

      {/* ─── Voice Settings Sidebar ─── */}
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
                {/* Male Voices */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">أصوات الرجال</label>
                  <div className="space-y-1">
                    {maleVoices.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => setSelectedVoice(v)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-all ${
                          selectedVoice.name === v.name
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-secondary/50 border border-transparent"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          selectedVoice.name === v.name ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                        }`}>
                          {v.label[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${selectedVoice.name === v.name ? "text-primary" : "text-foreground"}`}>
                            {v.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{v.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Female Voices */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">أصوات النساء</label>
                  <div className="space-y-1">
                    {femaleVoices.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => setSelectedVoice(v)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-all ${
                          selectedVoice.name === v.name
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-secondary/50 border border-transparent"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          selectedVoice.name === v.name ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                        }`}>
                          {v.label[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${selectedVoice.name === v.name ? "text-primary" : "text-foreground"}`}>
                            {v.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{v.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Voice */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewVoice}
                  disabled={previewing}
                  className="w-full gap-2"
                >
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  معاينة الصوت
                </Button>

                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">السرعة</label>
                    <span className="text-[10px] text-primary font-mono">{speakingRate.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speakingRate]}
                    onValueChange={([v]) => setSpeakingRate(v)}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                  />
                </div>

                {/* Stability */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">الثبات</label>
                    <span className="text-[10px] text-primary font-mono">{(stability * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[stability]}
                    onValueChange={([v]) => setStability(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* Pitch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">درجة الصوت</label>
                    <span className="text-[10px] text-primary font-mono">{pitch > 0 ? "+" : ""}{pitch}</span>
                  </div>
                  <Slider
                    value={[pitch]}
                    onValueChange={([v]) => setPitch(v)}
                    min={-10}
                    max={10}
                    step={1}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioStudioPage;
