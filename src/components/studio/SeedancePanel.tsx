/**
 * SeedancePanel — dedicated, guided UX for bytedance/seedance-2 and bytedance/seedance-2-fast.
 *
 * Replaces the generic frame/reference UI with mode-specific upload sections:
 *   • Text to Video        → prompt only
 *   • First Frame          → start image
 *   • First + Last Frame   → start + end images
 *   • Multimodal Reference → character / location / style images + optional video & audio
 *
 * Helps non-technical users understand what to upload and why,
 * without exposing @image tagging syntax.
 */

import { useRef } from "react";
import { Upload, X, Plus, ImageIcon, Video, Music, Volume2, VolumeX, Sparkles } from "lucide-react";

export type SeedanceMode = "text" | "first" | "first-last" | "multimodal";

export interface SeedanceAsset {
  file: File;
  preview: string;
}

export interface SeedanceMediaAsset {
  file: File;
  name: string;
  preview?: string;
}

export interface SeedancePanelProps {
  mode: SeedanceMode;
  onModeChange: (mode: SeedanceMode) => void;

  // First / Last frame
  firstFrame: SeedanceAsset | null;
  lastFrame: SeedanceAsset | null;
  onFirstFrameChange: (asset: SeedanceAsset | null) => void;
  onLastFrameChange: (asset: SeedanceAsset | null) => void;

  // Multimodal references — separated visually but mapped into reference_image_urls
  characterRefs: SeedanceAsset[];
  locationRefs: SeedanceAsset[];
  styleRefs: SeedanceAsset[];
  onCharacterRefsChange: (refs: SeedanceAsset[]) => void;
  onLocationRefsChange: (refs: SeedanceAsset[]) => void;
  onStyleRefsChange: (refs: SeedanceAsset[]) => void;

  motionVideo: SeedanceMediaAsset | null;
  audioRef: SeedanceMediaAsset | null;
  onMotionVideoChange: (v: SeedanceMediaAsset | null) => void;
  onAudioRefChange: (a: SeedanceMediaAsset | null) => void;

  // Audio generation toggle (separate from "reference audio" upload)
  generateAudio: boolean;
  onGenerateAudioChange: (v: boolean) => void;

  /** Total reference images used (caps at 9 per official docs). */
  totalRefImages: number;
}

/** Keep the combined reference image count under the official cap (9). */
const MAX_REF_IMAGES = 9;

export function SeedancePanel(props: SeedancePanelProps) {
  const {
    mode,
    onModeChange,
    firstFrame,
    lastFrame,
    onFirstFrameChange,
    onLastFrameChange,
    characterRefs,
    locationRefs,
    styleRefs,
    onCharacterRefsChange,
    onLocationRefsChange,
    onStyleRefsChange,
    motionVideo,
    audioRef,
    onMotionVideoChange,
    onAudioRefChange,
    generateAudio,
    onGenerateAudioChange,
    totalRefImages,
  } = props;

  const firstInputRef = useRef<HTMLInputElement>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);
  const locInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const motionVidInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFrame = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (a: SeedanceAsset | null) => void,
    current: SeedanceAsset | null,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (current?.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
    setter({ file, preview: URL.createObjectURL(file) });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRefList = (
    e: React.ChangeEvent<HTMLInputElement>,
    list: SeedanceAsset[],
    setter: (next: SeedanceAsset[]) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_REF_IMAGES - totalRefImages;
    const additions = files.slice(0, Math.max(0, remaining)).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setter([...list, ...additions]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFromList = (
    list: SeedanceAsset[],
    setter: (next: SeedanceAsset[]) => void,
    idx: number
  ) => {
    URL.revokeObjectURL(list[idx].preview);
    setter(list.filter((_, i) => i !== idx));
  };

  const handleMotionVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onMotionVideoChange({ file, name: file.name });
    if (motionVidInputRef.current) motionVidInputRef.current.value = "";
  };

  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAudioRefChange({ file, name: file.name });
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const modeOptions: { value: SeedanceMode; label: string; sub: string }[] = [
    { value: "text", label: "نص → فيديو", sub: "بدون أي رفع" },
    { value: "first", label: "إطار البداية", sub: "صورة بداية واحدة" },
    { value: "first-last", label: "بداية ونهاية", sub: "إطار أول + إطار أخير" },
    { value: "multimodal", label: "مرجع متعدد", sub: "شخصية / مكان / أسلوب" },
  ];

  const modeHelper: Record<SeedanceMode, string> = {
    text: "ولّد الفيديو من الوصف فقط — لا حاجة لرفع أي ملف.",
    first: "ارفع صورة البداية وسيقوم Seedance بتحريكها وفق وصفك.",
    "first-last": "حدد إطار البداية وإطار النهاية للسيطرة الكاملة على بداية ونهاية الفيديو.",
    multimodal: "ارفع مراجع للشخصية والمكان والأسلوب — يحافظ Seedance على الهوية والمزاج البصري.",
  };

  return (
    <div className="space-y-4">
      <input ref={firstInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFrame(e, onFirstFrameChange, firstFrame, firstInputRef)} />
      <input ref={lastInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFrame(e, onLastFrameChange, lastFrame, lastInputRef)} />
      <input ref={charInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleRefList(e, characterRefs, onCharacterRefsChange, charInputRef)} />
      <input ref={locInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleRefList(e, locationRefs, onLocationRefsChange, locInputRef)} />
      <input ref={styleInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleRefList(e, styleRefs, onStyleRefsChange, styleInputRef)} />
      <input ref={motionVidInputRef} type="file" accept="video/*" className="hidden" onChange={handleMotionVideo} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudio} />

      {/* ── Mode selector ── */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-muted-foreground/70">طريقة الإنشاء</label>
        <div className="grid grid-cols-2 gap-1.5">
          {modeOptions.map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onModeChange(opt.value)}
                className={`px-2.5 py-2 rounded-xl border text-right transition-all ${
                  active
                    ? "bg-primary/15 border-primary/50 shadow-sm"
                    : "bg-secondary/30 border-border/30 hover:bg-secondary/50 hover:border-border/50"
                }`}
              >
                <p className={`text-[11px] font-bold leading-tight ${active ? "text-primary" : "text-foreground"}`}>
                  {opt.label}
                </p>
                <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-tight">{opt.sub}</p>
              </button>
            );
          })}
        </div>
        <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
          <p className="text-[10px] text-muted-foreground/90 leading-relaxed">{modeHelper[mode]}</p>
        </div>
      </div>

      {/* ── Mode: First Frame ── */}
      {mode === "first" && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-foreground/70">إطار البداية</label>
          <FrameSlot
            asset={firstFrame}
            label="إطار البداية"
            onPick={() => firstInputRef.current?.click()}
            onRemove={() => {
              if (firstFrame?.preview?.startsWith("blob:")) URL.revokeObjectURL(firstFrame.preview);
              onFirstFrameChange(null);
            }}
          />
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            استخدم صورة واضحة للموضوع الرئيسي — سيُحرّكها Seedance من هذه النقطة.
          </p>
        </div>
      )}

      {/* ── Mode: First + Last Frame ── */}
      {mode === "first-last" && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-foreground/70">إطار البداية وإطار النهاية</label>
          <div className="grid grid-cols-2 gap-2">
            <FrameSlot
              asset={firstFrame}
              label="إطار البداية"
              onPick={() => firstInputRef.current?.click()}
              onRemove={() => {
                if (firstFrame?.preview?.startsWith("blob:")) URL.revokeObjectURL(firstFrame.preview);
                onFirstFrameChange(null);
              }}
            />
            <FrameSlot
              asset={lastFrame}
              label="إطار النهاية"
              onPick={() => lastInputRef.current?.click()}
              onRemove={() => {
                if (lastFrame?.preview?.startsWith("blob:")) URL.revokeObjectURL(lastFrame.preview);
                onLastFrameChange(null);
              }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            الأنسب عند الحاجة لتحديد بداية ونهاية المشهد بدقة (مثل الإعلانات والتنقّل بين لقطتين).
          </p>
        </div>
      )}

      {/* ── Mode: Multimodal Reference ── */}
      {mode === "multimodal" && (
        <div className="space-y-3">
          <RefSection
            title="مراجع الشخصية"
            helper="صور لنفس الشخص من زوايا مختلفة — تحافظ على ثبات الوجه والهوية."
            list={characterRefs}
            onPick={() => charInputRef.current?.click()}
            onRemove={(i) => removeFromList(characterRefs, onCharacterRefsChange, i)}
            disabled={totalRefImages >= MAX_REF_IMAGES}
            icon={<ImageIcon className="w-4 h-4" />}
          />
          <RefSection
            title="مراجع المكان / البيئة"
            helper="صور للموقع أو الخلفية المطلوبة — تحدد مزاج المشهد ولونه."
            list={locationRefs}
            onPick={() => locInputRef.current?.click()}
            onRemove={(i) => removeFromList(locationRefs, onLocationRefsChange, i)}
            disabled={totalRefImages >= MAX_REF_IMAGES}
            icon={<ImageIcon className="w-4 h-4" />}
          />
          <RefSection
            title="مراجع الأسلوب / المنتج (اختياري)"
            helper="ملابس، منتج، ألوان، إضاءة، أو ستايل بصري عام."
            list={styleRefs}
            onPick={() => styleInputRef.current?.click()}
            onRemove={(i) => removeFromList(styleRefs, onStyleRefsChange, i)}
            disabled={totalRefImages >= MAX_REF_IMAGES}
            icon={<Sparkles className="w-4 h-4" />}
          />
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
            <span>إجمالي الصور المرجعية</span>
            <span className="font-bold text-foreground">{totalRefImages} / {MAX_REF_IMAGES}</span>
          </div>

          {/* Motion reference video */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground/70">فيديو مرجعي للحركة (اختياري)</label>
            {motionVideo ? (
              <div className="relative rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2.5 flex items-center gap-2">
                <Video className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[10px] font-medium text-foreground truncate flex-1">{motionVideo.name}</span>
                <button onClick={() => onMotionVideoChange(null)}
                  className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button onClick={() => motionVidInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex items-center justify-center gap-2 py-3 transition-all">
                <Video className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-[10px] font-semibold text-muted-foreground/70">رفع فيديو مرجعي</span>
              </button>
            )}
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
              يوجّه حركة الكاميرا والإيقاع — ليس مزامنة شفاه.
            </p>
          </div>

          {/* Reference audio */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground/70">صوت مرجعي (اختياري)</label>
            {audioRef ? (
              <div className="relative rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2.5 flex items-center gap-2">
                <Music className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[10px] font-medium text-foreground truncate flex-1">{audioRef.name}</span>
                <button onClick={() => onAudioRefChange(null)}
                  className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button onClick={() => audioInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border/40 bg-secondary/20 hover:border-primary/30 flex items-center justify-center gap-2 py-3 transition-all">
                <Music className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-[10px] font-semibold text-muted-foreground/70">رفع ملف صوتي</span>
              </button>
            )}
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
              للسياق الصوتي فقط — ليس workflow أفتار ناطق.
            </p>
          </div>
        </div>
      )}

      {/* ── Generate-audio toggle (available for all modes) ── */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-muted-foreground/70">صوت ناتج</label>
        <button
          onClick={() => onGenerateAudioChange(!generateAudio)}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all ${
            generateAudio
              ? "bg-primary/10 border-primary/40"
              : "bg-secondary/30 border-border/40 hover:bg-secondary/50"
          }`}
        >
          <div className="flex items-center gap-2">
            {generateAudio ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            <span className={`text-xs font-bold ${generateAudio ? "text-primary" : "text-foreground"}`}>
              {generateAudio ? "توليد صوت داخل الفيديو" : "بدون صوت"}
            </span>
          </div>
          <div className={`w-9 h-5 rounded-full transition-colors relative ${generateAudio ? "bg-primary" : "bg-secondary"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-all ${generateAudio ? "right-0.5" : "right-[18px]"}`} />
          </div>
        </button>
        <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
          تفعيل الصوت يزيد التكلفة ~20% — شاهد التقدير بجانب زر التوليد.
        </p>
      </div>

      {/* ── Prompt guidance hint ── */}
      <div className="px-3 py-2.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1.5">
        <p className="text-[10px] font-bold text-foreground">💡 نصيحة لكتابة الوصف</p>
        <p className="text-[9px] text-muted-foreground/80 leading-[1.7]">
          اذكر: الموضوع، الفعل، حركة الكاميرا، البيئة، الإضاءة، الأسلوب، والمزاج.
        </p>
        <p className="text-[9px] text-muted-foreground/60 leading-[1.7]">
          مثال: «إعلان سينمائي لمطعم فاخر، نفس المرأة من المراجع، جلسة قرب النافذة، حركة دوللي بطيئة، إضاءة دافئة، إحساس واقعي راقٍ.»
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function FrameSlot({
  asset,
  label,
  onPick,
  onRemove,
}: {
  asset: SeedanceAsset | null;
  label: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={() => !asset && onPick()}
      className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden cursor-pointer ${
        asset ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/20 hover:border-primary/30"
      }`}
      style={{ aspectRatio: "4/3" }}
    >
      {asset ? (
        <div className="relative w-full h-full">
          <img src={asset.preview} alt={label} className="w-full h-full object-cover rounded-lg" />
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10">
            <X className="w-3 h-3 text-destructive-foreground" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onPick(); }}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background/80 border border-border/30 flex items-center justify-center z-10">
            <Upload className="w-2.5 h-2.5 text-foreground" />
          </button>
          <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-background/80 text-foreground px-2 py-0.5 rounded">
            {label}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 h-full">
          <Upload className="w-5 h-5 text-muted-foreground/50" />
          <span className="text-[10px] font-semibold text-muted-foreground/60">{label}</span>
        </div>
      )}
    </div>
  );
}

function RefSection({
  title,
  helper,
  list,
  onPick,
  onRemove,
  disabled,
  icon,
}: {
  title: string;
  helper: string;
  list: SeedanceAsset[];
  onPick: () => void;
  onRemove: (i: number) => void;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-muted-foreground/70 flex items-center gap-1.5">
          <span className="text-primary/70">{icon}</span>
          {title}
        </label>
        {list.length > 0 && <span className="text-[9px] text-muted-foreground/60">{list.length}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((img, i) => (
          <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/40">
            <img src={img.preview} alt="" className="w-full h-full object-cover" />
            <button onClick={() => onRemove(i)}
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
              <X className="w-2.5 h-2.5 text-destructive-foreground" />
            </button>
          </div>
        ))}
        <button onClick={onPick} disabled={disabled}
          className={`w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
            disabled
              ? "border-border/20 bg-secondary/10 opacity-40 cursor-not-allowed"
              : "border-border/40 bg-secondary/20 hover:border-primary/30"
          }`}>
          <Plus className="w-4 h-4 text-muted-foreground/50" />
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground/60 leading-relaxed">{helper}</p>
    </div>
  );
}

export default SeedancePanel;
