import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    if (/\.test\.tsx?$/.test(name)) return []
    return /\.(rs|ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('leftover kanban parked', () => {
  it('does not vendor TokenJuice or tinyhumans', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    expect(pkg).not.toMatch(/tokenjuice|tinyhumans/i)
  })

  // ADR-0188: boards are saved views over markdown notes; there is no kanban.db.
  it('does not add a kanban database', () => {
    const roots = ['src', 'src-tauri/src'].map((d) => join(process.cwd(), d))
    const hits = roots
      .flatMap(sourceFiles)
      .filter((f) => /kanban\.db/i.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
