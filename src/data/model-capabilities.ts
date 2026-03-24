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
  /** Supported quality/mode options (model specific) */
  qualities?: string[];
  /** Frame mode for video models */
  frameMode?: "first-last" | "first-only";
  /** Upscale factors */
  upscaleFactors?: string[];
  /** Max reference images for remix/edit models */
  maxImages?: number;
  /** Minimum required images */
  minImages?: number;
}

export const modelCapabilities: Record<string, ModelCapabilities> = {
  // ─── Image Models ───
  "z-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "nano-banana-2": {},
  "nano-banana-pro": {},
  "seedream/5-lite-text-to-image": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"],
    qualities: ["basic", "high"],
  },
  "seedream/4.5-text-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
  },
  "flux-2/pro-text-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    resolutions: ["1k", "2k", "4k"],
  },
  "grok-imagine/text-to-image": {},

  // ─── Remix / Image Edit Models ───
  "google/nano-banana-edit": {
    maxImages: 3,
    minImages: 1,
  },
  "flux-kontext-pro": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    maxImages: 1,
    minImages: 1,
  },
  "flux-kontext-max": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    maxImages: 1,
    minImages: 1,
  },
  "qwen/image-edit": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    maxImages: 1,
    minImages: 1,
  },
  "gpt-image/1.5-image-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    maxImages: 16,
    minImages: 1,
  },
  "seedream/4.5-edit": {
    aspectRatios: ["1:1", "3:4", "9:16"],
    maxImages: 14,
    minImages: 1,
  },

  // ─── Video Models ───
  "grok-imagine/text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["6"],
  },
  "veo3_fast": {
    aspectRatios: ["9:16", "16:9"],
    durations: ["8"],
    frameMode: "first-last",
  },
  "veo3": {
    aspectRatios: ["9:16", "16:9"],
    durations: ["8"],
    frameMode: "first-last",
  },
  "kling-3.0": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
    qualities: ["std", "pro"],
    frameMode: "first-last",
  },
  "kling-2.6/text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
  },
  "kling/v2-1-master-text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
    frameMode: "first-only",
  },
  "bytedance/seedance-1.5-pro": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    durations: ["4", "8", "12"],
    resolutions: ["480p", "720p", "1080p"],
    frameMode: "first-last",
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

  // ─── Avatar Models ───
  // Kling Avatar: image_url + audio_url + prompt only, no resolution
  "kling/ai-avatar-standard": {},
  "kling/ai-avatar-pro": {},
  // Infinitalk: image_url + audio_url + prompt + resolution (480p/720p)
  "infinitalk/from-audio": {
    resolutions: ["480p", "720p"],
  },
  // Wan Animate: video_url + image_url + resolution (480p/580p/720p)
  "wan/2-2-animate-move": {
    resolutions: ["480p", "580p", "720p"],
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
