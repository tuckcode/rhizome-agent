// Sibling to typeColorResolver.ts, same shape: three.js materials need
// concrete color values — EDGE_KIND_COLOR_MAP holds CSS var references
// like 'var(--accent-blue)' that WebGL can't consume. This resolver
// computes them against the live document theme, memoized; call
// `invalidate()` on theme change so edges recolor.

import type { GraphEdgeKind } from './graphTypes'

const FALLBACK = '#8a8a8a'
const VAR_PATTERN = /^var\((--[^)]+)\)$/

/** Edge kind → accent CSS variable. Four visually distinct accents from
 *  ACCENT_COLORS (src/utils/typeColors.ts) so connection type reads at a
 *  glance in the 3D graph. */
const EDGE_KIND_COLOR_MAP: Record<GraphEdgeKind, string> = {
  wikilink: 'var(--accent-blue)',
  belongs_to: 'var(--accent-purple)',
  related_to: 'var(--accent-teal)',
  relationship: 'var(--accent-orange)',
}

export interface EdgeColorResolver {
  /** Concrete CSS color for an edge kind. */
  colorFor(kind: GraphEdgeKind): string
  /** Drop the memo cache (call when the theme changes). */
  invalidate(): void
}

export function createEdgeColorResolver(
  root: HTMLElement = document.documentElement,
): EdgeColorResolver {
  const cache = new Map<string, string>()

  const resolveCssValue = (cssColor: string): string => {
    const match = VAR_PATTERN.exec(cssColor.trim())
    if (!match) {
      return cssColor
    }
    const value = getComputedStyle(root).getPropertyValue(match[1]).trim()
    return value || FALLBACK
  }

  return {
    colorFor(kind: GraphEdgeKind): string {
      const cached = cache.get(kind)
      if (cached) {
        return cached
      }
      const resolved = resolveCssValue(EDGE_KIND_COLOR_MAP[kind] ?? FALLBACK)
      cache.set(kind, resolved)
      return resolved
    },
    invalidate() {
      cache.clear()
    },
  }
}
