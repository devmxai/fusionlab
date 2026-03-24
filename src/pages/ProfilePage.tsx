import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Coins, Crown, Clock, LogOut, Shield, Sparkles } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const ProfilePage = () => {
  const { user, credits, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        setSubscription(sub);
        setPlan(sub.subscription_plans);
      }

      const { data: txns } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setTransactions(txns || []);
    };
    fetchData();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Sparkles className="w-6 h-6 text-primary animate-pulse" /></div>;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const actionLabels: Record<string, string> = {
    earned: "مكتسب",
    spent: "مستخدم",
    admin_grant: "منحة إدارية",
    subscription_grant: "منحة اشتراك",
    trial_grant: "منحة تجريبية",
    refund: "استرداد",
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">حسابي</h1>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="mr-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold"
            >
              <Shield className="w-3 h-3" />
              لوحة التحكم
            </button>
          )}
        </div>
      </header>

      <div className="px-4 max-w-2xl mx-auto space-y-4 mt-4">
        {/* User Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border/50 p-4">
          <p className="text-sm font-semibold text-foreground">{user.user_metadata?.full_name || "مستخدم"}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{user.email}</p>
        </motion.div>

        {/* Credits */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">الرصيد</span>
          </div>
          <p className="text-2xl font-extrabold text-primary">{credits}</p>
          <p className="text-[10px] text-muted-foreground">كردت متاح للاستخدام</p>
        </motion.div>

        {/* Subscription */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">الاشتراك</span>
          </div>
          {plan ? (
            <div>
              <p className="text-sm font-semibold text-primary">{plan.name_ar}</p>
              <p className="text-[10px] text-muted-foreground">
                {subscription.expires_at
                  ? `ينتهي: ${new Date(subscription.expires_at).toLocaleDateString("ar")}`
                  : "بلا حد زمني"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2">لا يوجد اشتراك نشط</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/pricing")} className="text-xs">
                عرض الخطط
              </Button>
            </div>
          )}
        </motion.div>

        {/* Transactions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">سجل العمليات</span>
          </div>
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد عمليات</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-foreground">{actionLabels[tx.action] || tx.action}</span>
                    {tx.description && <span className="text-muted-foreground mr-1">• {tx.description}</span>}
                  </div>
                  <span className={tx.amount > 0 ? "text-green-400 font-bold" : "text-destructive font-bold"}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button variant="outline" className="w-full text-xs" onClick={() => navigate("/pricing")}>
            <Crown className="w-3.5 h-3.5 ml-1" />
            خطط الاشتراك
          </Button>
          <Button variant="ghost" className="w-full text-xs text-destructive" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="w-3.5 h-3.5 ml-1" />
            تسجيل الخروج
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
