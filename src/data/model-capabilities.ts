/**
 * Per-model capabilities: what settings each model supports.
 * Only list options that the model actually accepts.
 * If an array is empty or missing, that setting is hidden for the model.
 */

export interface ModelCapabilities {
  /** Supported aspect ratios */
  aspectRatios?: string[];
  /** Supported video durations in seconds */
  durations?: string[];
  /** Supported resolutions */
  resolutions?: string[];
  /** Frame mode for video models */
  frameMode?: "first-last" | "first-only";
  /** Upscale factors */
  upscaleFactors?: string[];
}

export const modelCapabilities: Record<string, ModelCapabilities> = {
  // ─── Image Models ───
  "z-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "nano-banana-2": {},
  "nano-banana-pro": {},
  "seedream/4.5-text-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "flux-2/pro-text-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    resolutions: ["1k", "2k", "4k"],
  },
  "grok-imagine/text-to-image": {},

  // ─── Remix / Image Edit Models ───
  "google/nano-banana-edit": {},
  "flux-kontext-pro": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "flux-kontext-max": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "qwen/image-edit": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "gpt-image/1.5-image-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "seedream/4.5-edit": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },

  // ─── Video Models ───
  "grok-imagine/text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["6"],
  },
  "veo3_fast": {
    aspectRatios: ["9:16", "16:9"],
    frameMode: "first-only",
  },
  "veo3": {
    aspectRatios: ["9:16", "16:9"],
    frameMode: "first-only",
  },
  "kling-3.0": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
    frameMode: "first-last",
  },
  "kling-2.6/text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5"],
  },
  "kling/v2-1-master-text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
    frameMode: "first-only",
  },
  "bytedance/seedance-1.5-pro": {
    aspectRatios: ["1:1", "9:16"],
    durations: ["5", "8"],
    frameMode: "first-only",
  },
  "bytedance/v1-pro-text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5"],
  },
  "sora-2-text-to-video": {
    aspectRatios: ["9:16", "16:9"],
  },
  "wan/2-6-text-to-video": {
    durations: ["5"],
    resolutions: ["720p", "1080p"],
  },

  // ─── Utility Models ───
  "recraft/remove-background": {},
  "recraft/crisp-upscale": {},
  "topaz/image-upscale": {
    upscaleFactors: ["1.5", "2", "4"],
  },
};

/** Get capabilities for a model, falling back to empty */
export function getModelCapabilities(model: string): ModelCapabilities {
  return modelCapabilities[model] || {};
}
