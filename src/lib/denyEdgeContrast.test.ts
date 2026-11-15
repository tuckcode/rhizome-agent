import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The danger-card Deny edge mixes --foreground into --card (ADR-0192).
// Every theme sets those through --text-primary and --surface-card, so the
// contrast can be checked from the CSS without a browser.
// `node scripts/deny-edge-contrast.mjs` measures the same in Chromium.

const root = join(__dirname, '..', '..')
const read = (file: string) => readFileSync(join(root, file), 'utf8')

type Rgb = [number, number, number]

function hex(value: string): Rgb {
  const digits = value.replace('#', '')
  return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)) as Rgb
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** `color-mix(in srgb, fg P%, card)`. */
function mix(fg: Rgb, card: Rgb, percent: number): Rgb {
  const weight = percent / 100
  return fg.map((channel, index) => channel * weight + card[index] * (1 - weight)) as Rgb
}

interface ThemeColors {
  name: string
  card: Rgb
  foreground: Rgb
}

function blockColors(name: string, body: string): ThemeColors {
  const card = /--surface-card:\s*(#[0-9a-f]{6})/i.exec(body)?.[1]
  const foreground = /--text-primary:\s*(#[0-9a-f]{6})/i.exec(body)?.[1]
  if (!card || !foreground) throw new Error(`Theme ${name} has no hex card or text color`)
  return { name, card: hex(card), foreground: hex(foreground) }
}

/** The rule block whose selector list starts with `selector` at the start of a line. */
function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector}`)
  if (start < 0) throw new Error(`Missing selector ${selector}`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

function allThemes(): ThemeColors[] {
  const index = read('src/index.css')
  const themes = read('src/themes.css')
  const named = [...themes.matchAll(/^:root\[data-color-theme="([^"]+)"\][^{]*\{([^}]*)\}/gm)]
    .map((match) => blockColors(match[1], match[2]))
  return [
    blockColors('earth-light', blockAfter(index, ':root,\n[data-theme="light"]')),
    blockColors('graphite', blockAfter(index, ':root.dark:not([data-color-theme])')),
    blockColors('rhizome', blockAfter(index, ':root.dark[data-color-theme="rhizome"]')),
    ...named,
  ]
}

function denyEdgePercent(): number {
  const source = read('src/components/ToolApprovalCard.tsx')
  const match = /const DANGER_DENY = '[^']*color-mix\(in_srgb,var\(--foreground\)_(\d+)%,var\(--card\)\)/.exec(source)
  if (!match) throw new Error('DANGER_DENY no longer mixes --foreground into --card')
  return Number(match[1])
}

describe('danger Deny edge contrast', () => {
  it('reads every theme', () => {
    expect(allThemes().length).toBeGreaterThanOrEqual(20)
  })

  it('clears 3:1 against the card in every theme', () => {
    const percent = denyEdgePercent()
    const ratios = allThemes().map((theme) => ({
      name: theme.name,
      ratio: contrast(mix(theme.foreground, theme.card, percent), theme.card),
    }))
    const lowest = ratios.reduce((min, row) => (row.ratio < min.ratio ? row : min))
    expect(lowest.ratio, `${lowest.name} is ${lowest.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })
})
