import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Users, Crown, Coins, Clock, Shield, Check, X,
  Search, BarChart3, FileText, CreditCard, Tag, History, Settings,
  ChevronDown, AlertCircle, RefreshCw, Eye, Pencil, Save, PanelTop, UserCog
} from "lucide-react";
import ContentTab from "@/components/admin/ContentTab";
import { toast } from "sonner";

/* ── Editable Plan Card ── */
const PlanCard = ({ plan, onSaved }: { plan: any; onSaved: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [nameAr, setNameAr] = useState(plan.name_ar);
  const [nameEn, setNameEn] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [credits, setCredits] = useState(String(plan.credits_per_month));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("subscription_plans").update({
      name_ar: nameAr,
      name: nameEn,
      price: parseFloat(price) || 0,
      credits_per_month: parseInt(credits) || 0,
    }).eq("id", plan.id);
    setSaving(false);
    if (error) { toast.error("فشل الحفظ: " + error.message); return; }
    toast.success("تم تحديث الخطة");
    setEditing(false);
    onSaved();
  };

  if (editing) {
    return (
      <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">الاسم (عربي)</label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">الاسم (إنجليزي)</label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="text-xs h-8" dir="ltr" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">السعر (د.ع/شهر)</label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="text-xs h-8" dir="ltr" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">كريدت/شهر</label>
            <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="text-xs h-8" dir="ltr" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="text-xs gap-1" onClick={save} disabled={saving}>
            <Save className="w-3 h-3" />{saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(false)}>إلغاء</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-bold text-foreground">{plan.name_ar}</p>
          <p className="text-[10px] text-muted-foreground" dir="ltr">{plan.name} • {plan.type}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-lg font-extrabold text-primary">{Number(plan.price).toLocaleString("ar")} <span className="text-xs font-normal">د.ع</span></p>
            <p className="text-[10px] text-muted-foreground">/شهر</p>
          </div>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="تعديل">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Coins className="w-3 h-3" />
        <span>{plan.credits_per_month} كريدت/شهر</span>
        <span className={`mr-auto text-[9px] font-bold px-2 py-0.5 rounded-full ${plan.is_active ? "bg-green-500/15 text-green-400" : "bg-secondary text-muted-foreground"}`}>
          {plan.is_active ? "مفعّل" : "معطّل"}
        </span>
      </div>
    </div>
  );
};

type Tab = "dashboard" | "users" | "subscriptions" | "plans" | "pricing" | "ledger" | "trials" | "audit" | "generations" | "content" | "roles";

const tabs: { id: Tab; label: string; icon: any; superOnly?: boolean }[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: BarChart3 },
  { id: "users", label: "المستخدمون", icon: Users },
  { id: "roles", label: "إدارة الأدوار", icon: UserCog, superOnly: true },
  { id: "subscriptions", label: "الاشتراكات", icon: Crown },
  { id: "plans", label: "الخطط", icon: CreditCard },
  { id: "pricing", label: "التسعير", icon: Tag, superOnly: true },
  { id: "ledger", label: "سجل الكريدت", icon: FileText },
  { id: "trials", label: "التجارب", icon: Clock },
  { id: "generations", label: "التوليدات", icon: RefreshCw },
  { id: "audit", label: "سجل العمليات", icon: History, superOnly: true },
  { id: "content", label: "المحتوى", icon: PanelTop },
];

const AdminPage = () => {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    totalUsers: 0, activeSubscriptions: 0, pendingTrials: 0,
    totalCreditsGranted: 0, totalCreditsSpent: 0, pendingPricing: 0, totalGenerations: 0,
  });

  // Modals
  const [grantModal, setGrantModal] = useState<{ userId: string; email: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDescription, setGrantDescription] = useState("");
  const [subModal, setSubModal] = useState<{ userId: string; email: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [subDays, setSubDays] = useState("30");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [roleSearchResults, setRoleSearchResults] = useState<any[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  const visibleTabs = tabs.filter(t => !t.superOnly || isSuperAdmin);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && !isAdmin) navigate("/");
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin, tab]);

  const fetchData = async () => {
    const [profilesRes, plansRes, trialsRes, subsRes, pricingRes, ledgerRes, auditRes, gensRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("*").order("price"),
      supabase.from("trial_requests").select("*, profiles(email, full_name)").order("created_at", { ascending: false }),
      supabase.from("user_subscriptions").select("*, profiles(email, full_name), subscription_plans(name, name_ar, type)").order("created_at", { ascending: false }),
      supabase.from("pricing_rules").select("*").order("model"),
      supabase.from("credit_transactions").select("*, profiles(email, full_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("audit_logs").select("*, profiles:actor_id(email, full_name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("generations").select("*, profiles:user_id(email)").order("created_at", { ascending: false }).limit(100),
    ]);

    setUsers(profilesRes.data || []);
    setPlans(plansRes.data || []);
    setTrials(trialsRes.data || []);
    setSubscriptions(subsRes.data || []);
    setPricingRules(pricingRes.data || []);
    setLedger(ledgerRes.data || []);
    setAuditLogs(auditRes.data || []);
    setGenerations(gensRes.data || []);

    if (plansRes.data?.length && !selectedPlanId) setSelectedPlanId(plansRes.data[0]?.id || "");

    setStats({
      totalUsers: profilesRes.data?.length || 0,
      activeSubscriptions: subsRes.data?.filter((s: any) => s.status === "active").length || 0,
      pendingTrials: trialsRes.data?.filter((t: any) => t.status === "pending").length || 0,
      totalCreditsGranted: (ledgerRes.data || []).filter((l: any) => l.action !== "spent").reduce((a: number, b: any) => a + b.amount, 0),
      totalCreditsSpent: (ledgerRes.data || []).filter((l: any) => l.action === "spent").reduce((a: number, b: any) => a + b.amount, 0),
      pendingPricing: pricingRes.data?.filter((p: any) => p.status === "pending_review").length || 0,
      totalGenerations: gensRes.data?.length || 0,
    });
  };

  // ── Admin RPC Actions ──
  const grantCredits = async () => {
    if (!grantModal || !grantAmount) return;
    const amount = parseInt(grantAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("أدخل رقم صحيح"); return; }

    const { data, error } = await supabase.rpc("admin_grant_credits", {
      p_target_user_id: grantModal.userId,
      p_amount: amount,
      p_description: grantDescription || "منحة من الإدارة",
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "فشلت العملية"); return; }
    toast.success(`تم إضافة ${amount} كريدت`);
    setGrantModal(null);
    setGrantAmount("");
    setGrantDescription("");
    fetchData();
  };

  const activateSubscription = async () => {
    if (!subModal || !selectedPlanId) return;
    const days = parseInt(subDays) || 30;

    const { data, error } = await supabase.rpc("admin_activate_subscription", {
      p_target_user_id: subModal.userId,
      p_plan_id: selectedPlanId,
      p_days: days,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "فشلت العملية"); return; }
    toast.success("تم تفعيل الاشتراك");
    setSubModal(null);
    fetchData();
  };

  const handleTrial = async (trialId: string, approve: boolean) => {
    const { data, error } = await supabase.rpc("admin_handle_trial", {
      p_trial_id: trialId,
      p_approve: approve,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "فشلت العملية"); return; }
    toast.success(approve ? "تمت الموافقة" : "تم الرفض");
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <p className="text-muted-foreground text-sm">جاري تحميل صلاحيات الأدمن...</p>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const filteredUsers = users.filter((u) =>
    !searchQuery || u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.includes(searchQuery)
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: "bg-green-500/15", text: "text-green-400", label: "نشط" },
      pending: { bg: "bg-amber-500/15", text: "text-amber-400", label: "معلق" },
      expired: { bg: "bg-secondary", text: "text-muted-foreground", label: "منتهي" },
      cancelled: { bg: "bg-destructive/15", text: "text-destructive", label: "ملغي" },
      approved: { bg: "bg-green-500/15", text: "text-green-400", label: "مقبول" },
      rejected: { bg: "bg-destructive/15", text: "text-destructive", label: "مرفوض" },
      pending_review: { bg: "bg-amber-500/15", text: "text-amber-400", label: "بانتظار المراجعة" },
    };
    const s = map[status] || { bg: "bg-secondary", text: "text-muted-foreground", label: status };
    return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const actionBadge = (action: string) => {
    const map: Record<string, { color: string; label: string }> = {
      spent: { color: "text-destructive", label: "خصم" },
      admin_grant: { color: "text-green-400", label: "منحة" },
      subscription_grant: { color: "text-blue-400", label: "اشتراك" },
      trial_grant: { color: "text-purple-400", label: "تجربة" },
      refund: { color: "text-amber-400", label: "استرداد" },
      earned: { color: "text-green-400", label: "مكتسب" },
    };
    const a = map[action] || { color: "text-muted-foreground", label: action };
    return <span className={`text-[10px] font-bold ${a.color}`}>{a.label}</span>;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-l border-border/30 bg-card/50">
        <div className="p-4 border-b border-border/30 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground">لوحة الإدارة</h1>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {visibleTabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === "trials" && stats.pendingTrials > 0 && (
                <span className="mr-auto w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">{stats.pendingTrials}</span>
              )}
              {t.id === "pricing" && stats.pendingPricing > 0 && (
                <span className="mr-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">{stats.pendingPricing}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border/30">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للموقع
          </button>
        </div>
      </aside>

      {/* ── Mobile Header + Sidebar ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="w-5 h-5" />
              </button>
              <Shield className="w-4 h-4 text-primary" />
              <h1 className="text-base font-bold text-foreground">لوحة التحكم</h1>
            </div>
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed top-0 right-0 bottom-0 z-50 w-64 bg-card border-l border-border/30 flex flex-col md:hidden"
              >
                <div className="p-4 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">الأقسام</h2>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                  {tabs.map((t) => (
                    <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                        tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}>
                      <t.icon className="w-4 h-4" />
                      {t.label}
                      {t.id === "trials" && stats.pendingTrials > 0 && (
                        <span className="mr-auto w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">{stats.pendingTrials}</span>
                      )}
                      {t.id === "pricing" && stats.pendingPricing > 0 && (
                        <span className="mr-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">{stats.pendingPricing}</span>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="p-3 border-t border-border/30">
                  <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowRight className="w-4 h-4" />
                    العودة للموقع
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Content ── */}
        <div className="flex-1 p-4 md:p-6 max-w-5xl">
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">نظرة عامة</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "المستخدمون", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
                  { label: "اشتراكات نشطة", value: stats.activeSubscriptions, icon: Crown, color: "text-purple-400" },
                  { label: "تجارب معلقة", value: stats.pendingTrials, icon: Clock, color: "text-amber-400" },
                  { label: "تسعير معلق", value: stats.pendingPricing, icon: AlertCircle, color: "text-red-400" },
                  { label: "كريدت ممنوح", value: stats.totalCreditsGranted, icon: Coins, color: "text-green-400" },
                  { label: "كريدت مستهلك", value: stats.totalCreditsSpent, icon: Coins, color: "text-orange-400" },
                  { label: "التوليدات", value: stats.totalGenerations, icon: RefreshCw, color: "text-cyan-400" },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-card rounded-xl border border-border/50 p-4">
                    <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
                    <p className="text-xl font-extrabold text-foreground">{s.value.toLocaleString("ar")}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-foreground">المستخدمون</h2>
                <span className="text-xs text-muted-foreground">{users.length}</span>
              </div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث بالإيميل أو الاسم..." className="pr-10 bg-card text-xs" dir="ltr" />
              </div>
              {filteredUsers.map((u) => (
                <div key={u.id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    {(u.full_name || u.email)?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{u.full_name || "بدون اسم"}</p>
                    <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{u.email}</p>
                    <p className="text-[9px] text-muted-foreground">{formatDate(u.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setGrantModal({ userId: u.id, email: u.email })}
                      className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-colors" title="منح كريدت">
                      <Coins className="w-3 h-3" />
                    </button>
                    <button onClick={() => { setSubModal({ userId: u.id, email: u.email }); setSelectedPlanId(plans[0]?.id || ""); }}
                      className="px-2 py-1 rounded-lg bg-secondary text-foreground text-[10px] font-bold hover:bg-secondary/80 transition-colors" title="تفعيل اشتراك">
                      <Crown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subscriptions */}
          {tab === "subscriptions" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">الاشتراكات</h2>
              {subscriptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">لا توجد اشتراكات</p>
              ) : subscriptions.map((s) => (
                <div key={s.id} className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{(s as any).profiles?.email || "—"}</p>
                    {statusBadge(s.status)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {(s as any).subscription_plans?.name_ar || "—"} • ينتهي: {s.expires_at ? formatDate(s.expires_at) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Plans */}
          {tab === "plans" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">خطط الاشتراك</h2>
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} onSaved={fetchData} />
              ))}
            </div>
          )}

          {/* Pricing Catalog */}
          {tab === "pricing" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-foreground">كتالوج التسعير</h2>
                {stats.pendingPricing > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                    {stats.pendingPricing} بانتظار المراجعة
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-right py-2 px-2 font-semibold">النموذج</th>
                      <th className="text-right py-2 px-2 font-semibold">المزود</th>
                      <th className="text-right py-2 px-2 font-semibold">الدقة</th>
                      <th className="text-right py-2 px-2 font-semibold">الجودة</th>
                      <th className="text-right py-2 px-2 font-semibold">المدة</th>
                      <th className="text-right py-2 px-2 font-semibold">السعر</th>
                      <th className="text-right py-2 px-2 font-semibold">الوحدة</th>
                      <th className="text-right py-2 px-2 font-semibold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRules.map((r) => (
                      <tr key={r.id} className={`border-b border-border/20 hover:bg-secondary/30 ${r.status === "pending_review" ? "bg-amber-500/5" : ""}`}>
                        <td className="py-2 px-2 font-semibold text-foreground">{r.display_name || r.model}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.provider}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.resolution || "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.quality || "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.duration_seconds ? `${r.duration_seconds}s` : "—"}</td>
                        <td className="py-2 px-2 font-bold text-primary">{r.price_credits}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.price_unit === "per_second" ? "/ثانية" : "/توليد"}</td>
                        <td className="py-2 px-2">{statusBadge(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credit Ledger */}
          {tab === "ledger" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">سجل الكريدت</h2>
              {ledger.map((l) => (
                <div key={l.id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    l.action === "spent" ? "bg-destructive/15 text-destructive" : "bg-green-500/15 text-green-400"
                  }`}>
                    {l.action === "spent" ? "-" : "+"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">{(l as any).profiles?.email || "—"}</p>
                      {actionBadge(l.action)}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{l.description || "—"}</p>
                    <p className="text-[9px] text-muted-foreground">{formatDate(l.created_at)}</p>
                  </div>
                  <p className={`text-sm font-extrabold ${l.action === "spent" ? "text-destructive" : "text-green-400"}`}>
                    {l.action === "spent" ? "-" : "+"}{l.amount}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Trials */}
          {tab === "trials" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">طلبات التجربة</h2>
              {trials.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">لا توجد طلبات</p>
              ) : trials.map((t) => (
                <div key={t.id} className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{(t as any).profiles?.email || "—"}</p>
                    {statusBadge(t.status)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{t.message || "طلب تجربة"} • {t.trial_credits || 50} كريدت</p>
                  {t.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="text-[10px] h-7" onClick={() => handleTrial(t.id, true)}>
                        <Check className="w-3 h-3 ml-1" /> موافقة
                      </Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handleTrial(t.id, false)}>
                        <X className="w-3 h-3 ml-1" /> رفض
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Generations */}
          {tab === "generations" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">التوليدات الأخيرة</h2>
              {generations.map((g) => (
                <div key={g.id} className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{(g as any).profiles?.email || "—"}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{g.file_type}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{g.tool_name || g.tool_id} • {g.prompt?.slice(0, 60) || "—"}</p>
                  <p className="text-[9px] text-muted-foreground">{formatDate(g.created_at)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Audit Logs */}
          {tab === "audit" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">سجل العمليات</h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">لا توجد سجلات</p>
              ) : auditLogs.map((a) => (
                <div key={a.id} className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{(a as any).profiles?.email || "نظام"}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{a.action}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {a.target_type || ""} {a.target_id ? `(${a.target_id.slice(0, 8)}...)` : ""}
                  </p>
                  {a.details && Object.keys(a.details).length > 0 && (
                    <p className="text-[9px] text-muted-foreground mt-1 bg-secondary/50 px-2 py-1 rounded font-mono" dir="ltr">
                      {JSON.stringify(a.details).slice(0, 120)}
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1">{formatDate(a.created_at)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Content CMS */}
          {tab === "content" && <ContentTab />}
        </div>
      </div>

      {/* ── Grant Credits Modal ── */}
      <AnimatePresence>
        {grantModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setGrantModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-xl border border-border/50 p-5 w-full max-w-xs space-y-3"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-foreground">إضافة كريدت</h3>
              <p className="text-[10px] text-muted-foreground" dir="ltr">{grantModal.email}</p>
              <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="عدد الكريدت" className="text-sm bg-secondary" />
              <Input value={grantDescription} onChange={(e) => setGrantDescription(e.target.value)} placeholder="وصف (اختياري)" className="text-sm bg-secondary" />
              <div className="flex gap-2">
                <Button className="flex-1 text-xs" onClick={grantCredits}>إضافة</Button>
                <Button variant="outline" className="text-xs" onClick={() => setGrantModal(null)}>إلغاء</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Activate Subscription Modal ── */}
      <AnimatePresence>
        {subModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setSubModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-xl border border-border/50 p-5 w-full max-w-xs space-y-3"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-foreground">تفعيل اشتراك</h3>
              <p className="text-[10px] text-muted-foreground" dir="ltr">{subModal.email}</p>
              <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary border border-border/50 px-3 text-xs text-foreground">
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_ar} - {p.price.toLocaleString("ar")} د.ع/شهر</option>
                ))}
              </select>
              <Input type="number" value={subDays} onChange={(e) => setSubDays(e.target.value)} placeholder="عدد الأيام" className="text-sm bg-secondary" />
              <div className="flex gap-2">
                <Button className="flex-1 text-xs" onClick={activateSubscription}>تفعيل</Button>
                <Button variant="outline" className="text-xs" onClick={() => setSubModal(null)}>إلغاء</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;
