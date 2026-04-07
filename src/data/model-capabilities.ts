/**
 * Per-model capabilities: what settings each model supports.
 * Only list options that the model actually accepts.
 * If an array is empty or missing, that setting is hidden for the model.
 *
 * ⚠️  Values come from the official KIE.AI API documentation (docs.kie.ai).
 *     Do NOT change without cross-checking the endpoint spec first.
 */

export interface ModelCapabilities {
  /** Supported aspect ratios */
  aspectRatios?: string[];
  /** Supported video durations in seconds */
  durations?: string[];
  /** Duration range (min/max/step) for slider-based selection */
  durationRange?: { min: number; max: number; step: number };
  /** Max accepted media duration in seconds */
  maxDurationSeconds?: number;
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

  // Docs: aspect_ratio 1:1,4:3,3:4,16:9,9:16 | no resolution, no quality
  "z-image": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  },

  // Docs: aspect_ratio 1:1,1:4,1:8,2:3,3:2,3:4,4:1,4:3,4:5,5:4,8:1,9:16,16:9,21:9,auto | resolution 1K,2K,4K | image_input up to 14
  "nano-banana-2": {
    aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"],
    resolutions: ["1K", "2K", "4K"],
    maxImages: 14,
  },

  // Docs: aspect_ratio 1:1,2:3,3:2,3:4,4:3,4:5,5:4,9:16,16:9,21:9,auto | resolution 1K,2K,4K | image_input up to 8
  "nano-banana-pro": {
    aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"],
    resolutions: ["1K", "2K", "4K"],
    maxImages: 8,
  },

  // Docs: aspect_ratio 1:1,4:3,3:4,16:9,9:16,2:3,3:2,21:9 | quality basic,high
  "seedream/5-lite-text-to-image": {
    aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    qualities: ["basic", "high"],
  },

  // Docs: aspect_ratio 1:1,4:3,3:4,16:9,9:16,2:3,3:2,21:9 | quality basic,high
  "seedream/4.5-text-to-image": {
    aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    qualities: ["basic", "high"],
  },

  // Docs: aspect_ratio 1:1,4:3,3:4,16:9,9:16,3:2,2:3 | resolution 1K,2K
  "flux-2/pro-text-to-image": {
    aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    resolutions: ["1K", "2K"],
  },

  // Docs: aspect_ratio 2:3,3:2,1:1,16:9,9:16 | no resolution, no quality
  // text-to-image → 6 images, image-to-image → 2 images
  "grok-imagine/text-to-image": {
    aspectRatios: ["1:1", "3:4", "9:16", "16:9"],
    maxImages: 1,
  },

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

  // Docs: aspect_ratio 2:3,3:2,1:1,16:9,9:16 | duration 6-30 step 1 | resolution 480p,720p | mode fun,normal,spicy
  // Supports image-to-video with up to 7 reference images (switches to grok-imagine/image-to-video)
  "grok-imagine/text-to-video": {
    aspectRatios: ["1:1", "2:3", "3:2", "9:16", "16:9"],
    durationRange: { min: 6, max: 30, step: 1 },
    resolutions: ["480p", "720p"],
    qualities: ["fun", "normal", "spicy"],
    maxImages: 7,
  },

  // Docs: aspect_ratio 9:16,16:9 | duration 8 | first+last frame via imageUrls
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

  // Docs: aspect_ratio 16:9,9:16,1:1 | duration 3-15 | mode std,pro | sound bool | first+last frame via image_urls
  "kling-3.0": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
    qualities: ["std", "pro"],
    frameMode: "first-last",
  },

  // Docs: aspect_ratio 1:1,16:9,9:16 | duration 5,10 | sound bool
  "kling-2.6/text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
  },

  // Docs: aspect_ratio 16:9,9:16,1:1 | duration 5,10 | no image input (separate i2v endpoint)
  // Docs: text-to-video only — no image input (separate i2v endpoint)
  "kling/v2-1-master-text-to-video": {
    aspectRatios: ["1:1", "9:16", "16:9"],
    durations: ["5", "10"],
  },

  // Docs: aspect_ratio 1:1,4:3,3:4,16:9,9:16,21:9 | duration 4,8,12 | resolution 480p,720p,1080p | 0-2 input_urls
  "bytedance/seedance-1.5-pro": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    durations: ["4", "8", "12"],
    resolutions: ["480p", "720p", "1080p"],
    frameMode: "first-last",
  },

  // Docs: aspect_ratio 16:9,4:3,1:1,3:4,9:16,21:9 | duration number | resolution 480p,720p | quality normal,fast
  "bytedance/seedance-2": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    durations: ["4", "5", "6", "8", "10"],
    resolutions: ["480p", "720p"],
    qualities: ["normal", "fast"],
    frameMode: "first-last",
  },

  // Docs: aspect_ratio 21:9,16:9,4:3,1:1,3:4,9:16 | duration 5,10 | resolution 480p,720p,1080p
  "bytedance/v1-pro-text-to-video": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
    durations: ["5", "10"],
    resolutions: ["480p", "720p", "1080p"],
  },

  // Docs: aspect_ratio portrait,landscape | n_frames 10,15
  "sora-2-text-to-video": {
    aspectRatios: ["9:16", "16:9"],
    durations: ["10", "15"],
  },

  // Docs: duration 5,10,15 | resolution 720p,1080p
  "wan/2-6-text-to-video": {
    durations: ["5", "10", "15"],
    resolutions: ["720p", "1080p"],
  },

  // ─── Avatar Models ───
  // Docs: image_url + audio_url + prompt only, no resolution
  // Kling Avatar: 720p = standard (8 cr/s), 1080p = pro (16 cr/s)
  "kling/ai-avatar-standard": {
    resolutions: ["720p", "1080p"],
    maxDurationSeconds: 15,
  },
  "kling/ai-avatar-pro": {
    maxDurationSeconds: 15,
  },
  // Docs: image_url + audio_url + prompt + resolution (480p/720p)
  "infinitalk/from-audio": {
    resolutions: ["480p", "720p"],
    maxDurationSeconds: 15,
  },
  // Docs: video_url + image_url + resolution (480p/580p/720p)
  "wan/2-2-animate-move": {
    resolutions: ["480p", "580p", "720p"],
  },
  "wan/2-2-animate-replace": {
    resolutions: ["480p", "580p", "720p"],
  },

  // ─── Transfer / Motion Control Models ───
  // Docs: mode 720p|1080p, character_orientation image|video, input_urls 1 image, video_urls 1 video
  "kling-3.0/motion-control": {
    resolutions: ["720p", "1080p"],
  },
  // Docs: mode 720p|1080p, character_orientation image|video, input_urls 1 image, video_urls 1 video
  "kling-2.6/motion-control": {
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
