import { describe, expect, it } from 'vitest'
import { injectWikilinks, preProcessWikilinks, restoreWikilinksInBlocks } from './wikilinks'

interface TestBlock {
  text?: string
  content?: unknown
}

describe('wikilink table round-trips', () => {
  it('keeps aliased wikilinks inside table cells without dropping sibling cells', () => {
    const markdown = [
      '| Quote | Author | Movement |',
      '| - | - | - |',
      '| _The happiness of your life depends upon the quality of your thoughts._ | [[Marcus Aurelius Antoninus|Marcus Aurelius]] | [[Stoic]] |',
    ].join('\n')

    const [, , bodyRow] = preProcessWikilinks(markdown).split('\n')
    const cells = bodyRow
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())

    expect(cells).toHaveLength(3)

    const [tableBlock] = injectWikilinks([{
      type: 'table',
      content: {
        type: 'tableContent',
        rows: [{
          cells: cells.map((text) => ({
            type: 'tableCell',
            content: [{ type: 'text', text, styles: {} }],
          })),
        }],
      },
      children: [],
    }])

    const [restored] = restoreWikilinksInBlocks([tableBlock]) as TestBlock[]
    const tableContent = restored.content as {
      rows: Array<{ cells: Array<{ content: TestBlock[] }> }>
    }
    const restoredCells = tableContent.rows[0].cells.map((cell) => (
      cell.content.map((item) => item.text ?? '').join('')
    ))

    expect(restoredCells).toEqual([
      '_The happiness of your life depends upon the quality of your thoughts._',
      '[[Marcus Aurelius Antoninus|Marcus Aurelius]]',
      '[[Stoic]]',
    ])
  })
})
