import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";


const tierColors: Record<string, string> = {
  starter: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  plus: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  pro: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
};

const tierIcons: Record<string, string> = {
  starter: "🚀",
  plus: "⚡",
  pro: "👑",
};

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [trialRequested, setTrialRequested] = useState(false);
  const [loadingTrial, setLoadingTrial] = useState(false);

  useEffect(() => {
    supabase.from("subscription_plans").select("*").eq("is_active", true).order("price").then(({ data }) => setPlans(data || []));
    if (user) {
      supabase.from("trial_requests").select("id").eq("user_id", user.id).eq("status", "pending").then(({ data }) => {
        if (data && data.length > 0) setTrialRequested(true);
      });
    }
  }, [user]);

  const requestTrial = async () => {
    if (!user) { navigate("/auth"); return; }
    setLoadingTrial(true);
    const { error } = await supabase.from("trial_requests").insert({ user_id: user.id, message: "طلب فترة تجريبية" });
    if (error) {
      toast.error("حدث خطأ في الطلب");
    } else {
      setTrialRequested(true);
      toast.success("تم إرسال طلب التجربة! سيتم مراجعته من الإدارة.");
    }
    setLoadingTrial(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-foreground">خطط الاشتراك</h1>
        </div>
      </header>

      <div className="px-4 max-w-2xl mx-auto mt-6 space-y-4">
        <div className="text-center space-y-1 mb-6">
          <h2 className="text-lg font-bold text-foreground">اختر خطتك</h2>
          <p className="text-xs text-muted-foreground">اختر الخطة المناسبة لاحتياجاتك</p>
        </div>

        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-xl border bg-gradient-to-br p-4 ${tierColors[plan.type] || "border-border/50"} ${plan.type === "pro" ? "ring-1 ring-amber-500/30" : ""}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tierIcons[plan.type]}</span>
                  <h3 className="text-sm font-bold text-foreground">{plan.name_ar}</h3>
                  <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{plan.name}</span>
                </div>
              </div>
              <div className="text-left">
                <p className="text-lg font-extrabold text-foreground">${plan.price}</p>
                <p className="text-[10px] text-muted-foreground">/شهرياً</p>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-3 bg-secondary/30 rounded-lg px-3 py-1.5">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">{plan.credits_per_month} كردت/شهر</span>
            </div>

            <ul className="space-y-1.5 mb-4">
              {(plan.features as string[])?.map((f: string, fi: number) => (
                <li key={fi} className="flex items-center gap-2 text-xs text-foreground/80">
                  <Check className="w-3 h-3 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button className="w-full text-xs" variant={plan.type === "pro" ? "default" : "outline"} onClick={() => {
              if (!user) navigate("/auth");
              else toast.info("تواصل مع الإدارة لتفعيل اشتراكك");
            }}>
              <Send className="w-3 h-3 ml-1" />
              اشترك الآن
            </Button>
          </motion.div>
        ))}

        {/* Trial Request */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border/50 bg-card p-4 text-center"
        >
          <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
          <h3 className="text-sm font-bold text-foreground mb-1">فترة تجريبية مجانية</h3>
          <p className="text-[10px] text-muted-foreground mb-3">اطلب فترة تجريبية وسيتم مراجعة طلبك من الإدارة</p>
          <Button
            variant="outline"
            className="text-xs"
            disabled={trialRequested || loadingTrial}
            onClick={requestTrial}
          >
            {trialRequested ? "تم إرسال الطلب ✓" : loadingTrial ? "جاري الإرسال..." : "طلب تجربة مجانية"}
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default PricingPage;
