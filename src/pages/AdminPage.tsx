import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Users, Crown, Coins, Clock, Shield, Check, X,
  Plus, Search, ChevronDown
} from "lucide-react";
import { toast } from "sonner";

type Tab = "users" | "subscriptions" | "trials" | "stats";

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ totalUsers: 0, activeSubscriptions: 0, totalCreditsGranted: 0, pendingTrials: 0 });

  // Grant credits modal
  const [grantModal, setGrantModal] = useState<{ userId: string; email: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState("");

  // Activate subscription modal
  const [subModal, setSubModal] = useState<{ userId: string; email: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [subDays, setSubDays] = useState("30");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, loading]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin, tab]);

  const fetchData = async () => {
    const { data: profilesData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(profilesData || []);

    const { data: plansData } = await supabase.from("subscription_plans").select("*").order("price");
    setPlans(plansData || []);

    const { data: trialsData } = await supabase.from("trial_requests").select("*, profiles(email, full_name)").order("created_at", { ascending: false });
    setTrials(trialsData || []);

    const { data: subsData } = await supabase.from("user_subscriptions").select("*, profiles(email, full_name), subscription_plans(name, name_ar, type)").order("created_at", { ascending: false });
    setSubscriptions(subsData || []);

    // Stats
    setStats({
      totalUsers: profilesData?.length || 0,
      activeSubscriptions: subsData?.filter((s: any) => s.status === "active").length || 0,
      totalCreditsGranted: 0,
      pendingTrials: trialsData?.filter((t: any) => t.status === "pending").length || 0,
    });
  };

  const grantCredits = async () => {
    if (!grantModal || !grantAmount) return;
    const amount = parseInt(grantAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("أدخل رقم صحيح"); return; }

    // Insert transaction
    await supabase.from("credit_transactions").insert({
      user_id: grantModal.userId,
      amount,
      action: "admin_grant" as any,
      description: "منحة من الإدارة",
      granted_by: user!.id,
    });

    // Update balance
    const { data: current } = await supabase.from("user_credits").select("balance, total_earned").eq("user_id", grantModal.userId).maybeSingle();
    await supabase.from("user_credits").update({
      balance: (current?.balance || 0) + amount,
      total_earned: (current?.total_earned || 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", grantModal.userId);

    toast.success(`تم إضافة ${amount} كردت`);
    setGrantModal(null);
    setGrantAmount("");
  };

  const activateSubscription = async () => {
    if (!subModal || !selectedPlanId) return;
    const days = parseInt(subDays) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Deactivate old subs
    await supabase.from("user_subscriptions").update({ status: "expired" as any, updated_at: new Date().toISOString() }).eq("user_id", subModal.userId).eq("status", "active");

    // Create new
    await supabase.from("user_subscriptions").insert({
      user_id: subModal.userId,
      plan_id: selectedPlanId,
      status: "active" as any,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      activated_by: user!.id,
    });

    // Grant credits
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (plan) {
      await supabase.from("credit_transactions").insert({
        user_id: subModal.userId,
        amount: plan.credits_per_month,
        action: "subscription_grant" as any,
        description: `اشتراك ${plan.name_ar}`,
        granted_by: user!.id,
      });
      const { data: current } = await supabase.from("user_credits").select("balance, total_earned").eq("user_id", subModal.userId).maybeSingle();
      await supabase.from("user_credits").update({
        balance: (current?.balance || 0) + plan.credits_per_month,
        total_earned: (current?.total_earned || 0) + plan.credits_per_month,
        updated_at: new Date().toISOString(),
      }).eq("user_id", subModal.userId);
    }

    toast.success("تم تفعيل الاشتراك");
    setSubModal(null);
    fetchData();
  };

  const handleTrial = async (trialId: string, userId: string, approve: boolean) => {
    await supabase.from("trial_requests").update({
      status: (approve ? "approved" : "rejected") as any,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", trialId);

    if (approve) {
      // Grant trial credits
      const trial = trials.find((t) => t.id === trialId);
      const credits = trial?.trial_credits || 50;
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: credits,
        action: "trial_grant" as any,
        description: "فترة تجريبية",
        granted_by: user!.id,
      });
      const { data: current } = await supabase.from("user_credits").select("balance, total_earned").eq("user_id", userId).maybeSingle();
      await supabase.from("user_credits").update({
        balance: (current?.balance || 0) + credits,
        total_earned: (current?.total_earned || 0) + credits,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }

    toast.success(approve ? "تمت الموافقة" : "تم الرفض");
    fetchData();
  };

  if (loading || !isAdmin) return null;

  const filteredUsers = users.filter((u) =>
    !searchQuery || u.email?.includes(searchQuery) || u.full_name?.includes(searchQuery)
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "subscriptions", label: "الاشتراكات", icon: Crown },
    { id: "trials", label: "التجارب", icon: Clock },
    { id: "stats", label: "الإحصائيات", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </button>
          <Shield className="w-4 h-4 text-primary" />
          <h1 className="text-base font-bold text-foreground">لوحة التحكم</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border/30 overflow-x-auto scrollbar-hide">
        <div className="flex max-w-4xl mx-auto px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "trials" && stats.pendingTrials > 0 && (
                <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">
                  {stats.pendingTrials}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 max-w-4xl mx-auto py-4">
        {/* Stats Tab */}
        {tab === "stats" && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "المستخدمون", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
              { label: "اشتراكات نشطة", value: stats.activeSubscriptions, icon: Crown, color: "text-purple-400" },
              { label: "تجارب معلقة", value: stats.pendingTrials, icon: Clock, color: "text-amber-400" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border/50 p-4">
                <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
                <p className="text-xl font-extrabold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="space-y-3">
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
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setGrantModal({ userId: u.id, email: u.email })}
                    className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-colors"
                  >
                    <Coins className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSubModal({ userId: u.id, email: u.email }); setSelectedPlanId(plans[0]?.id || ""); }}
                    className="px-2 py-1 rounded-lg bg-secondary text-foreground text-[10px] font-bold hover:bg-secondary/80 transition-colors"
                  >
                    <Crown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscriptions Tab */}
        {tab === "subscriptions" && (
          <div className="space-y-3">
            {subscriptions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">لا توجد اشتراكات</p>
            ) : subscriptions.map((s) => (
              <div key={s.id} className="bg-card rounded-xl border border-border/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-foreground">{(s as any).profiles?.email || "—"}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    s.status === "active" ? "bg-green-500/15 text-green-400" :
                    s.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {s.status === "active" ? "نشط" : s.status === "pending" ? "معلق" : s.status === "expired" ? "منتهي" : s.status}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {(s as any).subscription_plans?.name_ar || "—"} • ينتهي: {s.expires_at ? new Date(s.expires_at).toLocaleDateString("ar") : "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Trials Tab */}
        {tab === "trials" && (
          <div className="space-y-3">
            {trials.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">لا توجد طلبات</p>
            ) : trials.map((t) => (
              <div key={t.id} className="bg-card rounded-xl border border-border/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-foreground">{(t as any).profiles?.email || "—"}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    t.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                    t.status === "approved" ? "bg-green-500/15 text-green-400" :
                    "bg-destructive/15 text-destructive"
                  }`}>
                    {t.status === "pending" ? "معلق" : t.status === "approved" ? "مقبول" : "مرفوض"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">{t.message || "طلب تجربة"}</p>
                {t.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="text-[10px] h-7" onClick={() => handleTrial(t.id, t.user_id, true)}>
                      <Check className="w-3 h-3 ml-1" /> موافقة
                    </Button>
                    <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => handleTrial(t.id, t.user_id, false)}>
                      <X className="w-3 h-3 ml-1" /> رفض
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grant Credits Modal */}
      <AnimatePresence>
        {grantModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setGrantModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-xl border border-border/50 p-5 w-full max-w-xs space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-foreground">إضافة كردتات</h3>
              <p className="text-[10px] text-muted-foreground" dir="ltr">{grantModal.email}</p>
              <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="عدد الكردتات" className="text-sm bg-secondary" />
              <div className="flex gap-2">
                <Button className="flex-1 text-xs" onClick={grantCredits}>إضافة</Button>
                <Button variant="outline" className="text-xs" onClick={() => setGrantModal(null)}>إلغاء</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activate Subscription Modal */}
      <AnimatePresence>
        {subModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setSubModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-xl border border-border/50 p-5 w-full max-w-xs space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-foreground">تفعيل اشتراك</h3>
              <p className="text-[10px] text-muted-foreground" dir="ltr">{subModal.email}</p>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary border border-border/50 px-3 text-xs text-foreground"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_ar} - ${p.price}/شهر</option>
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
