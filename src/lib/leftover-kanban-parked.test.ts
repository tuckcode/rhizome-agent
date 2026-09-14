import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover kanban parked', () => {
  it('does not vendor TokenJuice or add kanban.db', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    const cargo = readFileSync(`${process.cwd()}/src-tauri/Cargo.toml`, 'utf8')
    expect(pkg).not.toMatch(/tokenjuice|tinyhumans/i)
    expect(cargo).not.toMatch(/kanban/i)
  })
})
