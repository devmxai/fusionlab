import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image, Video, Mic, ArrowRightLeft,
  Sparkles, Play, RotateCcw, Type,
  Wand2, Zap, AudioLines, Move3D
} from "lucide-react";

/* ─── types ─── */
type TabId = "image" | "video" | "avatar" | "transfer";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: "image",    label: "توليد الصور",     icon: <Image className="w-4 h-4" /> },
  { id: "video",    label: "توليد الفيديو",   icon: <Video className="w-4 h-4" /> },
  { id: "avatar",   label: "الصورة الناطقة",  icon: <Mic className="w-4 h-4" /> },
  { id: "transfer", label: "نقل الحركة",      icon: <ArrowRightLeft className="w-4 h-4" /> },
];

/* ─── reusable animated step label ─── */
const StepLabel = ({ text, delay = 0 }: { text: string; delay?: number }) => (
  <motion.p
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="text-xs sm:text-sm text-muted-foreground text-center mt-3"
  >
    {text}
  </motion.p>
);

/* ─── floating particles ─── */
const Particles = ({ count = 12 }: { count?: number }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 rounded-full"
        style={{
          background: `hsl(270 70% ${55 + (i % 3) * 10}%)`,
          left: `${10 + Math.random() * 80}%`,
          top: `${10 + Math.random() * 80}%`,
        }}
        animate={{
          y: [0, -20 - Math.random() * 30, 0],
          opacity: [0, 0.8, 0],
          scale: [0, 1.5, 0],
        }}
        transition={{
          duration: 2 + Math.random() * 1.5,
          delay: i * 0.15,
          repeat: Infinity,
          repeatDelay: 1,
        }}
      />
    ))}
  </div>
);

/* ─── typing cursor ─── */
const TypingText = ({ text, onDone }: { text: string; onDone: () => void }) => {
  const [chars, setChars] = useState(0);

  useEffect(() => {
    setChars(0);
    const id = setInterval(() => {
      setChars((c) => {
        if (c >= text.length) {
          clearInterval(id);
          setTimeout(onDone, 400);
          return c;
        }
        return c + 1;
      });
    }, 50);
    return () => clearInterval(id);
  }, [text, onDone]);

  return (
    <span className="text-foreground text-sm font-medium" dir="ltr">
      {text.slice(0, chars)}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
      />
    </span>
  );
};

/* ─── glowing box wrapper ─── */
const GlowCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden ${className}`}
    style={{ boxShadow: "0 0 40px -10px hsl(270 70% 55% / 0.15)" }}
  >
    {children}
  </div>
);

/* ─── placeholder image ─── */
const PlaceholderImage = ({ variant = "photo" }: { variant?: "photo" | "avatar" | "video" }) => {
  const gradients: Record<string, string> = {
    photo:  "from-primary/20 via-accent/10 to-secondary",
    avatar: "from-blue-500/20 via-purple-500/10 to-secondary",
    video:  "from-pink-500/20 via-primary/10 to-secondary",
  };
  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradients[variant]} flex items-center justify-center`}>
      {variant === "avatar" && (
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border-2 border-border/50 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-muted-foreground/20" />
          <div className="absolute mt-10 w-10 h-4 rounded-full bg-muted-foreground/10" />
        </div>
      )}
      {variant === "photo" && <Sparkles className="w-8 h-8 text-primary/40" />}
      {variant === "video" && <Play className="w-8 h-8 text-primary/40" />}
    </div>
  );
};

/* ═══════════════════════════════════════════
   SHOWCASE: IMAGE GENERATION
   ═══════════════════════════════════════════ */
const ImageShowcase = ({ playing }: { playing: boolean }) => {
  const [step, setStep] = useState(0);
  const prompt = "A futuristic city at sunset, neon lights, cinematic";

  useEffect(() => {
    if (!playing) { setStep(0); return; }
    setStep(1);
  }, [playing]);

  const advanceFromTyping = useCallback(() => setStep(2), []);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => setStep(3), 800);
      return () => clearTimeout(t);
    }
    if (step === 3) {
      const t = setTimeout(() => setStep(4), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-4 py-6">
      {/* Step 1 – Prompt input */}
      <AnimatePresence mode="wait">
        {step >= 1 && step < 4 && (
          <motion.div
            key="prompt-area"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <GlowCard className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-4 h-4 text-primary" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prompt</span>
              </div>
              <div className="min-h-[28px] flex items-center">
                {step === 1 && <TypingText text={prompt} onDone={advanceFromTyping} />}
                {step >= 2 && (
                  <span className="text-foreground text-sm font-medium" dir="ltr">{prompt}</span>
                )}
              </div>
              {step >= 2 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-3 flex justify-end"
                >
                  <div className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5">
                    <Wand2 className="w-3 h-3" />
                    Generate
                  </div>
                </motion.div>
              )}
            </GlowCard>
            {step < 3 && <StepLabel text="اكتب وصف الصورة التي تريدها" delay={0.3} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2 – Loading shimmer */}
      <AnimatePresence>
        {step === 3 && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <Particles count={16} />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary"
            />
            <StepLabel text="الذكاء الاصطناعي يولد الصورة..." delay={0.2} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3 – Result */}
      <AnimatePresence>
        {step === 4 && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-sm"
          >
            <GlowCard className="aspect-[4/3] overflow-hidden">
              <PlaceholderImage variant="photo" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="absolute bottom-3 left-3 right-3 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-foreground font-semibold">تم توليد الصورة بنجاح</span>
              </motion.div>
            </GlowCard>
            <StepLabel text="الذكاء الاصطناعي يحول النص إلى صورة" delay={0.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SHOWCASE: VIDEO GENERATION
   ═══════════════════════════════════════════ */
const VideoShowcase = ({ playing }: { playing: boolean }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!playing) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 3200),
      setTimeout(() => setStep(4), 4600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playing]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-4 py-6">
      <AnimatePresence mode="wait">
        {/* Prompt */}
        {step >= 1 && step < 3 && (
          <motion.div
            key="vprompt"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md"
          >
            <GlowCard className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Video Prompt</span>
              </div>
              <p className="text-sm text-foreground" dir="ltr">
                A drone flying over mountains at golden hour
              </p>
            </GlowCard>
            <StepLabel text="أدخل وصف الفيديو المطلوب" delay={0.3} />
          </motion.div>
        )}

        {/* Processing timeline */}
        {step === 3 && (
          <motion.div
            key="vtimeline"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md flex flex-col items-center gap-4"
          >
            <Particles count={10} />
            {/* frames strip */}
            <div className="flex gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scaleY: 0.5 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: i * 0.12 }}
                  className="w-10 h-14 sm:w-12 sm:h-16 rounded-md bg-gradient-to-b from-primary/20 to-secondary border border-border/30"
                />
              ))}
            </div>
            {/* timeline bar */}
            <div className="w-full max-w-xs h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <StepLabel text="يتم إنشاء إطارات الفيديو..." />
          </motion.div>
        )}

        {/* Result */}
        {step === 4 && (
          <motion.div
            key="vresult"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-sm"
          >
            <GlowCard className="aspect-video overflow-hidden">
              <PlaceholderImage variant="video" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center"
                >
                  <Play className="w-6 h-6 text-primary-foreground fill-primary-foreground ml-0.5" />
                </motion.div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-3 left-3 right-3 flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs text-foreground font-semibold">تم إنشاء الفيديو</span>
              </motion.div>
            </GlowCard>
            <StepLabel text="النص يتحول إلى فيديو بالكامل" delay={0.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SHOWCASE: AVATAR (TALKING IMAGE)
   ═══════════════════════════════════════════ */
const AvatarShowcase = ({ playing }: { playing: boolean }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!playing) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 1600),
      setTimeout(() => setStep(3), 3000),
      setTimeout(() => setStep(4), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playing]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-4 py-6">
      <AnimatePresence mode="wait">
        {/* Step 1: Two inputs */}
        {step >= 1 && step < 3 && (
          <motion.div
            key="avatar-inputs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-4 sm:gap-8"
          >
            {/* Image side */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-2"
            >
              <GlowCard className="w-28 h-28 sm:w-36 sm:h-36">
                <PlaceholderImage variant="avatar" />
              </GlowCard>
              <span className="text-[10px] text-muted-foreground font-semibold">صورة</span>
            </motion.div>

            {/* Connection lines */}
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Zap className="w-5 h-5 text-primary" />
                </motion.div>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                  />
                ))}
              </motion.div>
            )}

            {/* Audio side */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-2"
            >
              <GlowCard className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-16">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 rounded-full bg-primary/60"
                      animate={{ height: [8, 16 + Math.random() * 24, 8] }}
                      transition={{ duration: 0.6, delay: i * 0.05, repeat: Infinity, repeatType: "reverse" }}
                    />
                  ))}
                </div>
              </GlowCard>
              <span className="text-[10px] text-muted-foreground font-semibold">صوت</span>
            </motion.div>
          </motion.div>
        )}

        {step >= 1 && step < 3 && (
          <motion.div key="avatar-label-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StepLabel text="صورة + صوت = صورة ناطقة" delay={0.6} />
          </motion.div>
        )}

        {/* Loading */}
        {step === 3 && (
          <motion.div
            key="avatar-merge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <Particles count={14} />
            <AudioLines className="w-10 h-10 text-primary animate-pulse" />
            <StepLabel text="يتم دمج الصوت مع الصورة..." />
          </motion.div>
        )}

        {/* Result */}
        {step === 4 && (
          <motion.div
            key="avatar-result"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-xs"
          >
            <GlowCard className="aspect-[3/4] overflow-hidden">
              <PlaceholderImage variant="avatar" />
              {/* Subtle mouth animation overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scaleY: [1, 1.05, 0.98, 1.03, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-20 h-20 rounded-full border-2 border-primary/30"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              {/* Waveform overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute bottom-3 left-3 right-3 flex items-center gap-2"
              >
                <AudioLines className="w-4 h-4 text-primary" />
                <div className="flex-1 flex items-center gap-px">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-full bg-primary/50"
                      animate={{ height: [2, 4 + Math.random() * 8, 2] }}
                      transition={{ duration: 0.4, delay: i * 0.03, repeat: Infinity, repeatType: "reverse" }}
                    />
                  ))}
                </div>
              </motion.div>
            </GlowCard>
            <StepLabel text="الصورة أصبحت تتحدث!" delay={0.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SHOWCASE: MOTION TRANSFER
   ═══════════════════════════════════════════ */
const TransferShowcase = ({ playing }: { playing: boolean }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!playing) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 3200),
      setTimeout(() => setStep(4), 4400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playing]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-4 py-6">
      <AnimatePresence mode="wait">
        {/* Sources */}
        {step >= 1 && step < 3 && (
          <motion.div
            key="transfer-inputs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 sm:gap-6"
          >
            {/* Source video */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <GlowCard className="w-28 h-20 sm:w-36 sm:h-24 overflow-hidden">
                <PlaceholderImage variant="video" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-background/60 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-foreground fill-foreground ml-0.5" />
                  </div>
                </div>
              </GlowCard>
              <span className="text-[10px] text-muted-foreground font-semibold">فيديو المصدر</span>
            </motion.div>

            {/* Flow arrows */}
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1"
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                  >
                    <Move3D className="w-4 h-4 text-primary" style={{ opacity: 1 - i * 0.2 }} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Target image */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <GlowCard className="w-28 h-20 sm:w-36 sm:h-24 overflow-hidden">
                <PlaceholderImage variant="photo" />
              </GlowCard>
              <span className="text-[10px] text-muted-foreground font-semibold">الصورة الهدف</span>
            </motion.div>
          </motion.div>
        )}

        {step >= 1 && step < 3 && (
          <motion.div key="transfer-l1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StepLabel text="نقل الحركة من فيديو إلى صورة" delay={0.5} />
          </motion.div>
        )}

        {/* Merge */}
        {step === 3 && (
          <motion.div
            key="transfer-merge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <Particles count={14} />
            <motion.div
              animate={{ rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Move3D className="w-10 h-10 text-primary" />
            </motion.div>
            <StepLabel text="يتم نقل الحركة..." />
          </motion.div>
        )}

        {/* Result */}
        {step === 4 && (
          <motion.div
            key="transfer-result"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-sm"
          >
            <GlowCard className="aspect-video overflow-hidden">
              <PlaceholderImage variant="photo" />
              {/* Motion overlay */}
              <div className="absolute inset-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 border-2 border-primary/20 rounded-2xl"
                    animate={{
                      scale: [1, 1.02, 0.99, 1.01, 1],
                      rotate: [0, 0.5, -0.3, 0.2, 0],
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.3,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-3 left-3 right-3 flex items-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <span className="text-xs text-foreground font-semibold">تم نقل الحركة بنجاح</span>
              </motion.div>
            </GlowCard>
            <StepLabel text="الصورة تتحرك مثل الفيديو المصدر" delay={0.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN SHOWCASE COMPONENT
   ═══════════════════════════════════════════ */
const AIShowcase = () => {
  const [activeTab, setActiveTab] = useState<TabId>("image");
  const [playKey, setPlayKey] = useState(0);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setPlayKey((k) => k + 1);
  };

  const handleReplay = () => setPlayKey((k) => k + 1);

  return (
    <section className="py-10">
      {/* Section title */}
      <div className="text-center mb-6">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-lg sm:text-xl font-bold text-foreground mb-1"
        >
          ✨ كيف تعمل أدواتنا
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-xs text-muted-foreground"
        >
          شاهد كيف يعمل كل قسم خطوة بخطوة
        </motion.p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-4 px-3">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border/30 backdrop-blur-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
                activeTab === tab.id
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="showcase-tab-bg"
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div className="relative mx-auto max-w-2xl">
        <div
          className="relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden"
          style={{
            minHeight: 340,
            boxShadow: "0 0 60px -15px hsl(270 70% 55% / 0.1), inset 0 1px 0 0 hsl(0 0% 100% / 0.03)",
          }}
        >
          {/* Subtle grid bg */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(hsl(270 70% 55%) 1px, transparent 1px), linear-gradient(90deg, hsl(270 70% 55%) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${playKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative h-full min-h-[340px]"
            >
              {activeTab === "image" && <ImageShowcase playing key={playKey} />}
              {activeTab === "video" && <VideoShowcase playing key={playKey} />}
              {activeTab === "avatar" && <AvatarShowcase playing key={playKey} />}
              {activeTab === "transfer" && <TransferShowcase playing key={playKey} />}
            </motion.div>
          </AnimatePresence>

          {/* Replay button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleReplay}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-secondary/80 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default AIShowcase;
