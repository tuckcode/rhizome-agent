// three.js materials need concrete color values — `getTypeColor` returns
// CSS var references like 'var(--accent-red)' that WebGL can't consume.
// This resolver computes them against the live document theme, memoized;
// call `invalidate()` on theme change so nodes recolor.

import { getTypeColor } from '../../utils/typeColors'

const GHOST_FALLBACK = '#8a8a8a'
const VAR_PATTERN = /^var\((--[^)]+)\)$/

export interface TypeColorResolver {
  /** Concrete CSS color for a node. Ghosts get the dimmed muted tone. */
  colorFor(isA: string | null, ghost: boolean): string
  /** Drop the memo cache (call when the theme changes). */
  invalidate(): void
}

export function createTypeColorResolver(
  root: HTMLElement = document.documentElement,
): TypeColorResolver {
  const cache = new Map<string, string>()

  const resolveCssValue = (cssColor: string): string => {
    const match = VAR_PATTERN.exec(cssColor.trim())
    if (!match) {
      return cssColor
    }
    const value = getComputedStyle(root).getPropertyValue(match[1]).trim()
    return value || GHOST_FALLBACK
  }

  return {
    colorFor(isA: string | null, ghost: boolean): string {
      const key = ghost ? '__ghost__' : `type:${isA ?? ''}`
      const cached = cache.get(key)
      if (cached) {
        return cached
      }
      const cssColor = ghost ? 'var(--muted-foreground)' : getTypeColor(isA)
      const resolved = resolveCssValue(cssColor)
      cache.set(key, resolved)
      return resolved
    },
    invalidate() {
      cache.clear()
    },
  }
}
