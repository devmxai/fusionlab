import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Eye, EyeOff, Save, Upload, Pencil } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  cta_text: string | null;
  cta_link: string | null;
  sort_order: number;
  is_active: boolean;
  linked_studio: string | null;
}

const studioOptions = [
  { value: "none", label: "بدون ربط" },
  { value: "/studio/video", label: "🎬 فيديو" },
  { value: "/studio/images", label: "🖼️ صور" },
  { value: "/studio/shoots", label: "📸 شوتس" },
  { value: "/studio/remix", label: "🔄 ريمكس" },
  { value: "/studio/audio", label: "🎙️ صوت" },
  { value: "/studio/avatar", label: "🧑 افتار" },
  { value: "/studio/transfer", label: "✨ ترانسفير" },
  { value: "/studio/remove-bg", label: "🗑️ حذف الخلفية" },
  { value: "/studio/upscale", label: "📐 رفع الجودة" },
];

const getStudioLabel = (value: string | null) => {
  if (!value) return null;
  return studioOptions.find(o => o.value === value)?.label || value;
};

const BannersManager = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", subtitle: "", cta_text: "", cta_link: "", image_url: "", linked_studio: "none" });
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchBanners = async () => {
    const { data } = await supabase.from("homepage_banners").select("*").order("sort_order");
    setBanners((data as Banner[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 700, quality: 0.82, maxSizeKB: 200 });
      const ext = compressed.name.split(".").pop() || "webp";
      const path = `banners/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("cms-content").upload(path, compressed, {
        cacheControl: "31536000",
        contentType: compressed.type,
      });
      setUploading(false);
      if (error) { toast.error("فشل الرفع: " + error.message); return null; }
      const { data } = supabase.storage.from("cms-content").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      setUploading(false);
      toast.error("فشل ضغط الصورة");
      return null;
    }
  };

  const resolveStudio = (val: string) => val === "none" ? null : val;

  const handleAdd = async () => {
    const { error } = await supabase.from("homepage_banners").insert({
      image_url: form.image_url || "https://placehold.co/800x300/1a1a2e/e94560?text=Banner",
      title: form.title || null,
      subtitle: form.subtitle || null,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
      linked_studio: resolveStudio(form.linked_studio),
      sort_order: banners.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة البانر");
    setAdding(false);
    setForm({ title: "", subtitle: "", cta_text: "", cta_link: "", image_url: "", linked_studio: "none" });
    fetchBanners();
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("homepage_banners").update({
      title: form.title || null,
      subtitle: form.subtitle || null,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
      image_url: form.image_url,
      linked_studio: resolveStudio(form.linked_studio),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث البانر");
    setEditingId(null);
    fetchBanners();
  };

  const toggleActive = async (b: Banner) => {
    await supabase.from("homepage_banners").update({ is_active: !b.is_active }).eq("id", b.id);
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا البانر؟")) return;
    await supabase.from("homepage_banners").delete().eq("id", id);
    toast.success("تم الحذف");
    fetchBanners();
  };

  const startEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      cta_text: b.cta_text || "",
      cta_link: b.cta_link || "",
      image_url: b.image_url,
      linked_studio: b.linked_studio || "none",
    });
  };

  const BannerForm = ({ onSubmit, submitLabel, onCancel }: { onSubmit: () => void; submitLabel: string; onCancel: () => void }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
        <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="العنوان الفرعي" className="text-xs h-8" />
        <Input value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="نص الزر" className="text-xs h-8" />
        <Input value={form.cta_link} onChange={e => setForm(f => ({ ...f, cta_link: e.target.value }))} placeholder="رابط الزر (اختياري)" className="text-xs h-8" dir="ltr" />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-muted-foreground">ربط بـ Studio</label>
        <Select value={form.linked_studio} onValueChange={val => setForm(f => ({ ...f, linked_studio: val }))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="اختر الاستوديو" />
          </SelectTrigger>
          <SelectContent>
            {studioOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
          <Upload className="w-3 h-3" />
          <span className="text-[10px] font-semibold">{uploading ? "جاري الرفع..." : "رفع صورة"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadImage(file);
            if (url) setForm(f => ({ ...f, image_url: url }));
          }} />
        </label>
        {form.image_url && <img src={form.image_url} alt="" className="h-10 rounded-md" />}
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="text-xs" onClick={onSubmit}><Save className="w-3 h-3 ml-1" />{submitLabel}</Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );

  if (loading) return <p className="text-xs text-muted-foreground py-4">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">البانرات الرئيسية</h3>
        <Button size="sm" className="text-xs gap-1" onClick={() => { setAdding(true); setForm({ title: "", subtitle: "", cta_text: "", cta_link: "", image_url: "", linked_studio: "none" }); }}>
          <Plus className="w-3 h-3" /> إضافة بانر
        </Button>
      </div>

      {adding && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground">بانر جديد</h4>
          <p className="text-[10px] text-muted-foreground">يظهر في الصفحة الرئيسية كبانر سينمائي أفقي قابل للتمرير</p>
          <BannerForm onSubmit={handleAdd} submitLabel="حفظ" onCancel={() => setAdding(false)} />
        </div>
      )}

      {banners.map((b, idx) => (
        <div key={b.id} className={`bg-card rounded-xl border p-3 ${b.is_active ? "border-border/50" : "border-border/20 opacity-60"}`}>
          <p className="text-[9px] text-muted-foreground/60 mb-1.5 font-medium">
            بانر #{idx + 1} — الصفحة الرئيسية
            {b.linked_studio && <span className="text-primary mr-1">← مربوط بـ {getStudioLabel(b.linked_studio)}</span>}
          </p>
          {editingId === b.id ? (
            <BannerForm onSubmit={() => handleUpdate(b.id)} submitLabel="حفظ التعديلات" onCancel={() => setEditingId(null)} />
          ) : (
            <div className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              <img src={b.image_url} alt="" className="w-20 h-12 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{b.title || "بدون عنوان"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{b.subtitle || ""}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggleActive(b)} className="p-1.5 rounded-lg hover:bg-secondary" title={b.is_active ? "إخفاء" : "إظهار"}>
                  {b.is_active ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <button onClick={() => startEdit(b)} className="p-1.5 rounded-lg hover:bg-secondary" title="تعديل">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-destructive/15" title="حذف">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {banners.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-6">لا توجد بانرات. أضف بانر جديد للبدء.</p>
      )}
    </div>
  );
};

export default BannersManager;
