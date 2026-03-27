/**
 * Pricing Engine — single source of truth for cost calculation.
 * Used by both frontend (preview price) and backend (reserve/charge).
 * Fetches pricing rules from the database and calculates exact cost.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PricingParams {
  model: string;
  resolution?: string | null;
  quality?: string | null;
  durationSeconds?: number | null;
  hasAudio?: boolean | null;
}

export interface PricingResult {
  credits: number;
  priceUnit: "per_generation" | "per_second";
  status: "active" | "pending_review" | "not_found";
  displayName?: string;
  ruleId?: string;
}

interface PricingRule {
  id: string;
  model: string;
  resolution: string | null;
  quality: string | null;
  duration_seconds: number | null;
  has_audio: boolean | null;
  price_credits: number;
  price_unit: string;
  status: string;
  display_name: string | null;
}

// In-memory cache with TTL
let cachedRules: PricingRule[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function fetchPricingRules(): Promise<PricingRule[]> {
  const now = Date.now();
  if (cachedRules && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRules;
  }

  const { data, error } = await supabase
    .from("pricing_rules")
    .select("id, model, resolution, quality, duration_seconds, has_audio, price_credits, price_unit, status, display_name")
    .eq("status", "active");

  if (error) {
    console.error("Failed to fetch pricing rules:", error);
    return cachedRules || [];
  }

  cachedRules = (data || []) as PricingRule[];
  cacheTimestamp = now;
  return cachedRules;
}

/** Invalidate cache (call after admin updates pricing) */
export function invalidatePricingCache() {
  cachedRules = null;
  cacheTimestamp = 0;
}

/**
 * Calculate the exact credit cost for a generation.
 * Matching priority: most specific rule wins (more non-null dimensions = higher priority).
 */
export async function calculatePrice(params: PricingParams): Promise<PricingResult> {
  const rules = await fetchPricingRules();
  const candidates = rules.filter((r) => r.model === params.model);

  if (candidates.length === 0) {
    return { credits: 0, priceUnit: "per_generation", status: "not_found" };
  }

  // Score each candidate by how many dimensions match
  type ScoredRule = { rule: PricingRule; score: number };
  const scored: ScoredRule[] = [];

  for (const rule of candidates) {
    let score = 0;
    let disqualified = false;

    // Resolution match
    if (rule.resolution !== null) {
      if (params.resolution && rule.resolution.toLowerCase() === params.resolution.toLowerCase()) {
        score += 10;
      } else {
        disqualified = true;
      }
    }

    // Quality match
    if (rule.quality !== null) {
      if (params.quality && rule.quality.toLowerCase() === params.quality.toLowerCase()) {
        score += 10;
      } else {
        disqualified = true;
      }
    }

    // Duration match
    if (rule.duration_seconds !== null) {
      if (params.durationSeconds !== null && params.durationSeconds !== undefined && rule.duration_seconds === params.durationSeconds) {
        score += 10;
      } else {
        disqualified = true;
      }
    }

    // Audio match
    if (rule.has_audio !== null) {
      if (params.hasAudio !== null && params.hasAudio !== undefined && rule.has_audio === params.hasAudio) {
        score += 10;
      } else {
        disqualified = true;
      }
    }

    if (!disqualified) {
      scored.push({ rule, score });
    }
  }

  if (scored.length === 0) {
    // Fallback: find the most generic rule (all dimensions null)
    const generic = candidates.find(
      (r) => r.resolution === null && r.quality === null && r.duration_seconds === null && r.has_audio === null
    );
    if (generic) {
      return buildResult(generic, params);
    }
    // Last resort: use first candidate
    return buildResult(candidates[0], params);
  }

  // Pick the highest-scoring rule
  scored.sort((a, b) => b.score - a.score);
  return buildResult(scored[0].rule, params);
}

function buildResult(rule: PricingRule, params: PricingParams): PricingResult {
  let credits = rule.price_credits;

  // For per_second pricing, multiply by duration
  if (rule.price_unit === "per_second" && params.durationSeconds) {
    credits = rule.price_credits * params.durationSeconds;
  }

  // For per_character pricing, multiply by character count
  if (rule.price_unit === "per_character" && params.characterCount) {
    credits = rule.price_credits * params.characterCount;
  }

  // Round to 1 decimal
  credits = Math.round(credits * 10) / 10;

  // Minimum 1 credit for per_character if there are characters
  if (rule.price_unit === "per_character" && params.characterCount && params.characterCount > 0 && credits < 1) {
    credits = 1;
  }

  return {
    credits,
    priceUnit: rule.price_unit as "per_generation" | "per_second" | "per_character",
    status: rule.status as "active" | "pending_review",
    displayName: rule.display_name || undefined,
    ruleId: rule.id,
  };
}

/**
 * Build a pricing snapshot for storing with reservations.
 */
export function buildPricingSnapshot(params: PricingParams, result: PricingResult) {
  return {
    model: params.model,
    resolution: params.resolution || null,
    quality: params.quality || null,
    durationSeconds: params.durationSeconds || null,
    hasAudio: params.hasAudio || null,
    credits: result.credits,
    priceUnit: result.priceUnit,
    ruleId: result.ruleId || null,
    status: result.status,
    calculatedAt: new Date().toISOString(),
  };
}
