import type { CSSProperties } from 'react'
import { BrandMark } from './BrandMark'

declare global {
  interface Window {
    __rhizomeBootStartedAt?: number
  }
}

/**
 * Shown while the lazy `App` chunk loads. Replaces `Suspense fallback={null}`,
 * which left a dead dark window for ~2s on cold launch. The HTML bootstrap
 * loads BootSplash.css so both startup stages share the same layout and motion.
 * `--boot-elapsed` continues the HTML entrance instead of replaying it.
 */
function readBootElapsed(): string {
  if (typeof performance === 'undefined' || typeof performance.now !== 'function') return '0ms'
  const startedAt = window.__rhizomeBootStartedAt
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return '0ms'
  return `${Math.max(0, performance.now() - startedAt)}ms`
}

export function BootSplash() {
  const elapsed = readBootElapsed()
  return (
    <div
      aria-busy="true"
      aria-label="Loading Rhizome"
      className="boot-splash"
      data-testid="boot-splash"
      role="status"
      style={{ '--boot-elapsed': elapsed } as CSSProperties}
    >
      <div className="boot-splash-card" data-testid="boot-splash-card">
        <BrandMark size={56}>
          <defs>
            <radialGradient id="boot-node-material" cx="28%" cy="22%" r="78%">
              <stop offset="0" className="boot-node-highlight" />
              <stop offset="0.52" className="boot-node-color" />
              <stop offset="1" className="boot-node-shade" />
            </radialGradient>
            <radialGradient id="boot-core-material" cx="28%" cy="22%" r="78%">
              <stop offset="0" className="boot-core-highlight" />
              <stop offset="0.52" className="boot-core-color" />
              <stop offset="1" className="boot-core-shade" />
            </radialGradient>
          </defs>
        </BrandMark>
        <div className="boot-splash-wordmark">rhizome</div>
        <div className="boot-splash-status">Starting…</div>
      </div>
    </div>
  )
}
