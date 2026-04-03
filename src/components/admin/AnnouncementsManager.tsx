import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  is_active: boolean | null;
  show_once: boolean | null;
  sort_order: number | null;
}

const AnnouncementsManager = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    image_url: "",
    cta_text: "جرب الآن",
    cta_link: "/studio/seedance",
    is_active: true,
    show_once: true,
  });

  const fetchItems = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("sort_order", { ascending: true });
    setItems((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const resetForm = () => {
    setEditId(null);
    setForm({ title: "", description: "", image_url: "", cta_text: "جرب الآن", cta_link: "/studio/seedance", is_active: true, show_once: true });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("العنوان مطلوب"); return; }

    if (editId) {
      const { error } = await supabase.from("announcements").update({
        title: form.title, description: form.description || null,
        image_url: form.image_url || null, cta_text: form.cta_text || null,
        cta_link: form.cta_link || null, is_active: form.is_active, show_once: form.show_once,
        updated_at: new Date().toISOString(),
      }).eq("id", editId);
      if (error) { toast.error("فشل التحديث"); return; }
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("announcements").insert({
        title: form.title, description: form.description || null,
        image_url: form.image_url || null, cta_text: form.cta_text || null,
        cta_link: form.cta_link || null, is_active: form.is_active, show_once: form.show_once,
      });
      if (error) { toast.error("فشل الإضافة"); return; }
      toast.success("تمت الإضافة");
    }
    resetForm();
    fetchItems();
  };

  const handleEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      title: a.title, description: a.description || "",
      image_url: a.image_url || "", cta_text: a.cta_text || "",
      cta_link: a.cta_link || "", is_active: a.is_active ?? true, show_once: a.show_once ?? true,
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    fetchItems();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("announcements").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id);
    fetchItems();
  };

  if (loading) return <div className="text-center text-muted-foreground text-sm py-6">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Form */}
      <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">{editId ? "تعديل إعلان" : "إضافة إعلان جديد"}</h3>
        <Input placeholder="العنوان" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea placeholder="الوصف (اختياري)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        <Input placeholder="رابط الصورة (اختياري)" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="نص الزر" value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} />
          <Input placeholder="رابط الزر" value={form.cta_link} onChange={e => setForm(f => ({ ...f, cta_link: e.target.value }))} />
        </div>
        <div className="flex items-center gap-6 text-xs">
          <label className="flex items-center gap-2 text-muted-foreground">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            نشط
          </label>
          <label className="flex items-center gap-2 text-muted-foreground">
            <Switch checked={form.show_once} onCheckedChange={v => setForm(f => ({ ...f, show_once: v }))} />
            عرض مرة واحدة
          </label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            {editId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {editId ? "حفظ" : "إضافة"}
          </Button>
          {editId && <Button size="sm" variant="ghost" onClick={resetForm}><X className="w-3.5 h-3.5" /></Button>}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map(a => (
          <div key={a.id} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-3">
            {a.image_url && (
              <img src={a.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{a.cta_link}</p>
            </div>
            <Switch checked={a.is_active ?? false} onCheckedChange={v => handleToggle(a.id, v)} />
            <Button size="icon" variant="ghost" onClick={() => handleEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">لا توجد إعلانات بعد</p>}
      </div>
    </div>
  );
};

export default AnnouncementsManager;
