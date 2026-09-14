import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover tokenjuice parked', () => {
  it('does not vendor TokenJuice or tinyhumans', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    expect(pkg).not.toMatch(/tokenjuice|tinyhumans/i)
  })

  it('does not add a kanban crate', () => {
    const cargo = readFileSync(`${process.cwd()}/src-tauri/Cargo.toml`, 'utf8')
    expect(cargo).not.toMatch(/kanban/i)
  })
})
