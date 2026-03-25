/**
 * React hook for dynamic pricing display.
 * Recalculates whenever model/options change.
 */

import { useState, useEffect } from "react";
import { calculatePrice, type PricingParams, type PricingResult } from "@/lib/pricing-engine";

export function usePricing(params: PricingParams | null) {
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params?.model) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    calculatePrice(params).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [
    params?.model,
    params?.resolution,
    params?.quality,
    params?.durationSeconds,
    params?.hasAudio,
  ]);

  return { price: result, loading };
}
