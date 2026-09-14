import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Getting Started folders only', () => {
  const source = readFileSync(
    `${process.cwd()}/src-tauri/src/vault/getting_started.rs`,
    'utf8',
  )

  it('locks structure only, no personal notes', () => {
    expect(source).toContain('structure only, no personal notes')
  })

  it('locks inbox folder', () => {
    expect(source).toContain('"inbox"')
  })

  it('locks projects folder', () => {
    expect(source).toContain('"projects"')
  })

  it('locks Imports folder', () => {
    expect(source).toContain('"Imports"')
  })
})
