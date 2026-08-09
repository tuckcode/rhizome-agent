import type { CSSProperties } from 'react'

/**
 * Rhizome "3c Network" brand mark — one core node + five satellite nodes
 * (four diagonal + one vertical spoke, deliberately not rotationally
 * symmetric) joined by thin straight links. Geometry matches the OS icon
 * (`src-tauri/icons/icon-source.svg`, see ADR 0157), but color is
 * theme-reactive here (unlike the OS icon, which is brand-fixed on its own
 * dark tile): the OS icon has a guaranteed-contrast fixed background, the
 * in-app mark does not — it sits on whatever the sidebar bg is for the
 * active theme, so a fixed color reads fine in some themes and bleeds in
 * others. Core takes `--primary`, not `--accent-blue`: `--accent-blue` is a
 * fixed per-theme token (each theme sets it once, incl. the 14 fixed-skin
 * themes), but the "Rhizome" theme's accent-color picker overrides
 * `--primary` instead (`:root[data-accent="..."]` in index.css) — binding
 * to `--accent-blue` would silently ignore that picker. `--primary`
 * defaults to `var(--accent-blue)` everywhere else, so this is correct in
 * all 15 themes, not just Rhizome. Satellites/links use the theme's own
 * text tokens — the same ones everything else in the UI relies on for
 * legibility against that theme's background, so this mark is legible
 * everywhere by construction.
 */
export function BrandMark({ size = 26, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={style}
      data-testid="brand-mark"
    >
      <path d="M50 52 L20 27" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 52 L81 23" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 52 L24 79" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 52 L77 75" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 52 L50 15" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="52" r="12" fill="var(--primary)" />
      <circle cx="20" cy="27" r="7" fill="var(--text-primary)" />
      <circle cx="81" cy="23" r="8" fill="var(--text-primary)" />
      <circle cx="24" cy="79" r="6.5" fill="var(--text-primary)" />
      <circle cx="77" cy="75" r="7.5" fill="var(--text-primary)" />
      <circle cx="50" cy="15" r="5" fill="var(--text-primary)" />
    </svg>
  )
}

const WORDMARK_STYLE: CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  fontWeight: 600,
  letterSpacing: '-0.04em',
  color: 'var(--text-heading)',
  lineHeight: 1,
  userSelect: 'none',
}

/**
 * Brand lockup: mark + lowercase `rhizome` wordmark. The wordmark is a fixed
 * brand element — always JetBrains Mono, always lowercase — regardless of
 * any UI font direction (brand handoff, Wordmark section).
 */
export function BrandLockup({
  markSize = 18,
  fontSize = 13,
  style,
}: {
  markSize?: number
  fontSize?: number
  style?: CSSProperties
}) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(markSize * 0.42), ...style }}
      data-testid="brand-lockup"
    >
      <BrandMark size={markSize} />
      <span style={{ ...WORDMARK_STYLE, fontSize }}>rhizome</span>
    </span>
  )
}
