import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Save, X, Pencil, Check, ChevronDown, Shield, Zap, Crown,
} from "lucide-react";

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
}

const PLAN_OPTIONS = [
  { value: "free", label: "مجاني (تجريبي)", icon: Zap, color: "text-green-400 bg-green-500/15" },
  { value: "starter", label: "Starter", icon: Shield, color: "text-blue-400 bg-blue-500/15" },
  { value: "plus", label: "Plus", icon: Crown, color: "text-purple-400 bg-purple-500/15" },
  { value: "pro", label: "Pro", icon: Crown, color: "text-amber-400 bg-amber-500/15" },
];

const PricingCatalog = ({ onDataChanged }: { onDataChanged?: () => void }) => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [modelAccess, setModelAccess] = useState<ModelAccess[]>([]);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [rulesRes, accessRes] = await Promise.all([
      supabase.from("pricing_rules").select("*").order("model"),
      supabase.from("model_access").select("*"),
    ]);
    setRules((rulesRes.data || []) as PricingRule[]);
    setModelAccess((accessRes.data || []) as ModelAccess[]);
  };

  const getModelPlan = (model: string): string => {
    const access = modelAccess.find((a) => a.model === model);
    return access?.min_plan || "free";
  };

  const planBadge = (plan: string) => {
    const p = PLAN_OPTIONS.find((o) => o.value === plan) || PLAN_OPTIONS[0];
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.color}`}>
        <p.icon className="w-3 h-3" />
        {p.label}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    if (status === "active") {
      return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">نشط</span>;
    }
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">بانتظار المراجعة</span>;
  };

  // ── Save price ──
  const savePrice = async (ruleId: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      toast.error("أدخل قيمة صحيحة");
      return;
    }
    setSavingId(ruleId);
    const { error } = await supabase
      .from("pricing_rules")
      .update({ price_credits: val, updated_at: new Date().toISOString() })
      .eq("id", ruleId);
    setSavingId(null);
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
      return;
    }
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
    if (error) {
      toast.error("فشل التحديث: " + error.message);
      return;
    }
    toast.success(newStatus === "active" ? "تم التفعيل" : "تم التعليق");
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status: newStatus } : r)));
    onDataChanged?.();
  };

  // ── Update min_plan via model_access ──
  const updateModelPlan = async (model: string, newPlan: string) => {
    setSavingId(model);
    const existing = modelAccess.find((a) => a.model === model);
    let error;
    if (existing) {
      ({ error } = await supabase
        .from("model_access")
        .update({ min_plan: newPlan })
        .eq("model", model));
    } else {
      // Insert new model_access row
      const rule = rules.find((r) => r.model === model);
      ({ error } = await supabase.from("model_access").insert({
        model,
        min_plan: newPlan,
        display_name: rule?.display_name || model,
        provider: rule?.provider || "unknown",
        is_active: true,
      }));
    }
    setSavingId(null);
    if (error) {
      toast.error("فشل التحديث: " + error.message);
      return;
    }
    toast.success(`تم تحديث الخطة المطلوبة إلى ${PLAN_OPTIONS.find((o) => o.value === newPlan)?.label}`);
    setEditingPlan(null);
    setModelAccess((prev) => {
      const idx = prev.findIndex((a) => a.model === model);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], min_plan: newPlan };
        return updated;
      }
      return [...prev, { model, min_plan: newPlan, display_name: null, is_active: true }];
    });
    onDataChanged?.();
  };

  // Group rules by model for the plan column
  const uniqueModels = [...new Set(rules.map((r) => r.model))];

  const pendingCount = rules.filter((r) => r.status === "pending_review").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-foreground">كتالوج التسعير</h2>
        {pendingCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            {pendingCount} بانتظار المراجعة
          </span>
        )}
      </div>

      {/* Model Plan Controls */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          الحد الأدنى للخطة حسب النموذج
        </h3>
        <p className="text-[10px] text-muted-foreground">
          تحكّم بالخطة المطلوبة لكل نموذج. إذا اخترت "Pro"، لن يتمكن مستخدمو الفترة التجريبية من استخدام هذا النموذج.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {uniqueModels.map((model) => {
            const currentPlan = getModelPlan(model);
            const rule = rules.find((r) => r.model === model);
            const isEditing = editingPlan === model;
            const isSaving = savingId === model;

            return (
              <div
                key={model}
                className="bg-secondary/30 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">
                    {rule?.display_name || model}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate" dir="ltr">
                    {rule?.provider || "—"}
                  </p>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {PLAN_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        disabled={isSaving}
                        onClick={() => updateModelPlan(model, opt.value)}
                        className={`text-[8px] font-bold px-1.5 py-1 rounded transition-colors ${
                          currentPlan === opt.value
                            ? opt.color + " ring-1 ring-current"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setEditingPlan(null)}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingPlan(model)}
                    className="flex items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {planBadge(currentPlan)}
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Table */}
      <div className="overflow-x-auto bg-card rounded-xl border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="text-right py-2.5 px-3 font-semibold">النموذج</th>
              <th className="text-right py-2.5 px-3 font-semibold">المزود</th>
              <th className="text-right py-2.5 px-3 font-semibold">الدقة</th>
              <th className="text-right py-2.5 px-3 font-semibold">الجودة</th>
              <th className="text-right py-2.5 px-3 font-semibold">المدة</th>
              <th className="text-right py-2.5 px-3 font-semibold">السعر</th>
              <th className="text-right py-2.5 px-3 font-semibold">الوحدة</th>
              <th className="text-right py-2.5 px-3 font-semibold">الخطة</th>
              <th className="text-right py-2.5 px-3 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const isEditingThisPrice = editingPrice === r.id;
              const isSaving = savingId === r.id;

              return (
                <tr
                  key={r.id}
                  className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${
                    r.status === "pending_review" ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="py-2 px-3 font-semibold text-foreground">
                    {r.display_name || r.model}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{r.provider}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.resolution || "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.quality || "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {r.duration_seconds ? `${r.duration_seconds}s` : "—"}
                  </td>

                  {/* Editable Price Cell */}
                  <td className="py-2 px-3">
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
                        <button
                          onClick={() => savePrice(r.id)}
                          disabled={isSaving}
                          className="p-0.5 text-green-400 hover:text-green-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingPrice(null)}
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPrice(r.id);
                          setEditValue(String(r.price_credits));
                        }}
                        className="group flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        {r.price_credits}
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                      </button>
                    )}
                  </td>

                  <td className="py-2 px-3 text-muted-foreground">
                    {r.price_unit === "per_second" ? "/ثانية" : "/توليد"}
                  </td>

                  {/* Min Plan Badge */}
                  <td className="py-2 px-3">{planBadge(getModelPlan(r.model))}</td>

                  {/* Status Toggle */}
                  <td className="py-2 px-3">
                    <button
                      onClick={() => toggleStatus(r)}
                      disabled={isSaving}
                      className="hover:opacity-80 transition-opacity"
                    >
                      {statusBadge(r.status)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PricingCatalog;
