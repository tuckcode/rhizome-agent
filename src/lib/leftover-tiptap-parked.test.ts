import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')

describe('leftover tiptap parked', () => {
  it('locks the Tiptap extension-link 3.19.0 patch pin', () => {
    expect(source).toContain(
      "'@tiptap/extension-link@3.19.0': patches/@tiptap__extension-link@3.19.0.patch",
    )
  })
})
