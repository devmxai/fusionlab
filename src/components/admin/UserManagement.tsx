import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Coins, Crown, Mail, Phone, Calendar, Shield,
  ChevronDown, User, Pencil, Trash2, Eye, Save, AlertCircle,
  CreditCard, History, RefreshCw, Check
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  phone_verified: boolean | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserManagementProps {
  plans: any[];
  onDataRefresh: () => void;
}

type ViewMode = "list" | "detail";

const UserManagement = ({ plans, onDataRefresh }: UserManagementProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userCredits, setUserCredits] = useState<Record<string, number>>({});
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [userSubs, setUserSubs] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Grant modal
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");

  // Sub modal
  const [subOpen, setSubOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [subDays, setSubDays] = useState("30");

  // User activity
  const [userGenerations, setUserGenerations] = useState<any[]>([]);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, creditsRes, rolesRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_credits").select("user_id, balance"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_subscriptions").select("*, subscription_plans(name, name_ar, type)").eq("status", "active"),
    ]);

    setUsers(profilesRes.data || []);

    const cMap: Record<string, number> = {};
    (creditsRes.data || []).forEach((c: any) => { cMap[c.user_id] = c.balance; });
    setUserCredits(cMap);

    const rMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: any) => { rMap[r.user_id] = r.role; });
    setUserRoles(rMap);

    const sMap: Record<string, any> = {};
    (subsRes.data || []).forEach((s: any) => { sMap[s.user_id] = s; });
    setUserSubs(sMap);

    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) =>
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone_number?.includes(q)
    );
  }, [users, searchQuery]);

  const openUserDetail = async (user: UserProfile) => {
    setSelectedUser(user);
    setViewMode("detail");
    setEditingName(false);
    setGrantOpen(false);
    setSubOpen(false);
    setDeleteConfirm(false);

    // Fetch user-specific data
    const [gensRes, txRes] = await Promise.all([
      supabase.from("generations").select("id, tool_id, tool_name, created_at, file_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setUserGenerations(gensRes.data || []);
    setUserTransactions(txRes.data || []);
  };

  const goBack = () => {
    setViewMode("list");
    setSelectedUser(null);
  };

  const saveUserName = async () => {
    if (!selectedUser || !editName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ full_name: editName.trim() }).eq("id", selectedUser.id);
    setSavingName(false);
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم تحديث الاسم");
    setEditingName(false);
    setSelectedUser({ ...selectedUser, full_name: editName.trim() });
    fetchUsers();
  };

  const grantCredits = async () => {
    if (!selectedUser || !grantAmount) return;
    const amount = parseInt(grantAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("أدخل رقم صحيح"); return; }
    const { data, error } = await supabase.rpc("admin_grant_credits", {
      p_target_user_id: selectedUser.id,
      p_amount: amount,
      p_description: grantDesc || "منحة من الإدارة",
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "فشلت العملية"); return; }
    toast.success(`تم إضافة ${amount} كريدت`);
    setGrantOpen(false);
    setGrantAmount("");
    setGrantDesc("");
    fetchUsers();
    onDataRefresh();
    openUserDetail(selectedUser);
  };

  const activateSubscription = async () => {
    if (!selectedUser || !selectedPlanId) return;
    const days = parseInt(subDays) || 30;
    const { data, error } = await supabase.rpc("admin_activate_subscription", {
      p_target_user_id: selectedUser.id,
      p_plan_id: selectedPlanId,
      p_days: days,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "فشلت العملية"); return; }
    toast.success("تم تفعيل الاشتراك");
    setSubOpen(false);
    fetchUsers();
    onDataRefresh();
    openUserDetail(selectedUser);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const roleBadge = (role: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      super_admin: { bg: "bg-red-500/15", text: "text-red-400", label: "مسؤول رئيسي" },
      admin: { bg: "bg-purple-500/15", text: "text-purple-400", label: "مسؤول ثانوي" },
      user: { bg: "bg-secondary", text: "text-muted-foreground", label: "مستخدم" },
    };
    const r = map[role] || map.user;
    return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.bg} ${r.text}`}>{r.label}</span>;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  // ── Detail View ──
  if (viewMode === "detail" && selectedUser) {
    const credits = userCredits[selectedUser.id] ?? 0;
    const role = userRoles[selectedUser.id] || "user";
    const sub = userSubs[selectedUser.id];

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="text-lg font-bold text-foreground">ملف المستخدم</h2>
          {roleBadge(role)}
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {(selectedUser.full_name || selectedUser.email)?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {/* Name */}
              <div className="flex items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm h-8 flex-1" placeholder="الاسم" />
                    <Button size="sm" className="h-8 px-2" onClick={saveUserName} disabled={savingName}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingName(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">{selectedUser.full_name || "بدون اسم"}</p>
                    <button onClick={() => { setEditingName(true); setEditName(selectedUser.full_name || ""); }}
                      className="p-1 rounded hover:bg-secondary transition-colors">
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>

              {/* Info Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" dir="ltr">{selectedUser.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span dir="ltr">{selectedUser.phone_number || "غير مسجل"}</span>
                  {selectedUser.phone_verified && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">موثق</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatDate(selectedUser.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <Coins className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-extrabold text-foreground">{credits.toLocaleString("ar")}</p>
            <p className="text-[9px] text-muted-foreground">الرصيد</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <Crown className={`w-4 h-4 mx-auto mb-1 ${sub ? "text-purple-400" : "text-muted-foreground"}`} />
            <p className="text-xs font-bold text-foreground">{sub?.subscription_plans?.name_ar || "بدون"}</p>
            <p className="text-[9px] text-muted-foreground">الاشتراك</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <RefreshCw className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-foreground">{userGenerations.length}</p>
            <p className="text-[9px] text-muted-foreground">التوليدات</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setGrantOpen(!grantOpen); setSubOpen(false); }}>
            <Coins className="w-3.5 h-3.5" />
            منح كريدت
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSubOpen(!subOpen); setGrantOpen(false); }}>
            <Crown className="w-3.5 h-3.5" />
            تفعيل اشتراك
          </Button>
        </div>

        {/* Grant Credits Form */}
        <AnimatePresence>
          {grantOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="bg-card rounded-xl border border-primary/30 p-4 space-y-3 overflow-hidden">
              <p className="text-xs font-bold text-foreground">منح كريدت</p>
              <Input type="number" placeholder="الكمية" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} className="text-xs h-9" dir="ltr" />
              <Input placeholder="الوصف (اختياري)" value={grantDesc} onChange={(e) => setGrantDesc(e.target.value)} className="text-xs h-9" />
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={grantCredits}>تأكيد المنح</Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setGrantOpen(false)}>إلغاء</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Activate Subscription Form */}
        <AnimatePresence>
          {subOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="bg-card rounded-xl border border-purple-500/30 p-4 space-y-3 overflow-hidden">
              <p className="text-xs font-bold text-foreground">تفعيل اشتراك</p>
              <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary border border-border/50 text-xs px-3 text-foreground">
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_ar} — {p.credits_per_month} كريدت</option>
                ))}
              </select>
              <Input type="number" placeholder="عدد الأيام" value={subDays} onChange={(e) => setSubDays(e.target.value)} className="text-xs h-9" dir="ltr" />
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={activateSubscription}>تفعيل</Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSubOpen(false)}>إلغاء</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Transactions */}
        {userTransactions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              سجل العمليات
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {userTransactions.map((tx) => (
                <div key={tx.id} className="bg-card rounded-lg border border-border/30 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {actionBadge(tx.action)}
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{tx.description}</span>
                  </div>
                  <div className="text-left shrink-0">
                    <p className={`text-xs font-bold ${tx.action === "spent" ? "text-destructive" : "text-green-400"}`}>
                      {tx.action === "spent" ? "-" : "+"}{tx.amount}
                    </p>
                    <p className="text-[8px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Generations */}
        {userGenerations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              آخر التوليدات
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {userGenerations.map((g) => (
                <div key={g.id} className="bg-card rounded-lg border border-border/30 px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-foreground">{g.tool_name || g.tool_id}</p>
                    <p className="text-[9px] text-muted-foreground">{g.file_type}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{formatDate(g.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User ID (small, for reference) */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-[9px] text-muted-foreground/50 font-mono" dir="ltr">ID: {selectedUser.id}</p>
        </div>
      </motion.div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">المستخدمون</h2>
          <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{users.length}</span>
        </div>
        <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={fetchUsers}>
          <RefreshCw className="w-3 h-3" />
          تحديث
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم، الإيميل، أو رقم الهاتف..."
          className="pr-10 bg-card text-xs h-10"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {searchQuery && (
        <p className="text-[10px] text-muted-foreground">
          {filteredUsers.length} نتيجة {filteredUsers.length !== users.length && `من ${users.length}`}
        </p>
      )}

      {/* User Cards */}
      <div className="space-y-2">
        {filteredUsers.map((u, i) => {
          const credits = userCredits[u.id] ?? 0;
          const role = userRoles[u.id] || "user";
          const sub = userSubs[u.id];

          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => openUserDetail(u)}
              className="bg-card rounded-xl border border-border/50 p-3.5 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-all group"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0 group-hover:bg-primary/25 transition-colors">
                  {(u.full_name || u.email)?.[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">{u.full_name || "بدون اسم"}</p>
                    {roleBadge(role)}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{u.email}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-muted-foreground">{formatDate(u.created_at)}</span>
                    {u.phone_number && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5" dir="ltr">
                        <Phone className="w-2.5 h-2.5" />{u.phone_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-primary">{credits.toLocaleString("ar")}</span>
                    <Coins className="w-3 h-3 text-primary" />
                  </div>
                  {sub && (
                    <span className="text-[8px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                      {sub.subscription_plans?.name_ar}
                    </span>
                  )}
                  <Eye className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لم يتم العثور على مستخدمين</p>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
