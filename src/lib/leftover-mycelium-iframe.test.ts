import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/MyceliumView.tsx`,
  'utf8',
)

describe('Mycelium leftover iframe embed', () => {
  it('locks Mycelium as an in-app iframe, not window.open', () => {
    expect(source).toContain('<iframe')
    expect(source).toContain('src={sidecar.url}')
    expect(source).toContain('data-testid="mycelium-embed"')
    expect(source).not.toContain('window.open')
  })
})
