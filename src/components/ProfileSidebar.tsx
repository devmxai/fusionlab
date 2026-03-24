import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { User, FolderOpen, Activity, CreditCard, LogOut, Shield, X, Crown } from "lucide-react";

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
    { icon: FolderOpen, label: "المكتبة", action: () => { onClose(); } },
    { icon: Activity, label: "النشاط", action: () => { navigate("/profile"); onClose(); } },
    { icon: CreditCard, label: "طرق الدفع", action: () => { navigate("/pricing"); onClose(); } },
  ];

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate("/");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 z-50 h-full w-[280px] bg-card/80 backdrop-blur-2xl border-l border-border/30 rounded-tl-2xl rounded-bl-2xl flex flex-col"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-secondary/60 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Profile header */}
            <div className="flex flex-col items-center pt-10 pb-5 px-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-primary/40 mb-3">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                ) : (
                  <User className="w-7 h-7 text-primary" />
                )}
              </div>
              <p className="text-sm font-bold text-foreground">{displayName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                  {planName || "مجاني"}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {credits} كردت
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="flex-1 px-4 space-y-1.5">
              {isAdmin && (
                <button
                  onClick={() => { navigate("/admin"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-semibold">لوحة التحكم</span>
                </button>
              )}
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="px-4 pb-8 pt-4">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4 text-destructive" />
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
