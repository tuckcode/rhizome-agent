import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src-tauri/.gitignore`,
  'utf8',
)

describe('leftover mcp gitignore', () => {
  it('locks the ignored packaged mcp-server path', () => {
    expect(source).toContain('/resources/mcp-server/')
  })
})
