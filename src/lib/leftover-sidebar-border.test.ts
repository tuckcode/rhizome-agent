import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover sidebar border', () => {
  const css = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')

  it('keeps the Notes inner seam comment against Chat', () => {
    expect(css).toContain(
      '/* Inner seam against Chat — keep this visible so the column reads as a panel. */',
    )
  })

  it('keeps the sidebar-border left seam', () => {
    expect(css).toContain('border-left: 1px solid var(--sidebar-border);')
  })
})
