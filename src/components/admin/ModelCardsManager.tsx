import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Eye, EyeOff, Save, Upload, Layers, Pencil, X, Plus } from "lucide-react";
import { tools } from "@/data/tools";

interface ModelCard {
  id: string;
  tool_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  display_section: string | null;
  sort_order: number;
  is_visible: boolean;
}

const SECTIONS = [
  { id: "all", label: "الكل" },
  { id: "latest", label: "الأحدث" },
  { id: "images", label: "الصور" },
  { id: "videos", label: "الفيديوهات" },
] as const;

const SECTION_OPTIONS = [
  { value: "latest", label: "الأحدث" },
  { value: "images", label: "الصور" },
  { value: "videos", label: "الفيديوهات" },
];

const ModelCardsManager = () => {
  const [cards, setCards] = useState<ModelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", display_section: "images" });
  const [syncing, setSyncing] = useState(false);

  const fetchCards = async () => {
    const { data } = await supabase.from("model_cards").select("*").order("sort_order");
    setCards((data as ModelCard[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, []);

  const syncAllTools = async () => {
    setSyncing(true);
    const existingIds = new Set(cards.map(c => c.tool_id));
    const missing = tools.filter(t => !existingIds.has(t.id));
    if (missing.length === 0) {
      toast.info("جميع الأدوات مُسجلة بالفعل");
      setSyncing(false);
      return;
    }
    const rows = missing.map((t, i) => {
      let section = "images";
      if (t.category === "فيديو") section = "videos";
      return {
        tool_id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        display_section: section,
        sort_order: cards.length + i,
        is_visible: true,
        image_url: null,
      };
    });
    const { error } = await supabase.from("model_cards").insert(rows);
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم تسجيل ${missing.length} أداة جديدة`);
    fetchCards();
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `model-cards/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-content").upload(path, file);
    setUploading(false);
    if (error) { toast.error("فشل الرفع: " + error.message); return null; }
    const { data } = supabase.storage.from("cms-content").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("model_cards").update({
      title: form.title || null,
      description: form.description || null,
      image_url: form.image_url || null,
      display_section: form.display_section,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    setEditingId(null);
    fetchCards();
  };

  const toggleVisible = async (c: ModelCard) => {
    await supabase.from("model_cards").update({ is_visible: !c.is_visible }).eq("id", c.id);
    fetchCards();
  };

  const removeImage = async (id: string) => {
    await supabase.from("model_cards").update({ image_url: null, updated_at: new Date().toISOString() }).eq("id", id);
    toast.success("تم إزالة الصورة");
    fetchCards();
  };

  const startEdit = (c: ModelCard) => {
    setEditingId(c.id);
    setForm({
      title: c.title || "",
      description: c.description || "",
      image_url: c.image_url || "",
      display_section: c.display_section || "images",
    });
  };

  if (loading) return <p className="text-xs text-muted-foreground py-4">جاري التحميل...</p>;

  const filteredCards = activeSection === "all"
    ? cards
    : cards.filter(c => c.display_section === activeSection);

  const unmanagedCount = tools.filter(t => !cards.some(c => c.tool_id === t.id)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> كاردات النماذج
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{filteredCards.length} كارد</span>
          {unmanagedCount > 0 && (
            <Button size="sm" className="text-xs gap-1" onClick={syncAllTools} disabled={syncing}>
              {syncing ? "جاري المزامنة..." : `مزامنة ${unmanagedCount} أداة`}
            </Button>
          )}
        </div>
      </div>

      {/* Section sub-tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activeSection === s.id
                ? "bg-primary/15 text-primary"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
            <span className="mr-1 text-[9px] opacity-60">
              ({s.id === "all" ? cards.length : cards.filter(c => c.display_section === s.id).length})
            </span>
          </button>
        ))}
      </div>

      {unmanagedCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-[11px] text-amber-400 font-semibold">
            ⚠ يوجد {unmanagedCount} أداة في الكود بدون كارد مسجّل. اضغط "مزامنة" لإضافتها تلقائياً.
          </p>
        </div>
      )}

      {/* Cards list */}
      <div className="space-y-2">
        {filteredCards.map(c => {
          const tool = tools.find(t => t.id === c.tool_id);
          const sectionLabel = SECTION_OPTIONS.find(s => s.value === c.display_section)?.label || c.display_section;
          return (
            <div key={c.id} className={`bg-card rounded-xl border p-3 ${c.is_visible ? "border-border/50" : "border-border/20 opacity-50"}`}>
              {editingId === c.id ? (
                <div className="space-y-3">
                  {/* Tool name (read-only) */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                    <span className="font-bold text-foreground">{tool?.title || c.tool_id}</span>
                    <span className="text-[9px]" dir="ltr">({c.tool_id})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" className="text-xs h-8" />
                  </div>

                  {/* Section selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">القسم المعروض فيه:</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {SECTION_OPTIONS.map(s => (
                        <button
                          key={s.value}
                          onClick={() => setForm(f => ({ ...f, display_section: s.value }))}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                            form.display_section === s.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image upload */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                      <Upload className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{uploading ? "رفع..." : "رفع صورة الكارد"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadImage(file);
                        if (url) setForm(f => ({ ...f, image_url: url }));
                      }} />
                    </label>
                    {form.image_url && (
                      <div className="relative">
                        <img src={form.image_url} alt="" className="h-14 rounded-lg" />
                        <button onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-destructive-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="text-xs gap-1" onClick={() => handleUpdate(c.id)}>
                      <Save className="w-3 h-3" /> حفظ
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingId(null)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">افتراضي</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{c.title || tool?.title || c.tool_id}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.description || tool?.description || "—"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{sectionLabel}</span>
                      <span className="text-[9px] text-muted-foreground/60" dir="ltr">ID: {c.tool_id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleVisible(c)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title={c.is_visible ? "إخفاء" : "إظهار"}>
                      {c.is_visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="تعديل">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {c.image_url && (
                      <button onClick={() => removeImage(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors" title="إزالة الصورة">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 && cards.length > 0 && (
        <p className="text-center py-6 text-xs text-muted-foreground">لا توجد كاردات في هذا القسم.</p>
      )}

      {cards.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <p className="text-xs text-muted-foreground">لا توجد كاردات مسجلة بعد.</p>
          <Button size="sm" className="text-xs" onClick={syncAllTools} disabled={syncing}>
            مزامنة جميع الأدوات ({tools.length})
          </Button>
        </div>
      )}
    </div>
  );
};

export default ModelCardsManager;
