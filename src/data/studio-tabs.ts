/**
 * Unified Studio Tabs configuration.
 * Each tab maps to a category (used by StudioPage internals) and an optional
 * filter of model IDs visible inside that tab.
 */

import { tools } from "./tools";

export interface StudioTab {
  id: string;
  label: string;
  /** Internal category slug used by StudioPage routing/logic */
  category: string;
  /** Optional whitelist of tool ids to show inside this tab.
   *  When omitted, every tool in the category is shown. */
  toolIds?: string[];
}

export const studioTabs: StudioTab[] = [
  {
    id: "text-to-video",
    label: "Text → Video",
    category: "video",
    toolIds: [
      "grok-video",
      "seedance-2",
      "seedance-2-fast",
      "veo31-lite",
      "veo31-fast",
      "veo31-quality",
      "kling-2-6",
      "kling-2-1-master",
      "sora-2",
      "wan-2-6",
    ],
  },
  {
    id: "image-to-video",
    label: "Image → Video",
    category: "video",
    toolIds: [
      "grok-video",
      "seedance-2",
      "seedance-2-fast",
      "seedance",
      "kling-3",
      "veo31-lite",
      "veo31-fast",
      "veo31-quality",
    ],
  },
  {
    id: "audio-to-video",
    label: "Audio → Video",
    category: "avatar",
  },
  {
    id: "video-to-video",
    label: "Video → Video",
    category: "transfer",
  },
  {
    id: "text-to-image",
    label: "Text → Image",
    category: "images",
  },
  {
    id: "edit",
    label: "Edit",
    category: "remix",
  },
  {
    id: "shoots",
    label: "Shoots",
    category: "shoots",
  },
  {
    id: "remove-bg",
    label: "Remove BG",
    category: "remove-bg",
  },
  {
    id: "upscale",
    label: "Upscale",
    category: "upscale",
  },
];

export const defaultTabId = "text-to-video";

export function getTabById(id: string | null | undefined): StudioTab {
  return studioTabs.find((t) => t.id === id) ?? studioTabs[0];
}

/** Validate that whitelisted tool ids actually exist in tools.ts */
export function getTabTools(tab: StudioTab) {
  const inCategory = tools.filter((t) => {
    const slugMap: Record<string, string> = {
      images: "صور",
      video: "فيديو",
      remix: "ريمكس",
      audio: "صوت",
      avatar: "افتار",
      transfer: "ترانسفير",
      "remove-bg": "حذف الخلفية",
      upscale: "رفع الجودة",
      shoots: "شوتس",
    };
    return t.category === slugMap[tab.category];
  });
  if (!tab.toolIds) return inCategory;
  return tab.toolIds
    .map((id) => inCategory.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
}
