import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')
const lockfile = readFileSync(`${process.cwd()}/pnpm-lock.yaml`, 'utf8')

// 2026-09-27: the Tiptap park ended with the BlockNote 0.55 upgrade.
// @tiptap/core below 3.30.5 carries GHSA-j95f-988m-3j2f (Markdown ReDoS).
describe('tiptap after the BlockNote 0.55 upgrade', () => {
  it('keeps no @tiptap/core release below 3.30.5 in the lockfile', () => {
    const versions = [...lockfile.matchAll(/'@tiptap\/core@(\d+)\.(\d+)\.(\d+)'/g)]
      .map(([, major, minor, patch]) => [Number(major), Number(minor), Number(patch)])
    expect(versions.length).toBeGreaterThan(0)
    for (const [major, minor, patch] of versions) {
      const patched = major > 3 || (major === 3 && (minor > 30 || (minor === 30 && patch >= 5)))
      expect(patched, `@tiptap/core@${major}.${minor}.${patch}`).toBe(true)
    }
  })

  it('drops the obsolete @tiptap/extension-link 3.19.0 patch', () => {
    expect(workspace).not.toContain('@tiptap/extension-link@3.19.0')
  })
})
