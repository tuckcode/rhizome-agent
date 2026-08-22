import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `ai-border-pulse` is applied to the <aside> wrapping the entire AI panel.
 * Anything inheritable in these keyframes animates the whole transcript, not
 * the indicator strip — which is exactly how a two-second full-panel fade
 * shipped unnoticed. This guards the shape, since the symptom is easy to
 * mistake for a rendering quirk rather than a bug.
 */
const CSS = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8')

function keyframeBody(name: string): string {
  const start = CSS.indexOf(`@keyframes ${name}`)
  expect(start, `@keyframes ${name} not found`).toBeGreaterThan(-1)
  const open = CSS.indexOf('{', start)
  let depth = 0
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1
    if (CSS[i] === '}') {
      depth -= 1
      if (depth === 0) return CSS.slice(open + 1, i)
    }
  }
  throw new Error(`unterminated @keyframes ${name}`)
}

describe('ai-border-pulse', () => {
  it('animates only the indicator border, never anything the subtree inherits', () => {
    const body = keyframeBody('ai-border-pulse')
    // Property names only — a substring check would read `color` out of
    // `border-left-color` and fail on the correct rule.
    const properties = new Set(
      [...body.matchAll(/(^|[{;\s])([a-z-]+)\s*:/g)].map((match) => match[2]),
    )

    for (const inheritable of ['opacity', 'filter', 'color', 'visibility', 'transform']) {
      expect(properties.has(inheritable), `must not animate ${inheritable}`).toBe(false)
    }
    expect(properties.has('border-left-color')).toBe(true)
  })
})
