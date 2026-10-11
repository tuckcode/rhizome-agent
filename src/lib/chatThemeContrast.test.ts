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

describe('chat theme contrast tokens (B2–B4)', () => {
  const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8')
  const light = themeBlock(css, ':root,\n[data-theme="light"]')
  const dark = themeBlock(css, ':root.dark,\n[data-theme="dark"]')

  it('raises light muted and faint text to tertiary-safe #616A59', () => {
    expect(token(light, '--text-muted')).toBe('#616A59')
    expect(token(light, '--text-faint')).toBe('#616A59')
  })

  it('raises dark muted and faint text to tertiary-safe #929C86', () => {
    expect(token(dark, '--text-muted')).toBe('#929C86')
    expect(token(dark, '--text-faint')).toBe('#929C86')
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
