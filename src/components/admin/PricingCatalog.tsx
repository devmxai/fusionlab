import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  X, Pencil, Check, Shield, Zap, Crown, Search,
  Image, Film, Mic, Sparkles, Layers, Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PricingRule {
  id: string;
  model: string;
  provider: string;
  display_name: string | null;
  resolution: string | null;
  quality: string | null;
  duration_seconds: number | null;
  has_audio: boolean | null;
  price_credits: number;
  price_unit: string;
  status: string;
  generation_type: string;
}

interface ModelAccess {
  model: string;
  min_plan: string;
  display_name: string | null;
  is_active: boolean;
  category: string | null;
}

const PLAN_OPTIONS = [
  { value: "free", label: "تجريبي", icon: Zap, color: "text-green-400 bg-green-500/15" },
  { value: "starter", label: "Starter", icon: Shield, color: "text-blue-400 bg-blue-500/15" },
  { value: "plus", label: "Plus", icon: Crown, color: "text-purple-400 bg-purple-500/15" },
  { value: "pro", label: "Pro", icon: Crown, color: "text-amber-400 bg-amber-500/15" },
];

const CATEGORY_TABS = [
  { id: "video", label: "فيديو", icon: Film },
  { id: "image", label: "صور", icon: Image },
  { id: "remix", label: "ريمكس", icon: Wand2 },
  { id: "audio", label: "صوت", icon: Mic },
  { id: "avatar", label: "افتار", icon: Sparkles },
  { id: "remove-bg", label: "حذف الخلفية", icon: Layers },
  { id: "upscale", label: "رفع الجودة", icon: Zap },
];

/** Map generation_type from DB to UI category */
const mapCategory = (rule: PricingRule): string => {
  const gt = rule.generation_type.toLowerCase();
  if (gt === "text-to-video" || gt.includes("video")) return "video";
  if (gt === "text-to-image" || gt.includes("text-to-image")) return "image";
  if (gt === "image-to-image" || gt.includes("remix") || gt.includes("kontext")) return "remix";
  if (gt === "tts" || gt.includes("audio") || gt.includes("tts")) return "audio";
  if (gt === "avatar" || gt.includes("avatar") || gt.includes("animate")) return "avatar";
  if (gt === "remove-bg" || gt.includes("remove")) return "remove-bg";
  if (gt === "upscale" || gt.includes("upscale")) return "upscale";
  return "image"; // fallback
};

const PricingCatalog = ({ onDataChanged }: { onDataChanged?: () => void }) => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [modelAccess, setModelAccess] = useState<ModelAccess[]>([]);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("video");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [rulesRes, accessRes] = await Promise.all([
      supabase.from("pricing_rules").select("*").order("model"),
      supabase.from("model_access").select("*"),
    ]);
    setRules((rulesRes.data || []) as PricingRule[]);
    setModelAccess((accessRes.data || []) as ModelAccess[]);
  };

  const getAccess = (model: string) => modelAccess.find((a) => a.model === model);
  const getModelPlan = (model: string) => getAccess(model)?.min_plan || "free";

  // ── Filtered rules ──
  const filtered = useMemo(() => {
    let list = rules;
    // Category filter
    if (activeTab !== "all") {
      list = list.filter((r) => mapCategory(r) === activeTab);
    }
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.display_name || r.model).toLowerCase().includes(q) ||
          r.provider.toLowerCase().includes(q) ||
          (r.resolution || "").toLowerCase().includes(q) ||
          (r.quality || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rules, modelAccess, activeTab, search]);

  // ── Badges ──
  const planBadge = (plan: string) => {
    const p = PLAN_OPTIONS.find((o) => o.value === plan) || PLAN_OPTIONS[0];
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.color}`}>
        <p.icon className="w-3 h-3" />
        {p.label}
      </span>
    );
  };

  const statusBadge = (status: string) =>
    status === "active" ? (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">نشط</span>
    ) : (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">مراجعة</span>
    );

  // ── Save price ──
  const savePrice = async (ruleId: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) { toast.error("أدخل قيمة صحيحة"); return; }
    setSavingId(ruleId);
    const { error } = await supabase
      .from("pricing_rules")
      .update({ price_credits: val, updated_at: new Date().toISOString() })
      .eq("id", ruleId);
    setSavingId(null);
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم تحديث السعر");
    setEditingPrice(null);
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, price_credits: val } : r)));
    onDataChanged?.();
  };

  // ── Toggle status ──
  const toggleStatus = async (rule: PricingRule) => {
    const newStatus = rule.status === "active" ? "pending_review" : "active";
    setSavingId(rule.id);
    const { error } = await supabase
      .from("pricing_rules")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    setSavingId(null);
    if (error) { toast.error("فشل التحديث"); return; }
    toast.success(newStatus === "active" ? "تم التفعيل" : "تم التعليق");
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status: newStatus } : r)));
    onDataChanged?.();
  };

  // ── Update min_plan ──
  const updateModelPlan = async (model: string, newPlan: string) => {
    setSavingId(model);
    const existing = modelAccess.find((a) => a.model === model);
    let error;
    if (existing) {
      ({ error } = await supabase.from("model_access").update({ min_plan: newPlan }).eq("model", model));
    } else {
      const rule = rules.find((r) => r.model === model);
      ({ error } = await supabase.from("model_access").insert({
        model, min_plan: newPlan,
        display_name: rule?.display_name || model,
        provider: rule?.provider || "unknown",
        is_active: true,
      }));
    }
    setSavingId(null);
    if (error) { toast.error("فشل التحديث"); return; }
    toast.success(`تم تحديث الخطة`);
    setEditingPlan(null);
    setModelAccess((prev) => {
      const idx = prev.findIndex((a) => a.model === model);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], min_plan: newPlan }; return u; }
      return [...prev, { model, min_plan: newPlan, display_name: null, is_active: true, category: null }];
    });
    onDataChanged?.();
  };

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rules.length };
    for (const r of rules) {
      const cat = mapCategory(r);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [rules, modelAccess]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">كتالوج التسعير</h2>
        <span className="text-xs text-muted-foreground">
          {filtered.length} من {rules.length} قاعدة
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="ابحث بالنموذج، المزود، الدقة، الجودة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9 h-9 text-sm bg-secondary/50 border-border/50"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_TABS.map((tab) => {
          const count = tabCounts[tab.id] || 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-card rounded-xl border border-border/50">
        <table className="w-full text-xs" dir="rtl">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="text-right py-3 px-3 font-semibold w-[180px]">النموذج</th>
              <th className="text-right py-3 px-3 font-semibold">المزود</th>
              <th className="text-right py-3 px-3 font-semibold">الدقة</th>
              <th className="text-right py-3 px-3 font-semibold">الجودة</th>
              <th className="text-right py-3 px-3 font-semibold">المدة</th>
              <th className="text-right py-3 px-3 font-semibold">السعر (كريدت)</th>
              <th className="text-right py-3 px-3 font-semibold">الوحدة</th>
              <th className="text-right py-3 px-3 font-semibold">الخطة</th>
              <th className="text-right py-3 px-3 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                    لا توجد نتائج
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isEditingThisPrice = editingPrice === r.id;
                const isSaving = savingId === r.id;
                const isEditingThisPlan = editingPlan === r.model;
                const currentPlan = getModelPlan(r.model);

                return (
                  <motion.tr
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${
                      r.status === "pending_review" ? "bg-amber-500/5" : ""
                    }`}
                  >
                    {/* Model */}
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-foreground text-[11px]">
                        {r.display_name || r.model}
                      </span>
                    </td>

                    {/* Provider */}
                    <td className="py-2.5 px-3 text-muted-foreground">{r.provider}</td>

                    {/* Resolution */}
                    <td className="py-2.5 px-3">
                      {r.resolution ? (
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                          {r.resolution}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Quality */}
                    <td className="py-2.5 px-3">
                      {r.quality ? (
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px] font-medium">
                          {r.quality}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {r.duration_seconds ? `${r.duration_seconds}s` : "—"}
                    </td>

                    {/* Price (editable) */}
                    <td className="py-2.5 px-3">
                      {isEditingThisPrice ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-6 w-16 text-[11px] px-1.5"
                            dir="ltr"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") savePrice(r.id);
                              if (e.key === "Escape") setEditingPrice(null);
                            }}
                          />
                          <button onClick={() => savePrice(r.id)} disabled={isSaving} className="p-0.5 text-green-400 hover:text-green-300">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingPrice(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingPrice(r.id); setEditValue(String(r.price_credits)); }}
                          className="group flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          {r.price_credits}
                          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </button>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 text-muted-foreground text-[10px]">
                      {r.price_unit === "per_second" ? "/ثانية" : "/توليد"}
                    </td>

                    {/* Plan (editable) */}
                    <td className="py-2.5 px-3">
                      {isEditingThisPlan ? (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {PLAN_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              disabled={isSaving}
                              onClick={() => updateModelPlan(r.model, opt.value)}
                              className={`text-[8px] font-bold px-1.5 py-1 rounded transition-colors ${
                                currentPlan === opt.value
                                  ? opt.color + " ring-1 ring-current"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button onClick={() => setEditingPlan(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingPlan(r.model)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                          {planBadge(currentPlan)}
                          <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                        </button>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <button onClick={() => toggleStatus(r)} disabled={isSaving} className="hover:opacity-80 transition-opacity">
                        {statusBadge(r.status)}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PricingCatalog;
