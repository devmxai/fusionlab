import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Crown, Clock, LogOut, Shield, Sparkles, User, Mail, Lock, Phone, Settings } from "lucide-react";
import { toast } from "sonner";
import PhoneVerificationDialog from "@/components/PhoneVerificationDialog";

import avatar1 from "@/assets/avatars/avatar-1.png";
import avatar2 from "@/assets/avatars/avatar-2.png";
import avatar3 from "@/assets/avatars/avatar-3.png";
import avatar4 from "@/assets/avatars/avatar-4.png";
import avatar5 from "@/assets/avatars/avatar-5.png";
import avatar6 from "@/assets/avatars/avatar-6.png";

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
function getAvatarForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % avatars.length;
  }
  return avatars[Math.abs(hash) % avatars.length];
}

const bounceIn = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 20, delay: i * 0.06 },
  }),
};

const ProfilePage = () => {
  const { user, credits, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEditName(user.user_metadata?.full_name || "");
    setEditEmail(user.email || "");
    const fetchData = async () => {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) { setSubscription(sub); setPlan(sub.subscription_plans); }

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

  if (!user) { navigate("/auth"); return null; }

  const userAvatar = user?.user_metadata?.avatar_url || getAvatarForUser(user?.id || "default");

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: editName } });
    if (error) toast.error("فشل تحديث الاسم");
    else toast.success("تم تحديث الاسم");
    setSaving(false);
  };

  const handleUpdatePassword = async () => {
    if (editPassword.length < 6) { toast.error("كلمة المرور قصيرة جداً"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: editPassword });
    if (error) toast.error("فشل تحديث كلمة المرور");
    else { toast.success("تم تحديث كلمة المرور"); setEditPassword(""); }
    setSaving(false);
  };

  const actionLabels: Record<string, string> = {
    earned: "مكتسب", spent: "مستخدم", admin_grant: "منحة إدارية",
    subscription_grant: "منحة اشتراك", trial_grant: "منحة تجريبية", refund: "استرداد",
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <h1 className="text-base font-bold text-foreground">حسابي</h1>
          <div className="mr-auto flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                <Shield className="w-3 h-3" /> لوحة التحكم
              </button>
            )}
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <motion.div className="px-4 max-w-2xl mx-auto space-y-4 mt-4" initial="hidden" animate="visible">
        {/* Avatar + Name */}
        <motion.div custom={0} variants={bounceIn} className="flex flex-col items-center py-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
            <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <p className="text-sm font-bold text-foreground mt-2">{user.user_metadata?.full_name || "مستخدم"}</p>
          <p className="text-[10px] text-muted-foreground" dir="ltr">{user.email}</p>
        </motion.div>

        {/* Account Management */}
        <motion.div custom={1} variants={bounceIn} className="bg-card rounded-2xl border border-border/50 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">إدارة الحساب</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> الاسم</label>
            <div className="flex gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs bg-secondary/30 border-border/30 h-9" dir="rtl" />
              <Button size="sm" onClick={handleUpdateName} disabled={saving} className="text-[10px] h-9 px-3">حفظ</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> كلمة المرور</label>
            <div className="flex gap-2">
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" className="text-xs bg-secondary/30 border-border/30 h-9" />
              <Button size="sm" onClick={handleUpdatePassword} disabled={saving} className="text-[10px] h-9 px-3">حفظ</Button>
            </div>
          </div>
        </motion.div>

        {/* Credits */}
        <motion.div custom={2} variants={bounceIn} className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">الرصيد</span>
          </div>
          <p className="text-2xl font-extrabold text-primary">{credits}</p>
        </motion.div>

        {/* Subscription */}
        <motion.div custom={3} variants={bounceIn} className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">الاشتراك</span>
          </div>
          {plan ? (
            <div>
              <p className="text-sm font-semibold text-primary">{plan.name_ar}</p>
              <p className="text-[10px] text-muted-foreground">
                {subscription.expires_at ? `ينتهي: ${new Date(subscription.expires_at).toLocaleDateString("ar")}` : "بلا حد زمني"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2">لا يوجد اشتراك نشط</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/pricing")} className="text-xs">عرض الخطط</Button>
            </div>
          )}
        </motion.div>

        {/* Transactions */}
        <motion.div custom={4} variants={bounceIn} className="bg-card rounded-2xl border border-border/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">سجل العمليات</span>
          </div>
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد عمليات</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isDebit = tx.action === "spent";
                const displayAmount = isDebit ? `-${tx.amount}` : `+${tx.amount}`;
                const colorClass = isDebit ? "text-destructive font-bold" : "text-green-400 font-bold";
                return (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-foreground">{actionLabels[tx.action] || tx.action}</span>
                      {tx.description && <span className="text-muted-foreground mr-1">• {tx.description}</span>}
                    </div>
                    <span className={colorClass}>{displayAmount}</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div custom={5} variants={bounceIn} className="space-y-2 pt-2">
          <Button variant="outline" className="w-full text-xs" onClick={() => navigate("/pricing")}>
            <Crown className="w-3.5 h-3.5 ml-1" /> خطط الاشتراك
          </Button>
          <Button variant="ghost" className="w-full text-xs text-destructive" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="w-3.5 h-3.5 ml-1" /> تسجيل الخروج
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
