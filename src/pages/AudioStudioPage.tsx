import { useState, useRef, useCallback } from "react";
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

// ─── Official Gemini Voices ───
interface GeminiVoice {
  name: string;
  label: string;
  gender: "male" | "female";
  description: string;
}

const geminiVoices: GeminiVoice[] = [
  { name: "Puck", label: "Puck", gender: "male", description: "صوت شاب ديناميكي" },
  { name: "Charon", label: "Charon", gender: "male", description: "صوت عميق وهادئ" },
  { name: "Orus", label: "Orus", gender: "male", description: "صوت واضح ومهني" },
  { name: "Achird", label: "Achird", gender: "male", description: "صوت دافئ وطبيعي" },
  { name: "Algenib", label: "Algenib", gender: "male", description: "صوت قوي وواثق" },
  { name: "Alnilam", label: "Alnilam", gender: "male", description: "صوت رصين ومتزن" },
  { name: "Kore", label: "Kore", gender: "female", description: "صوت أنثوي دافئ" },
  { name: "Leda", label: "Leda", gender: "female", description: "صوت ناعم وراقي" },
  { name: "Zephyr", label: "Zephyr", gender: "female", description: "صوت حيوي ومرح" },
  { name: "Aoede", label: "Aoede", gender: "female", description: "صوت غني ومعبّر" },
  { name: "Achernar", label: "Achernar", gender: "female", description: "صوت هادئ ومريح" },
];

// ─── Enhancement Presets ───
const presets = [
  { label: "محادثة يومية", style: "كلام يومي طبيعي، بدون تكلف، قريب من السامع" },
  { label: "خبر", style: "نبرة إخبارية واضحة، رسمية قليلاً، سرعة متوسطة" },
  { label: "إعلان", style: "صوت حماسي، طاقة عالية، جذب انتباه" },
  { label: "إنفلونسر", style: "كلام عفوي، مرح، شبابي، طاقة إيجابية" },
];

// ─── Inline Tags ───
const inlineTags = [
  "[short pause]", "[medium pause]", "[long pause]",
  "[whispering]", "[shouting]", "[sarcasm]", "[laughing]",
  "[sigh]", "[fast]", "[scared]", "[curious]",
];

const AudioStudioPage = () => {
  const navigate = useNavigate();
  const { user, credits, refreshCredits } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  // ─── State ───
  const [styleInstruction, setStyleInstruction] = useState("");
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice>(geminiVoices[0]);
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [stability, setStability] = useState(0.7);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const maleVoices = geminiVoices.filter((v) => v.gender === "male");
  const femaleVoices = geminiVoices.filter((v) => v.gender === "female");

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
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      navigate("/auth");
      return;
    }
    if (credits <= 0) {
      toast.error("لا يوجد رصيد كافٍ");
      navigate("/pricing");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gemini-tts", {
        body: {
          action: "synthesize",
          text,
          voiceName: selectedVoice.name,
          styleInstruction,
          speakingRate,
          pitch,
          stability,
          dialectHint: styleInstruction.includes("عراقي") ? "لهجة عراقية عامية واضحة" : "",
          emotionHint: "",
          toneHint: "",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.audioBase64) {
        // Cleanup previous URL
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = base64ToAudioUrl(data.audioBase64, data.mimeType || "audio/mp3");
        setAudioUrl(url);
        toast.success("تم توليد الصوت بنجاح!");

        // Deduct credit
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
            action: "spent" as const,
            description: `توليد صوت بـ Gemini TTS - ${selectedVoice.label}`,
          });
        }

        // Save to generations
        await supabase.from("generations").insert({
          user_id: user.id,
          tool_id: "gemini-tts",
          tool_name: `Gemini TTS - ${selectedVoice.label}`,
          prompt: text.slice(0, 200),
          file_url: url,
          file_type: "audio",
          metadata: { voice: selectedVoice.name, styleInstruction, speakingRate, pitch, stability } as any,
        });

        await refreshCredits();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
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
          voiceName: selectedVoice.name,
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

  const insertTag = (tag: string) => {
    setText((prev) => prev + " " + tag + " ");
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب النص الذي تريد تحويله إلى صوت..."
              className="min-h-[120px] bg-card border-border/50 text-sm resize-none focus:border-primary/50"
              dir="rtl"
            />
            {/* Inline Tags */}
            <div className="flex gap-1 flex-wrap">
              {inlineTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 hover:text-primary hover:bg-primary/20 transition-all font-mono"
                >
                  {tag}
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
              disabled={loading || !text.trim()}
              className="flex-1 gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? "جاري التوليد..." : "توليد الصوت"}
            </Button>

            <Button variant="outline" onClick={handleDownload} disabled={!audioUrl} className="gap-2">
              <Download className="w-4 h-4" />
              تحميل
              </Button>
            )}
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
