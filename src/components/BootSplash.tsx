import type { CSSProperties } from 'react'

/**
 * Shown while the lazy `App` chunk loads. Replaces `Suspense fallback={null}`,
 * which left a dead dark window for ~2s on cold launch.
 */
const splashStyle: CSSProperties = {
  alignItems: 'center',
  background: 'inherit',
  color: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  gap: 8,
  height: '100vh',
  justifyContent: 'center',
  letterSpacing: '0.04em',
  margin: 0,
  userSelect: 'none',
  width: '100%',
}

const markStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  opacity: 0.92,
}

const subStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
}

export function BootSplash() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Rhizome"
      data-testid="boot-splash"
      role="status"
      style={splashStyle}
    >
      <div style={markStyle}>rhizome</div>
      <div style={subStyle}>Starting…</div>
    </div>
  )
}
