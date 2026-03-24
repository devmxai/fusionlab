import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  FolderOpen,
  Activity,
  CreditCard,
  LogOut,
  Shield,
  X,
  Crown,
  ChevronLeft,
  Coins,
} from "lucide-react";

interface ProfileSidebarProps {
  open: boolean;
  onClose: () => void;
}

const ProfileSidebar = ({ open, onClose }: ProfileSidebarProps) => {
  const { user, credits, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("subscription_plans(name_ar)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlanName((data?.subscription_plans as any)?.name_ar || null);
    };
    fetchPlan();
  }, [user]);

  const menuItems = [
    { icon: User, label: "الحساب", action: () => { navigate("/profile"); onClose(); } },
    { icon: FolderOpen, label: "المكتبة", action: () => { navigate("/library"); onClose(); } },
    { icon: Activity, label: "النشاط", action: () => { navigate("/profile"); onClose(); } },
    { icon: CreditCard, label: "طرق الدفع", action: () => { navigate("/pricing"); onClose(); } },
  ];

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate("/");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";
  const maxCredits = 2000;
  const creditRatio = Math.min(credits / maxCredits, 1);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"
            onClick={onClose}
          />

          {/* Sidebar from RIGHT */}
          <motion.div
            dir="rtl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed top-0 right-0 z-50 h-full w-[300px] flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(180deg, hsl(240 15% 8% / 0.95) 0%, hsl(240 12% 6% / 0.98) 100%)",
              backdropFilter: "blur(40px)",
              borderLeft: "1px solid hsl(var(--border) / 0.3)",
              borderTopLeftRadius: "20px",
              borderBottomLeftRadius: "20px",
            }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <span className="text-[11px] font-bold text-muted-foreground tracking-wide">الملف الشخصي</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-secondary/40 hover:bg-secondary/70 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Profile card */}
            <div className="mx-4 mt-3 p-4 rounded-2xl bg-secondary/30 border border-border/20">
              <div className="flex items-center gap-3">
                {/* Avatar with credit ring */}
                <div className="relative flex-shrink-0">
                  <svg width={52} height={52} className="-rotate-90 absolute inset-0">
                    <circle cx={26} cy={26} r={23} fill="none" stroke="hsl(var(--secondary))" strokeWidth={2.5} opacity={0.3} />
                    <circle
                      cx={26} cy={26} r={23} fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 23}
                      strokeDashoffset={(2 * Math.PI * 23) * (1 - creditRatio)}
                      style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.5))" }}
                    />
                  </svg>
                  <div className="w-[52px] h-[52px] flex items-center justify-center">
                    <div className="w-[42px] h-[42px] rounded-full bg-secondary/60 flex items-center justify-center overflow-hidden">
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{user?.email}</p>
                </div>
              </div>

              {/* Subscription & Credits row */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                  <Crown className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">{planName || "مجاني"}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/50">
                  <Coins className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-foreground">{credits}</span>
                </div>
              </div>
            </div>

            {/* Menu */}
            <div className="flex-1 px-4 mt-4 space-y-1">
              {isAdmin && (
                <button
                  onClick={() => { navigate("/admin"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-primary/8 hover:bg-primary/15 border border-primary/10 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-primary">لوحة التحكم</span>
                </button>
              )}
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-secondary/50 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary/50 group-hover:bg-secondary/80 flex items-center justify-center transition-colors">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="px-4 pb-8 pt-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-destructive/8 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 flex items-center justify-center transition-colors">
                  <LogOut className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-xs font-medium text-destructive">تسجيل الخروج</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileSidebar;
