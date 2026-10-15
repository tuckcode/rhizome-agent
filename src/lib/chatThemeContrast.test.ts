import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function themeBlock(css: string, header: string): string {
  const start = css.indexOf(header)
  expect(start).toBeGreaterThan(-1)
  const next = css.indexOf('\n:root', start + header.length)
  const end = next === -1 ? css.indexOf('\n@theme', start) : next
  return css.slice(start, end === -1 ? undefined : end)
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  expect(match?.[1], name).toBeTruthy()
  return (match?.[1] ?? '').trim()
}

function srgbChannel(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '')
  const r = srgbChannel(Number.parseInt(value.slice(0, 2), 16))
  const g = srgbChannel(Number.parseInt(value.slice(2, 4), 16))
  const b = srgbChannel(Number.parseInt(value.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('chat theme contrast tokens (B2–B4)', () => {
  const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8')
  const light = themeBlock(css, ':root,\n[data-theme="light"]')
  const graphite = themeBlock(css, ':root.dark:not([data-color-theme]),\n[data-theme="dark"]:not([data-color-theme])')
  const dark = themeBlock(css, ':root.dark[data-color-theme="rhizome"] {')

  it('keeps Earth light muted and faint text on the paper-safe ladder', () => {
    expect(token(light, '--text-muted')).toBe('#625A4D')
    expect(token(light, '--text-faint')).toBe('#6B6354')
    expect(token(light, '--text-tertiary')).toBe('#575043')
  })

  it('keeps Graphite muted and faint text on the warm-gray ladder', () => {
    expect(token(graphite, '--text-muted')).toBe('#A6A5A3')
    expect(token(graphite, '--text-faint')).toBe('#9F9E9C')
    expect(token(graphite, '--text-tertiary')).toBe('#AFAEAC')
  })

  it('keeps Earth dark muted and faint text on the forest-safe ladder', () => {
    expect(token(dark, '--text-muted')).toBe('#9B9986')
    expect(token(dark, '--text-faint')).toBe('#9B9989')
    expect(token(dark, '--text-tertiary')).toBe('#A8A592')
  })

  it('gives muted, faint, and tertiary at least 4.5:1 on selected-strong', () => {
    for (const block of [light, dark, graphite]) {
      const selected = token(block, '--state-selected-strong')
      for (const name of ['--text-muted', '--text-faint', '--text-tertiary'] as const) {
        expect(contrastRatio(token(block, name), selected), name).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('gives light status text dedicated Earth ok/warn/danger tokens', () => {
    expect(token(light, '--ok-text')).toBe('#3D6A1E')
    expect(token(light, '--danger-text')).toBe('#A3342A')
    expect(token(light, '--warn-text')).toBe('#8A5208')
    expect(token(light, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(light, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(light, '--feedback-warning-text')).toBe('var(--warn-text)')
  })
})

