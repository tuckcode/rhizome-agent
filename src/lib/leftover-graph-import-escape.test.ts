import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover graph import and Escape', () => {
  it('imports graphData once in the 3D canvas', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/graph/ForceGraph3DCanvas.tsx`,
      'utf8',
    )
    expect(source.match(/from '\.\/graphData'/g)).toEqual(["from './graphData'"])
  })

  it('lets an already-handled Escape stand', () => {
    const source = readFileSync(
      `${process.cwd()}/src/hooks/useGraphKeyboardNav.ts`,
      'utf8',
    )
    expect(source).toContain('if (event.defaultPrevented) return')
  })
})
