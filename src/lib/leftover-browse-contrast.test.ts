import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function browseToggleRule(css: string): string {
  const match = css.match(/\.vault-panel__browse-toggle\s*\{[^}]+\}/)
  return match?.[0] ?? ''
}

describe('leftover Browse light contrast', () => {
  const css = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')
  const rule = browseToggleRule(css)

  it('paints the Browse label with --text-secondary, not failing light --text-muted', () => {
    expect(rule).toContain('.vault-panel__browse-toggle')
    expect(rule).toContain('color: var(--text-secondary)')
    expect(rule).not.toContain('--text-muted')
  })
})
