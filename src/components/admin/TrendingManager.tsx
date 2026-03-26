import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Save, Upload, Image, Video } from "lucide-react";

interface TrendingItem {
  id: string;
  title: string | null;
  prompt: string | null;
  sort_order: number | null;
  is_published: boolean | null;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string | null;
}

const TrendingManager = ({ type }: { type: "images" | "videos" }) => {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", prompt: "", url: "", thumbnail_url: "" });

  const table = type === "images" ? "trending_images" : "trending_videos";
  const label = type === "images" ? "صور الترند" : "فيديوهات الترند";

  const fetchItems = async () => {
    const { data } = await supabase.from(table).select("*").order("sort_order");
    setItems((data as TrendingItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [type]);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-content").upload(path, file);
    setUploading(false);
    if (error) { toast.error("فشل الرفع: " + error.message); return null; }
    const { data } = supabase.storage.from("cms-content").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAdd = async () => {
    if (!form.url) { toast.error("يرجى رفع ملف أو إضافة رابط"); return; }
    const insertData: any = {
      title: form.title || null,
      prompt: form.prompt || null,
      sort_order: items.length,
      is_published: true,
    };
    if (type === "images") {
      insertData.image_url = form.url;
    } else {
      insertData.video_url = form.url;
      insertData.thumbnail_url = form.thumbnail_url || null;
    }
    const { error } = await supabase.from(table).insert(insertData);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الإضافة");
    setAdding(false);
    setForm({ title: "", prompt: "", url: "", thumbnail_url: "" });
    fetchItems();
  };

  const handleUpdate = async (id: string) => {
    const updateData: any = {
      title: form.title || null,
      prompt: form.prompt || null,
    };
    if (type === "images") {
      updateData.image_url = form.url;
    } else {
      updateData.video_url = form.url;
      updateData.thumbnail_url = form.thumbnail_url || null;
    }
    const { error } = await supabase.from(table).update(updateData).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    setEditingId(null);
    fetchItems();
  };

  const togglePublished = async (item: TrendingItem) => {
    await supabase.from(table).update({ is_published: !item.is_published }).eq("id", item.id);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العنصر؟")) return;
    await supabase.from(table).delete().eq("id", id);
    toast.success("تم الحذف");
    fetchItems();
  };

  const startEdit = (item: TrendingItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      prompt: item.prompt || "",
      url: type === "images" ? (item.image_url || "") : (item.video_url || ""),
      thumbnail_url: item.thumbnail_url || "",
    });
  };

  if (loading) return <p className="text-xs text-muted-foreground py-4">جاري التحميل...</p>;

  const Icon = type === "images" ? Image : Video;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {label}
        </h3>
        <Button size="sm" className="text-xs gap-1" onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3" /> إضافة
        </Button>
      </div>

      {adding && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان (اختياري)" className="text-xs h-8" />
          <textarea
            value={form.prompt}
            onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
            placeholder="البرومبت (مخفي عن المستخدم - يُنسخ عند الضغط)"
            className="w-full h-20 rounded-lg border border-border bg-secondary px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80">
              <Upload className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{uploading ? "رفع..." : type === "images" ? "رفع صورة" : "رفع فيديو"}</span>
              <input type="file" accept={type === "images" ? "image/*" : "video/*"} className="hidden" onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadFile(file, type === "images" ? "trending-images" : "trending-videos");
                if (url) setForm(f => ({ ...f, url }));
              }} />
            </label>
            {type === "videos" && (
              <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80">
                <Image className="w-3 h-3" />
                <span className="text-[10px] font-semibold">صورة غلاف</span>
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadFile(file, "trending-thumbnails");
                  if (url) setForm(f => ({ ...f, thumbnail_url: url }));
                }} />
              </label>
            )}
            {form.url && (
              type === "images"
                ? <img src={form.url} alt="" className="h-12 rounded-md" />
                : <span className="text-[10px] text-green-400">✓ فيديو مرفوع</span>
            )}
          </div>
          <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="أو الصق رابط مباشر" className="text-xs h-8" dir="ltr" />
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={handleAdd}><Save className="w-3 h-3 ml-1" />حفظ</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setAdding(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className={`bg-card rounded-xl border p-3 ${item.is_published ? "border-border/50" : "border-border/20 opacity-60"}`}>
          {editingId === item.id ? (
            <div className="space-y-3">
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                placeholder="البرومبت"
                className="w-full h-20 rounded-lg border border-border bg-secondary px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer">
                  <Upload className="w-3 h-3" /><span className="text-[10px]">استبدال</span>
                  <input type="file" accept={type === "images" ? "image/*" : "video/*"} className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file, type === "images" ? "trending-images" : "trending-videos");
                    if (url) setForm(f => ({ ...f, url }));
                  }} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={() => handleUpdate(item.id)}><Save className="w-3 h-3 ml-1" />حفظ</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingId(null)}>إلغاء</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary shrink-0">
                {type === "images" && item.image_url && (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                )}
                {type === "videos" && (item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Video className="w-5 h-5 text-muted-foreground" /></div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{item.title || "بدون عنوان"}</p>
                {item.prompt && <p className="text-[10px] text-muted-foreground truncate">🔒 {item.prompt.slice(0, 50)}...</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => togglePublished(item)} className="p-1.5 rounded-lg hover:bg-secondary">
                  {item.is_published ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-secondary">
                  <Save className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/15">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-6">لا توجد عناصر.</p>
      )}
    </div>
  );
};

export default TrendingManager;
