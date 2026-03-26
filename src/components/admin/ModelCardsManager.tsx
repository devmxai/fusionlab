import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Save, Upload, Layers } from "lucide-react";
import { tools } from "@/data/tools";

interface ModelCard {
  id: string;
  tool_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  sort_order: number;
  is_visible: boolean;
}

const ModelCardsManager = () => {
  const [cards, setCards] = useState<ModelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", tool_id: "" });
  const [adding, setAdding] = useState(false);

  const fetchCards = async () => {
    const { data } = await supabase.from("model_cards").select("*").order("sort_order");
    setCards((data as ModelCard[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, []);

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

  // Tools that don't yet have a model_card entry
  const unmanagedTools = tools.filter(t => !cards.some(c => c.tool_id === t.id));

  const handleAdd = async () => {
    if (!form.tool_id) { toast.error("اختر أداة"); return; }
    const tool = tools.find(t => t.id === form.tool_id);
    const { error } = await supabase.from("model_cards").insert({
      tool_id: form.tool_id,
      title: form.title || tool?.title || null,
      description: form.description || tool?.description || null,
      image_url: form.image_url || null,
      category: tool?.category || null,
      sort_order: cards.length,
      is_visible: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة الكارد");
    setAdding(false);
    setForm({ title: "", description: "", image_url: "", tool_id: "" });
    fetchCards();
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("model_cards").update({
      title: form.title || null,
      description: form.description || null,
      image_url: form.image_url || null,
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

  const handleDelete = async (id: string) => {
    if (!confirm("حذف كارد هذا النموذج؟")) return;
    await supabase.from("model_cards").delete().eq("id", id);
    toast.success("تم الحذف");
    fetchCards();
  };

  const startEdit = (c: ModelCard) => {
    setEditingId(c.id);
    setForm({ title: c.title || "", description: c.description || "", image_url: c.image_url || "", tool_id: c.tool_id });
  };

  if (loading) return <p className="text-xs text-muted-foreground py-4">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> كاردات النماذج
        </h3>
        <Button size="sm" className="text-xs gap-1" onClick={() => setAdding(true)} disabled={unmanagedTools.length === 0}>
          <Plus className="w-3 h-3" /> إضافة كارد
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {cards.length} كارد مُدار • {unmanagedTools.length} أداة بدون كارد مخصص (تستخدم الصور الافتراضية)
      </p>

      {adding && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <select
            value={form.tool_id}
            onChange={e => {
              const t = tools.find(x => x.id === e.target.value);
              setForm(f => ({ ...f, tool_id: e.target.value, title: t?.title || "", description: t?.description || "" }));
            }}
            className="w-full h-8 rounded-lg bg-secondary border border-border/50 px-3 text-xs text-foreground"
          >
            <option value="">اختر أداة...</option>
            {unmanagedTools.map(t => <option key={t.id} value={t.id}>{t.title} ({t.category})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" className="text-xs h-8" />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80">
              <Upload className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{uploading ? "رفع..." : "رفع صورة الكارد"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setForm(f => ({ ...f, image_url: url }));
              }} />
            </label>
            {form.image_url && <img src={form.image_url} alt="" className="h-12 rounded-md" />}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={handleAdd}><Save className="w-3 h-3 ml-1" />حفظ</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setAdding(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {cards.map(c => (
        <div key={c.id} className={`bg-card rounded-xl border p-3 ${c.is_visible ? "border-border/50" : "border-border/20 opacity-60"}`}>
          {editingId === c.id ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" className="text-xs h-8" />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer">
                  <Upload className="w-3 h-3" /><span className="text-[10px]">استبدال الصورة</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadImage(file);
                    if (url) setForm(f => ({ ...f, image_url: url }));
                  }} />
                </label>
                {form.image_url && <img src={form.image_url} alt="" className="h-12 rounded-md" />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={() => handleUpdate(c.id)}><Save className="w-3 h-3 ml-1" />حفظ</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingId(null)}>إلغاء</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary shrink-0">
                {c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center"><Layers className="w-5 h-5 text-muted-foreground" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{c.title || c.tool_id}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.description || "—"}</p>
                <p className="text-[9px] text-muted-foreground">{c.category}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggleVisible(c)} className="p-1.5 rounded-lg hover:bg-secondary">
                  {c.is_visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-secondary">
                  <Save className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/15">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ModelCardsManager;
