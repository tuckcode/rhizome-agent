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
  const dark = themeBlock(css, ':root.dark,\n[data-theme="dark"]')

  it('keeps muted and faint aligned with tertiary in both themes', () => {
    expect(token(light, '--text-muted')).toBe(token(light, '--text-tertiary'))
    expect(token(light, '--text-faint')).toBe(token(light, '--text-tertiary'))
    expect(token(dark, '--text-muted')).toBe(token(dark, '--text-tertiary'))
    expect(token(dark, '--text-faint')).toBe(token(dark, '--text-tertiary'))
  })

  it('gives muted text at least 4.5:1 on selected-strong in both themes', () => {
    expect(contrastRatio(token(light, '--text-muted'), token(light, '--state-selected-strong')))
      .toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token(dark, '--text-muted'), token(dark, '--state-selected-strong')))
      .toBeGreaterThanOrEqual(4.5)
  })

  it('gives light status text dedicated ok/warn/danger tokens', () => {
    expect(token(light, '--ok-text')).toBe('#276E45')
    expect(token(light, '--danger-text')).toBe('#A3352A')
    expect(token(light, '--warn-text')).toBe('#9A4524')
    expect(token(light, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(light, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(light, '--feedback-warning-text')).toBe('var(--warn-text)')
  })
})
