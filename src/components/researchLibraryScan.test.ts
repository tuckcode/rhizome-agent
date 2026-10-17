import { describe, expect, it } from 'vitest'
import { parseLibraryScan } from './researchLibraryScan'

describe('parseLibraryScan', () => {
  it('keeps a backslash, quotes, a tab, and a newline in the description and filename', () => {
    const description = 'quote " backslash \\ tab \t newline \n'
    const filename = 'quote " backslash \\ tab \t newline \n.md'
    const path = `wiki/concepts/${filename}`
    const raw = JSON.stringify([
      {
        id: filename,
        path,
        title: 'nasty',
        description,
        type: 'card',
        tag: 'Concept',
        date: 0,
      },
    ])

    const items = parseLibraryScan(raw)

    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(filename)
    expect(items[0].path).toBe(path)
    expect(items[0].description).toBe(description)
    expect(items[0].description).toContain('\\')
    expect(items[0].description).toContain('"')
    expect(items[0].description).toContain('\t')
    expect(items[0].description).toContain('\n')
    expect(items[0].id).toContain('\n')
  })
})
