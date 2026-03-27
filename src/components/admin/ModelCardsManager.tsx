import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Eye, EyeOff, Save, Upload, Layers, Pencil, X, Plus, GripVertical } from "lucide-react";
import { tools } from "@/data/tools";
import { compressImage } from "@/lib/image-compress";

interface Tab {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
  is_visible: boolean;
  is_system: boolean;
}

interface ModelCard {
  id: string;
  tool_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  display_section: string | null;
  media_type: string | null;
  sort_order: number;
  is_visible: boolean;
}

const CATEGORY_TAB_MAP: Record<string, string> = {
  "صور": "images",
  "فيديو": "videos",
  "ريمكس": "remix",
  "افتار": "avatar",
  "حذف الخلفية": "remove-bg",
  "رفع الجودة": "upscale",
};

const ModelCardsManager = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [cards, setCards] = useState<ModelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("latest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", tool_id: "" });
  const [syncing, setSyncing] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addingTab, setAddingTab] = useState(false);
  const [newTabForm, setNewTabForm] = useState({ label: "", slug: "" });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTabForm, setEditTabForm] = useState({ label: "" });

  const fetchAll = async () => {
    const [tabsRes, cardsRes] = await Promise.all([
      supabase.from("model_card_tabs").select("*").order("sort_order"),
      supabase.from("model_cards").select("*").order("sort_order"),
    ]);
    setTabs((tabsRes.data as Tab[]) || []);
    setCards((cardsRes.data as ModelCard[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Tools available for current tab
  const getToolsForTab = (tabSlug: string) => {
    if (tabSlug === "latest") return tools; // latest can pick from all
    // Find matching category
    const catEntry = Object.entries(CATEGORY_TAB_MAP).find(([, slug]) => slug === tabSlug);
    if (catEntry) return tools.filter(t => t.category === catEntry[0]);
    return tools; // custom tabs can pick any
  };

  const tabCards = cards.filter(c => c.display_section === activeTab);
  const availableTools = getToolsForTab(activeTab);
  const usedToolIds = new Set(tabCards.map(c => c.tool_id));
  const addableTools = availableTools.filter(t => !usedToolIds.has(t.id));

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 1200, quality: 0.82, maxSizeKB: 250 });
      const ext = compressed.name.split(".").pop() || "webp";
      const path = `model-cards/${Date.now()}.${ext}`;
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

  // Sync all tools for this tab
  const syncTabTools = async () => {
    setSyncing(true);
    const missing = addableTools;
    if (missing.length === 0) {
      toast.info("جميع النماذج مضافة لهذا التبويب");
      setSyncing(false);
      return;
    }
    const mediaType = ["videos", "avatar"].includes(activeTab) ? "video" : "image";
    const rows = missing.map((t, i) => ({
      tool_id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      display_section: activeTab,
      media_type: t.category === "فيديو" || t.category === "افتار" ? "video" : "image",
      sort_order: tabCards.length + i,
      is_visible: true,
      image_url: null,
    }));
    const { error } = await supabase.from("model_cards").insert(rows);
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم إضافة ${missing.length} نموذج`);
    fetchAll();
  };

  const handleAddCard = async () => {
    if (!form.tool_id) { toast.error("اختر نموذجًا"); return; }
    const tool = tools.find(t => t.id === form.tool_id);
    const mediaType = tool?.category === "فيديو" || tool?.category === "افتار" ? "video" : "image";
    const { error } = await supabase.from("model_cards").insert({
      tool_id: form.tool_id,
      title: form.title || tool?.title || null,
      description: form.description || tool?.description || null,
      image_url: form.image_url || null,
      display_section: activeTab,
      media_type: mediaType,
      category: tool?.category || null,
      sort_order: tabCards.length,
      is_visible: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة الكارد");
    setAddingCard(false);
    setForm({ title: "", description: "", image_url: "", tool_id: "" });
    fetchAll();
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
    fetchAll();
  };

  const toggleVisible = async (c: ModelCard) => {
    await supabase.from("model_cards").update({ is_visible: !c.is_visible }).eq("id", c.id);
    fetchAll();
  };

  const deleteCard = async (id: string) => {
    if (!confirm("حذف هذا الكارد؟")) return;
    await supabase.from("model_cards").delete().eq("id", id);
    toast.success("تم الحذف");
    fetchAll();
  };

  const startEdit = (c: ModelCard) => {
    setEditingId(c.id);
    const tool = tools.find(t => t.id === c.tool_id);
    setForm({
      title: c.title || tool?.title || "",
      description: c.description || tool?.description || "",
      image_url: c.image_url || "",
      tool_id: c.tool_id,
    });
  };

  // Tab management
  const handleAddTab = async () => {
    if (!newTabForm.label) { toast.error("أدخل اسم التبويب"); return; }
    const slug = newTabForm.slug || newTabForm.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabase.from("model_card_tabs").insert({
      slug,
      label: newTabForm.label,
      sort_order: tabs.length,
      is_visible: true,
      is_system: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة التبويب");
    setAddingTab(false);
    setNewTabForm({ label: "", slug: "" });
    fetchAll();
  };

  const toggleTabVisible = async (tab: Tab) => {
    await supabase.from("model_card_tabs").update({ is_visible: !tab.is_visible }).eq("id", tab.id);
    fetchAll();
  };

  const deleteTab = async (tab: Tab) => {
    if (tab.is_system) { toast.error("لا يمكن حذف تبويب أساسي"); return; }
    if (!confirm(`حذف تبويب "${tab.label}"؟ سيتم حذف جميع الكاردات المرتبطة.`)) return;
    await supabase.from("model_cards").delete().eq("display_section", tab.slug);
    await supabase.from("model_card_tabs").delete().eq("id", tab.id);
    toast.success("تم الحذف");
    if (activeTab === tab.slug) setActiveTab("latest");
    fetchAll();
  };

  const saveTabEdit = async (tabId: string) => {
    await supabase.from("model_card_tabs").update({ label: editTabForm.label, updated_at: new Date().toISOString() }).eq("id", tabId);
    toast.success("تم التحديث");
    setEditingTabId(null);
    fetchAll();
  };

  if (loading) return <p className="text-xs text-muted-foreground py-4">جاري التحميل...</p>;

  const currentTab = tabs.find(t => t.slug === activeTab);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> كاردات النماذج
        </h3>
        <span className="text-[10px] text-muted-foreground">{tabCards.length} كارد في {currentTab?.label}</span>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.filter(t => t.is_visible).map(tab => (
          <div key={tab.id} className="relative group">
            <button
              onClick={() => setActiveTab(tab.slug)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                activeTab === tab.slug
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="mr-1 text-[9px] opacity-60">
                ({cards.filter(c => c.display_section === tab.slug).length})
              </span>
            </button>
            {/* Tab actions on hover */}
            <div className="absolute -top-1 -left-1 hidden group-hover:flex gap-0.5 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingTabId(tab.id); setEditTabForm({ label: tab.label }); }}
                className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center"
                title="تعديل"
              >
                <Pencil className="w-2 h-2 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTabVisible(tab); }}
                className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center"
                title={tab.is_visible ? "إخفاء" : "إظهار"}
              >
                {tab.is_visible ? <Eye className="w-2 h-2 text-green-400" /> : <EyeOff className="w-2 h-2" />}
              </button>
              {!tab.is_system && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTab(tab); }}
                  className="w-4 h-4 rounded-full bg-destructive/20 flex items-center justify-center"
                  title="حذف"
                >
                  <Trash2 className="w-2 h-2 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Hidden tabs */}
        {tabs.filter(t => !t.is_visible).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.slug); }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-secondary/40 text-muted-foreground/40 line-through"
          >
            {tab.label}
          </button>
        ))}

        {/* Add tab button */}
        <button
          onClick={() => setAddingTab(true)}
          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="تبويب جديد"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Edit tab inline */}
      {editingTabId && (
        <div className="flex items-center gap-2 bg-card rounded-lg border border-primary/30 p-3">
          <Input
            value={editTabForm.label}
            onChange={e => setEditTabForm({ label: e.target.value })}
            placeholder="اسم التبويب"
            className="text-xs h-8 max-w-[200px]"
          />
          <Button size="sm" className="text-xs h-8" onClick={() => saveTabEdit(editingTabId)}>
            <Save className="w-3 h-3 ml-1" />حفظ
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setEditingTabId(null)}>إلغاء</Button>
        </div>
      )}

      {/* Add new tab form */}
      {addingTab && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground">تبويب جديد</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={newTabForm.label}
              onChange={e => setNewTabForm(f => ({ ...f, label: e.target.value }))}
              placeholder="اسم التبويب (مثال: الأنسب سعراً)"
              className="text-xs h-8"
            />
            <Input
              value={newTabForm.slug}
              onChange={e => setNewTabForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="slug (اختياري، مثال: best-price)"
              className="text-xs h-8"
              dir="ltr"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={handleAddTab}><Save className="w-3 h-3 ml-1" />إنشاء</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setAddingTab(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="text-xs gap-1" onClick={() => { setAddingCard(true); setForm({ title: "", description: "", image_url: "", tool_id: "" }); }}>
          <Plus className="w-3 h-3" /> إضافة كارد
        </Button>
        {addableTools.length > 0 && (
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={syncTabTools} disabled={syncing}>
            {syncing ? "جاري..." : `مزامنة ${addableTools.length} نموذج`}
          </Button>
        )}
      </div>

      {/* Add card form */}
      {addingCard && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground">كارد جديد في "{currentTab?.label}"</h4>

          {/* Tool selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">اختر النموذج:</label>
            <select
              value={form.tool_id}
              onChange={e => {
                const t = tools.find(x => x.id === e.target.value);
                setForm(f => ({
                  ...f,
                  tool_id: e.target.value,
                  title: t?.title || "",
                  description: t?.description || "",
                }));
              }}
              className="w-full h-8 rounded-lg border border-border bg-secondary px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— اختر نموذجًا —</option>
              {addableTools.map(t => (
                <option key={t.id} value={t.id}>{t.title} — {t.provider} ({t.category})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" className="text-xs h-8" />
          </div>

          {/* Upload */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
              <Upload className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{uploading ? "رفع..." : "رفع صورة/فيديو"}</span>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={async e => {
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
            <Button size="sm" className="text-xs gap-1" onClick={handleAddCard}><Save className="w-3 h-3" /> حفظ</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setAddingCard(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {/* Cards list */}
      <div className="space-y-2">
        {tabCards.map(c => {
          const tool = tools.find(t => t.id === c.tool_id);
          return (
            <div key={c.id} className={`bg-card rounded-xl border p-3 ${c.is_visible ? "border-border/50" : "border-border/20 opacity-50"}`}>
              {editingId === c.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                    <span className="font-bold text-foreground">{tool?.title || c.tool_id}</span>
                    <span className="text-[9px]" dir="ltr">({c.tool_id})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="العنوان" className="text-xs h-8" />
                    <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="الوصف" className="text-xs h-8" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                      <Upload className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{uploading ? "رفع..." : "استبدال الصورة"}</span>
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={async e => {
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
                    <Button size="sm" className="text-xs gap-1" onClick={() => handleUpdate(c.id)}><Save className="w-3 h-3" /> حفظ</Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingId(null)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px] text-muted-foreground/50">—</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{c.title || tool?.title || c.tool_id}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.description || tool?.description || "—"}</p>
                    <span className="text-[9px] text-muted-foreground/60" dir="ltr">{c.tool_id}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleVisible(c)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title={c.is_visible ? "إخفاء" : "إظهار"}>
                      {c.is_visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="تعديل">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteCard(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors" title="حذف">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tabCards.length === 0 && !addingCard && (
        <div className="text-center py-8 space-y-3">
          <p className="text-xs text-muted-foreground">لا توجد كاردات في "{currentTab?.label}".</p>
          {addableTools.length > 0 && (
            <Button size="sm" className="text-xs" onClick={syncTabTools} disabled={syncing}>
              مزامنة {addableTools.length} نموذج تلقائياً
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelCardsManager;
