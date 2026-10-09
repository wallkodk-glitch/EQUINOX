import type { ReactNode } from "react";
export type GlyphName = "overview" | "allocate" | "risk" | "settings" | "arrow" | "back" | "balance" | "close";

export function Glyph({ name, className = "" }: { name: GlyphName; className?: string }) {
  const paths: Record<GlyphName, ReactNode> = {
    overview: <><path d="M4 11 12 4l8 7v9H4Z" /><path d="M9 20v-7h6v7" /></>,
    allocate: <><path d="M3 12h18M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" /></>,
    risk: <><path d="M4 19V9m5 10V5m6 14v-6m5 6V3M2 21h20" /></>,
    settings: <><path d="M3 7h18M3 17h18" /><circle cx="8" cy="7" r="2.5" /><circle cx="16" cy="17" r="2.5" /></>,
    arrow: <path d="m9 5 7 7-7 7M3 12h13" />,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    balance: <><path d="M3 8h18M12 4v16M8 20h8M5 8l-3 7h6Zm14 0-3 7h6Z" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return <svg className={`glyph ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

/** Simplified geometry of the supplied EQUINOX hemispheres and central axis. */
export function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <path className="mark-upper" d="M12 30C12 19 21 10 32 10s20 9 20 20C42 13 25 16 12 30Z" fill="var(--teal-active)" />
    <path className="mark-lower" d="M12 34c0 11 9 20 20 20s20-9 20-20C42 51 25 48 12 34Z" fill="var(--violet-mineral)" />
    <path className="mark-axis" d="M5 32h54" stroke="var(--text-secondary)" strokeWidth="1" />
  </svg>;
}

export function InfinityLoader({ label, compact = false }: { label: string; compact?: boolean }) {
  const path = "M32 20C24 8 17 6 11 10C0 17 4 32 15 31C26 30 37 8 48 9C59 8 63 23 53 30C47 34 40 32 32 20Z";
  return <span className={`infinity-loader ${compact ? "compact" : ""}`} role="status">
    <svg viewBox="0 0 64 40" fill="none" aria-hidden="true">
      <path d={path} className="infinity-track" />
      <path d={path} className="infinity-flow" pathLength="100" />
    </svg>
    <span>{label}</span>
  </span>;
}
