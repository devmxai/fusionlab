/**
 * Two-level Studio Tabs configuration.
 *
 * Top-level groups (Video / Image) → each contains sub-tabs that map to a
 * legacy category slug used internally by StudioPage and an optional
 * whitelist of tool ids visible inside that sub-tab.
 */

import { tools } from "./tools";

export interface StudioSubTab {
  id: string;
  label: string;
  /** Internal category slug used by StudioPage routing/logic */
  category: string;
  /** Optional whitelist of tool ids to show inside this tab */
  toolIds?: string[];
}

export interface StudioGroup {
  id: string;
  label: string;
  subtabs: StudioSubTab[];
}

export const studioGroups: StudioGroup[] = [
  {
    id: "video",
    label: "Video",
    subtabs: [
      {
        id: "text-to-video",
        label: "text to video",
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
        label: "image to video",
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
        id: "storyboard",
        label: "storyboard",
        category: "video",
        toolIds: [
          "seedance-2",
          "seedance-2-fast",
          "seedance",
          "grok-video",
        ],
      },
      {
        id: "audio-to-video",
        label: "audio to video",
        category: "avatar",
      },
      {
        id: "video-to-video",
        label: "video to video",
        category: "transfer",
      },
    ],
  },
  {
    id: "image",
    label: "Image",
    subtabs: [
      {
        id: "text-to-image",
        label: "text to image",
        category: "images",
      },
      {
        id: "image-to-image",
        label: "image to image",
        category: "remix",
      },
      {
        id: "shoots",
        label: "shoots",
        category: "shoots",
      },
      {
        id: "remove-bg",
        label: "remove background",
        category: "remove-bg",
      },
      {
        id: "upscale",
        label: "upscale",
        category: "upscale",
      },
    ],
  },
];

export const defaultGroupId = "video";
export const defaultSubTabId = "text-to-video";

export function findSubTab(subTabId: string | null | undefined) {
  for (const g of studioGroups) {
    const found = g.subtabs.find((s) => s.id === subTabId);
    if (found) return { group: g, sub: found };
  }
  return { group: studioGroups[0], sub: studioGroups[0].subtabs[0] };
}

export function getGroupById(id: string | null | undefined) {
  return studioGroups.find((g) => g.id === id) ?? studioGroups[0];
}

/** Validate that whitelisted tool ids actually exist in tools.ts */
export function getSubTabTools(sub: StudioSubTab) {
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
  const inCategory = tools.filter((t) => t.category === slugMap[sub.category]);
  if (!sub.toolIds) return inCategory;
  return sub.toolIds
    .map((id) => inCategory.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
}
