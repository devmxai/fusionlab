/**
 * ProviderIcon — renders the real brand logo for each model provider.
 * Uses SimpleIcons CDN for well-known brands and inline SVG monograms
 * (with each brand's official color) for providers that aren't on SimpleIcons.
 */
import { useState } from "react";

type IconConfig =
  | { kind: "simple"; slug: string; bg: string; invert?: boolean }
  | { kind: "monogram"; label: string; bg: string; fg: string };

const PROVIDER_ICONS: Record<string, IconConfig> = {
  // SimpleIcons-backed (real official logos)
  "xAI":        { kind: "simple", slug: "x",            bg: "#000000", invert: true },
  "OpenAI":     { kind: "simple", slug: "openai",       bg: "#000000", invert: true },
  "Google":     { kind: "simple", slug: "google",       bg: "#ffffff" },
  "Bytedance":  { kind: "simple", slug: "bytedance",    bg: "#ffffff" },
  "Alibaba":    { kind: "simple", slug: "alibabacloud", bg: "#FF6A00", invert: true },
  // Brands not on SimpleIcons — use official brand-color monogram
  "Kling":      { kind: "monogram", label: "K", bg: "#FF6B00", fg: "#ffffff" }, // Kuaishou orange
  "Flux":       { kind: "monogram", label: "F", bg: "#1A1A1A", fg: "#FFD400" }, // Black Forest Labs
  "Recraft":    { kind: "monogram", label: "R", bg: "#FF3D00", fg: "#ffffff" },
  "Topaz":      { kind: "monogram", label: "T", bg: "#FFC107", fg: "#000000" },
  "KIE.AI":     { kind: "monogram", label: "K", bg: "#6E56CF", fg: "#ffffff" },
  "Infinitalk": { kind: "monogram", label: "∞", bg: "#0EA5A4", fg: "#ffffff" },
};

interface Props {
  provider: string;
  size?: number;
  className?: string;
}

export const ProviderIcon = ({ provider, size = 28, className = "" }: Props) => {
  const cfg = PROVIDER_ICONS[provider] ?? {
    kind: "monogram" as const,
    label: provider[0] ?? "?",
    bg: "#2a2a2a",
    fg: "#ffffff",
  };
  const [errored, setErrored] = useState(false);

  const base =
    "shrink-0 rounded-full flex items-center justify-center overflow-hidden";
  const style = { width: size, height: size, background: cfg.bg };

  if (cfg.kind === "simple" && !errored) {
    return (
      <span className={`${base} ${className}`} style={style} aria-label={provider}>
        <img
          src={`https://cdn.simpleicons.org/${cfg.slug}/${cfg.invert ? "ffffff" : "000000"}`}
          alt={provider}
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          loading="lazy"
          onError={() => setErrored(true)}
          style={{ objectFit: "contain" }}
        />
      </span>
    );
  }

  const label = cfg.kind === "monogram" ? cfg.label : provider[0] ?? "?";
  const fg = cfg.kind === "monogram" ? cfg.fg : "#ffffff";
  return (
    <span
      className={`${base} font-extrabold ${className}`}
      style={{ ...style, color: fg, fontSize: Math.round(size * 0.45) }}
      aria-label={provider}
    >
      {label}
    </span>
  );
};

export default ProviderIcon;
