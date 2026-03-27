/**
 * Hook: fetches pricing_rule_access for a model to determine
 * which resolutions/qualities require which plan.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RuleWithAccess {
  id: string;
  model: string;
  resolution: string | null;
  quality: string | null;
  duration_seconds: number | null;
  min_plan: string; // from pricing_rule_access or model_access fallback
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  plus: 2,
  pro: 3,
};

const PLAN_LABELS: Record<string, string> = {
  free: "تجريبي",
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
};

export function usePlanGating(model: string | null) {
  const { user } = useAuth();
  const [rules, setRules] = useState<RuleWithAccess[]>([]);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [loading, setLoading] = useState(false);

  // Fetch user's current plan
  useEffect(() => {
    if (!user) { setUserPlan("free"); return; }

    const fetchPlan = async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan_id, status, expires_at, subscription_plans(type)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.subscription_plans) {
        const plan = (data.subscription_plans as any).type;
        setUserPlan(plan || "free");
      } else {
        setUserPlan("free");
      }
    };
    fetchPlan();
  }, [user]);

  // Fetch pricing rules + access for the model
  useEffect(() => {
    if (!model) { setRules([]); return; }
    setLoading(true);

    const fetchRules = async () => {
      // Get all active pricing rules for this model
      const { data: pricingRules } = await supabase
        .from("pricing_rules")
        .select("id, model, resolution, quality, duration_seconds")
        .eq("model", model)
        .eq("status", "active");

      if (!pricingRules?.length) {
        // Fallback to model_access
        const { data: ma } = await supabase
          .from("model_access")
          .select("model, min_plan")
          .eq("model", model)
          .eq("is_active", true)
          .maybeSingle();

        if (ma) {
          setRules([{
            id: "fallback",
            model: ma.model,
            resolution: null,
            quality: null,
            duration_seconds: null,
            min_plan: ma.min_plan,
          }]);
        }
        setLoading(false);
        return;
      }

      // Get access rules for these pricing rules
      const ruleIds = pricingRules.map((r) => r.id);
      const { data: accessRules } = await supabase
        .from("pricing_rule_access")
        .select("pricing_rule_id, min_plan, is_active")
        .in("pricing_rule_id", ruleIds);

      const accessMap = new Map<string, string>();
      accessRules?.forEach((a) => {
        if (a.is_active) accessMap.set(a.pricing_rule_id, a.min_plan);
      });

      // Fallback from model_access
      const { data: ma } = await supabase
        .from("model_access")
        .select("min_plan")
        .eq("model", model)
        .eq("is_active", true)
        .maybeSingle();
      const fallbackPlan = ma?.min_plan || "free";

      const merged: RuleWithAccess[] = pricingRules.map((r) => ({
        id: r.id,
        model: r.model,
        resolution: r.resolution,
        quality: r.quality,
        duration_seconds: r.duration_seconds,
        min_plan: accessMap.get(r.id) || fallbackPlan,
      }));

      setRules(merged);
      setLoading(false);
    };

    fetchRules();
  }, [model]);

  const userPlanRank = PLAN_RANK[userPlan] ?? 0;

  /**
   * Check if a specific variant is available to the user.
   * Returns { available, requiredPlan, requiredPlanLabel }
   */
  const checkAccess = useMemo(() => {
    return (resolution?: string | null, quality?: string | null, durationSeconds?: number | null) => {
      // Find the best matching rule
      let bestRule: RuleWithAccess | null = null;
      let bestScore = -1;

      for (const rule of rules) {
        let score = 0;
        let disqualified = false;

        if (rule.resolution) {
          if (resolution && rule.resolution.toLowerCase() === resolution.toLowerCase()) score += 10;
          else disqualified = true;
        }
        if (rule.quality) {
          if (quality && rule.quality.toLowerCase() === quality.toLowerCase()) score += 10;
          else disqualified = true;
        }
        if (rule.duration_seconds != null) {
          if (durationSeconds != null && rule.duration_seconds === durationSeconds) score += 10;
          else disqualified = true;
        }

        if (!disqualified && score > bestScore) {
          bestScore = score;
          bestRule = rule;
        }
      }

      // Fallback to generic rule
      if (!bestRule) {
        bestRule = rules.find((r) => !r.resolution && !r.quality && r.duration_seconds == null) || null;
      }
      // Fallback to any rule
      if (!bestRule && rules.length > 0) {
        bestRule = rules[0];
      }

      if (!bestRule) {
        return { available: true, requiredPlan: "free", requiredPlanLabel: "" };
      }

      const reqRank = PLAN_RANK[bestRule.min_plan] ?? 0;
      return {
        available: userPlanRank >= reqRank,
        requiredPlan: bestRule.min_plan,
        requiredPlanLabel: PLAN_LABELS[bestRule.min_plan] || bestRule.min_plan,
      };
    };
  }, [rules, userPlanRank]);

  return { checkAccess, userPlan, userPlanRank, loading, PLAN_LABELS };
}
