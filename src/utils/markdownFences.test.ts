import { describe, expect, it } from 'vitest'
import {
  advanceMarkdownFence,
  isInsideMarkdownFence,
  readMarkdownFence,
  type MarkdownFenceScanOptions,
} from './markdownFences'

describe('markdown fence scanning', () => {
  it('reads backtick and tilde fence openings with the default indentation rule', () => {
    expect(readMarkdownFence('```ts')).toEqual({ character: '`', length: 3 })
    expect(readMarkdownFence('   ~~~~')).toEqual({ character: '~', length: 4 })
    expect(readMarkdownFence('    ```ts')).toBeNull()
    expect(readMarkdownFence('not a fence')).toBeNull()
  })

  it('requires matching closing fence character and sufficient length', () => {
    const opening = readMarkdownFence('````ts')

    expect(advanceMarkdownFence('```', opening)).toBe(opening)
    expect(advanceMarkdownFence('~~~~', opening)).toBe(opening)
    expect(advanceMarkdownFence('````', opening)).toBeNull()
  })

  it('keeps strict closing fences to only the fence plus whitespace by default', () => {
    const opening = readMarkdownFence('```ts')

    expect(advanceMarkdownFence('```ts', opening)).toBe(opening)
    expect(advanceMarkdownFence('```  ', opening)).toBeNull()
  })

  it('supports the existing wikilink prefix scanner shape when requested', () => {
    const options: MarkdownFenceScanOptions = {
      closingMustEndLine: false,
      maxLeadingSpaces: null,
    }
    const opening = readMarkdownFence('    ```ts', options)

    expect(opening).toEqual({ character: '`', length: 3 })
    expect(advanceMarkdownFence('    ``` still treated as closing', opening, options)).toBeNull()
  })

  it('detects whether a markdown prefix is currently inside a fence', () => {
    expect(isInsideMarkdownFence('before\n~~~mermaid\nA --> B')).toBe(true)
    expect(isInsideMarkdownFence('before\n~~~mermaid\nA --> B\n~~~\nafter')).toBe(false)
  })
})
