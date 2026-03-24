import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  FolderOpen,
  CreditCard,
  LogOut,
  Shield,
  Crown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Settings,
  Mail,
  Lock,
  Phone,
  RefreshCw,
  ShoppingCart,
  Calendar,
  Clock,
  Image,
  Video,
  Music,
  Sparkles,
  X,
  Play,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Avatar imports
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

interface ProfileSidebarProps {
  open: boolean;
  onClose: () => void;
}

type SidebarView = "main" | "account" | "plan" | "library";

const bounceIn = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 20, delay: i * 0.06 },
  }),
};

const ProfileSidebar = ({ open, onClose }: ProfileSidebarProps) => {
  const [viewerItem, setViewerItem] = useState<any>(null);
  const { user, credits, isAdmin, signOut, refreshCredits } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<SidebarView>("main");
  const [planName, setPlanName] = useState<string | null>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [generations, setGenerations] = useState<any[]>([]);

  // Account edit states
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const fetchData = async () => {
      // Fetch plan
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        setSubscriptionData(sub);
        setPlanData(sub.subscription_plans);
        setPlanName((sub.subscription_plans as any)?.name_ar || null);
      } else {
        setSubscriptionData(null);
        setPlanData(null);
        setPlanName(null);
      }

      // Fetch total spent
      const { data: creditData } = await supabase
        .from("user_credits")
        .select("total_spent, total_earned")
        .eq("user_id", user.id)
        .maybeSingle();
      setTotalSpent(creditData?.total_spent ?? 0);

      // Set edit fields
      setEditName(user.user_metadata?.full_name || "");
      setEditEmail(user.email || "");
    };
    fetchData();
  }, [user, open]);

  useEffect(() => {
    if (view === "library" && user) {
      const fetchGenerations = async () => {
        const { data } = await supabase
          .from("generations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setGenerations(data || []);
      };
      fetchGenerations();
    }
  }, [view, user]);

  // Reset view on close
  useEffect(() => {
    if (!open) setTimeout(() => setView("main"), 300);
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate("/");
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: editName } });
    if (error) toast.error("فشل تحديث الاسم");
    else toast.success("تم تحديث الاسم");
    setSaving(false);
  };

  const handleUpdateEmail = async () => {
    if (!editEmail.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: editEmail });
    if (error) toast.error("فشل تحديث البريد");
    else toast.success("تم إرسال رابط التأكيد للبريد الجديد");
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

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";
  const userAvatar = user?.user_metadata?.avatar_url || getAvatarForUser(user?.id || "default");

  const totalCredits = (planData?.credits_per_month || 0);
  const creditsDisplay = totalCredits > 0 ? `${totalSpent} / ${totalCredits}` : `${credits}`;

  const menuCards = [
    { icon: Settings, label: "الحساب", color: "text-primary", action: () => setView("account") },
    { icon: Crown, label: "الخطة", color: "text-primary", action: () => setView("plan") },
    { icon: FolderOpen, label: "المكتبة", color: "text-primary", action: () => setView("library") },
  ];

  const renderMainView = () => (
    <motion.div className="flex flex-col h-full" initial="hidden" animate="visible">
      {/* Avatar centered at top */}
      <motion.div custom={0} variants={bounceIn} className="flex flex-col items-center pt-8 pb-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
          <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </motion.div>

      {/* Name */}
      <motion.p custom={1} variants={bounceIn} className="text-center text-sm font-bold text-foreground">
        {displayName}
      </motion.p>

      {/* Credits */}
      <motion.div custom={2} variants={bounceIn} className="flex items-center justify-center gap-1.5 mt-1.5">
        <Coins className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground">{creditsDisplay}</span>
      </motion.div>

      {/* Plan badge */}
      <motion.div custom={3} variants={bounceIn} className="flex justify-center mt-2">
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <Crown className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-primary">{planName || "مجاني"}</span>
        </div>
      </motion.div>

      {/* Menu cards */}
      <div className="flex-1 px-4 mt-6 space-y-2">
        {isAdmin && (
          <motion.button
            custom={4}
            variants={bounceIn}
            onClick={() => { navigate("/admin"); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/8 hover:bg-primary/15 border border-primary/15 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <span className="text-xs font-bold text-primary">لوحة التحكم</span>
          </motion.button>
        )}
        {menuCards.map((item, i) => (
          <motion.button
            key={item.label}
            custom={i + 5}
            variants={bounceIn}
            onClick={item.action}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-secondary/30 hover:bg-secondary/50 border border-border/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/60 group-hover:bg-secondary/80 flex items-center justify-center transition-colors">
                <item.icon className={`w-4.5 h-4.5 ${item.color} group-hover:text-primary transition-colors`} />
              </div>
              <span className="text-xs font-semibold text-foreground">{item.label}</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </motion.button>
        ))}
      </div>

      {/* Logout */}
      <motion.div custom={8} variants={bounceIn} className="px-4 pb-8 pt-3">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-destructive/8 transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-destructive/10 group-hover:bg-destructive/20 flex items-center justify-center transition-colors">
            <LogOut className="w-4.5 h-4.5 text-destructive" />
          </div>
          <span className="text-xs font-semibold text-destructive">تسجيل الخروج</span>
        </button>
      </motion.div>
    </motion.div>
  );

  const renderAccountView = () => (
    <motion.div className="flex flex-col h-full" initial="hidden" animate="visible">
      {/* Header */}
      <motion.div custom={0} variants={bounceIn} className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => setView("main")} className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-bold text-foreground">إدارة الحساب</span>
      </motion.div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-8">
        {/* Avatar section */}
        <motion.div custom={1} variants={bounceIn} className="flex flex-col items-center py-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
            <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <button className="mt-2 flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline">
            <RefreshCw className="w-3 h-3" />
            تغيير الصورة
          </button>
        </motion.div>

        {/* Name */}
        <motion.div custom={2} variants={bounceIn} className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" /> الاسم
          </label>
          <div className="flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xs bg-secondary/30 border-border/30 h-9"
              dir="rtl"
            />
            <Button size="sm" onClick={handleUpdateName} disabled={saving} className="text-[10px] h-9 px-3">
              حفظ
            </Button>
          </div>
        </motion.div>

        {/* Email */}
        <motion.div custom={3} variants={bounceIn} className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3" /> البريد الإلكتروني
          </label>
          <div className="flex gap-2">
            <Input
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="text-xs bg-secondary/30 border-border/30 h-9"
              dir="ltr"
            />
            <Button size="sm" onClick={handleUpdateEmail} disabled={saving} className="text-[10px] h-9 px-3">
              حفظ
            </Button>
          </div>
        </motion.div>

        {/* Password */}
        <motion.div custom={4} variants={bounceIn} className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> كلمة المرور الجديدة
          </label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="••••••••"
              className="text-xs bg-secondary/30 border-border/30 h-9"
            />
            <Button size="sm" onClick={handleUpdatePassword} disabled={saving} className="text-[10px] h-9 px-3">
              حفظ
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  const renderPlanView = () => {
    if (!planData) {
      return (
        <motion.div className="flex flex-col h-full" initial="hidden" animate="visible">
          <motion.div custom={0} variants={bounceIn} className="flex items-center gap-3 px-4 pt-5 pb-3">
            <button onClick={() => setView("main")} className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground">الخطة</span>
          </motion.div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <motion.div custom={1} variants={bounceIn}>
              <Crown className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">لا يوجد اشتراك نشط</p>
              <Button onClick={() => { navigate("/pricing"); onClose(); }} className="text-xs">
                عرض الخطط والأسعار
              </Button>
            </motion.div>
          </div>
        </motion.div>
      );
    }

    const expiresAt = subscriptionData?.expires_at ? new Date(subscriptionData.expires_at) : null;
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

    return (
      <motion.div className="flex flex-col h-full" initial="hidden" animate="visible">
        <motion.div custom={0} variants={bounceIn} className="flex items-center gap-3 px-4 pt-5 pb-3">
          <button onClick={() => setView("main")} className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-bold text-foreground">الخطة</span>
        </motion.div>

        <div className="flex-1 px-4 space-y-3 pb-8">
          {/* Plan name card */}
          <motion.div custom={1} variants={bounceIn} className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
            <Crown className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-base font-extrabold text-primary">{planData.name_ar}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{planData.name}</p>
          </motion.div>

          {/* Credits */}
          <motion.div custom={2} variants={bounceIn} className="p-3.5 rounded-2xl bg-secondary/30 border border-border/20">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">الرصيد</span>
            </div>
            <p className="text-lg font-extrabold text-primary">{credits}</p>
            <p className="text-[10px] text-muted-foreground">{planData.credits_per_month} كردت شهرياً</p>
          </motion.div>

          {/* Period */}
          {expiresAt && (
            <motion.div custom={3} variants={bounceIn} className="p-3.5 rounded-2xl bg-secondary/30 border border-border/20">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">الفترة</span>
              </div>
              <p className="text-xs text-foreground">
                ينتهي: {expiresAt.toLocaleDateString("ar")}
              </p>
              {daysLeft !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{daysLeft} يوم متبقي</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Buy more */}
          <motion.div custom={4} variants={bounceIn}>
            <Button
              variant="outline"
              className="w-full text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => { navigate("/pricing"); onClose(); }}
            >
              <ShoppingCart className="w-3.5 h-3.5 ml-1" />
              شراء نقاط إضافية
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  // Masonry layout pattern for collage effect
  const getMasonryLayout = (items: any[]) => {
    // Pattern: tall, wide, square variations
    const patterns = [
      { colSpan: 1, rowSpan: 2 }, // tall portrait
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 2, rowSpan: 1 }, // wide landscape
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 1, rowSpan: 2 }, // tall portrait
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 2, rowSpan: 1 }, // wide landscape
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 1, rowSpan: 1 }, // square
      { colSpan: 1, rowSpan: 2 }, // tall
    ];
    return items.map((item, i) => ({
      ...item,
      layout: patterns[i % patterns.length],
    }));
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "download";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("تم التحميل");
    } catch {
      toast.error("فشل التحميل");
    }
  };

  const renderLibraryView = () => {
    const images = generations.filter(g => g.file_type?.startsWith("image"));
    const videos = generations.filter(g => g.file_type?.startsWith("video"));
    const audio = generations.filter(g => g.file_type?.startsWith("audio"));
    const layoutItems = getMasonryLayout(generations.slice(0, 12));

    return (
      <motion.div className="flex flex-col h-full" initial="hidden" animate="visible">
        <motion.div custom={0} variants={bounceIn} className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("main")} className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground">المكتبة</span>
          </div>
          <button
            onClick={() => { navigate("/library"); onClose(); }}
            className="text-[10px] text-primary font-semibold hover:underline"
          >
            عرض الكل
          </button>
        </motion.div>

        <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-8">
          {/* Stats */}
          <motion.div custom={1} variants={bounceIn} className="grid grid-cols-3 gap-2">
            {[
              { icon: Image, label: "صور", count: images.length },
              { icon: Video, label: "فيديو", count: videos.length },
              { icon: Music, label: "صوت", count: audio.length },
            ].map((stat) => (
              <div key={stat.label} className="p-2.5 rounded-xl bg-secondary/30 border border-border/20 text-center">
                <stat.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{stat.count}</p>
                <p className="text-[9px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Masonry collage grid */}
          {generations.length === 0 ? (
            <motion.div custom={2} variants={bounceIn} className="text-center py-8">
              <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">لا توجد عناصر بعد</p>
            </motion.div>
          ) : (
            <motion.div
              custom={2}
              variants={bounceIn}
              className="grid grid-cols-3 auto-rows-[70px] gap-1.5"
            >
              {layoutItems.map((gen) => (
                <motion.div
                  key={gen.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setViewerItem(gen)}
                  className="rounded-xl overflow-hidden bg-secondary/30 border border-border/20 cursor-pointer relative group"
                  style={{
                    gridColumn: `span ${gen.layout.colSpan}`,
                    gridRow: `span ${gen.layout.rowSpan}`,
                  }}
                >
                  {gen.file_type?.startsWith("image") ? (
                    <img
                      src={gen.thumbnail_url || gen.file_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : gen.file_type?.startsWith("video") ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/40">
                      <Video className="w-5 h-5 text-primary mb-1" />
                      <span className="text-[8px] text-muted-foreground">فيديو</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center gap-2 px-3 bg-secondary/40">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Play className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-foreground truncate">{gen.tool_name || "صوت"}</p>
                        <p className="text-[8px] text-muted-foreground truncate">{gen.prompt?.slice(0, 30) || ""}</p>
                      </div>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"
            onClick={onClose}
          />

          <motion.div
            dir="rtl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed top-0 right-0 z-50 h-full w-[300px] flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(180deg, hsl(240 15% 8% / 0.97) 0%, hsl(240 12% 5% / 0.99) 100%)",
              backdropFilter: "blur(40px)",
              borderLeft: "1px solid hsl(var(--border) / 0.3)",
              borderTopLeftRadius: "24px",
              borderBottomLeftRadius: "24px",
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 z-10 p-1.5 rounded-full bg-secondary/40 hover:bg-secondary/70 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <AnimatePresence mode="wait">
              {view === "main" && <motion.div key="main" className="flex-1 flex flex-col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>{renderMainView()}</motion.div>}
              {view === "account" && <motion.div key="account" className="flex-1 flex flex-col" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>{renderAccountView()}</motion.div>}
              {view === "plan" && <motion.div key="plan" className="flex-1 flex flex-col" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>{renderPlanView()}</motion.div>}
              {view === "library" && <motion.div key="library" className="flex-1 flex flex-col" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>{renderLibraryView()}</motion.div>}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Fullscreen Image/Video Viewer */}
    <AnimatePresence>
      {viewerItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl"
          onClick={() => setViewerItem(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring" as const, damping: 25, stiffness: 300 }}
            className="relative max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {viewerItem.file_type?.startsWith("image") ? (
              <img
                src={viewerItem.file_url}
                alt=""
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            ) : viewerItem.file_type?.startsWith("video") ? (
              <video
                src={viewerItem.file_url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-xl"
              />
            ) : (
              <div className="p-8 rounded-2xl bg-card border border-border/30 text-center">
                <Music className="w-12 h-12 text-primary mx-auto mb-3" />
                <audio src={viewerItem.file_url} controls autoPlay className="w-64" />
              </div>
            )}

            {/* Download button */}
            <button
              onClick={() => handleDownload(viewerItem.file_url, viewerItem.tool_name || "download")}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 border border-border/30 backdrop-blur-sm transition-colors"
            >
              <Download className="w-4 h-4 text-foreground" />
              <span className="text-xs text-foreground font-medium">تحميل</span>
            </button>

            {/* Close */}
            <button
              onClick={() => setViewerItem(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSidebar;
