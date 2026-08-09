import { describe, expect, it } from 'vitest'
import { parseMarkdownBlocksWithFallback } from './editorMarkdownParseFallback'

describe('parseMarkdownBlocksWithFallback', () => {
  it('renders non-empty source markdown when the parser returns no blocks', async () => {
    const parsed = await parseMarkdownBlocksWithFallback({
      parseMarkdownBlocks: () => [],
      preprocessed: '## Heading\n\nBody',
      sourceMarkdown: '## Heading\n\nBody',
      context: 'workspace-note.md',
    })

    expect(parsed.usedSourceFallback).toBe(true)
    expect(parsed.blocks).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '## Heading', styles: {} }],
        children: [],
      },
      {
        type: 'paragraph',
        content: [],
        children: [],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Body', styles: {} }],
        children: [],
      },
    ])
  })

  it('keeps genuinely blank markdown blank', async () => {
    const parsed = await parseMarkdownBlocksWithFallback({
      parseMarkdownBlocks: () => [],
      preprocessed: '',
      sourceMarkdown: '',
      context: 'blank-note.md',
    })

    expect(parsed.usedSourceFallback).toBe(false)
    expect(parsed.blocks).toEqual([])
  })
})
