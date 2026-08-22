import { describe, expect, it } from 'vitest'
import { disambiguateTitles } from './disambiguateTitles'

interface Row {
  id: string
  title: string
}

const rows = (...entries: Array<[string, string]>): Row[] =>
  entries.map(([id, title]) => ({ id, title }))

const tail = (row: Row) => row.id.slice(-6)

describe('disambiguateTitles', () => {
  it('leaves titles that are already distinct alone', () => {
    const input = rows(['a1b2c3d4', 'Inbox triage'], ['e5f6a7b8', 'Release notes'])

    expect(disambiguateTitles(input, tail).map((row) => row.title)).toEqual([
      'Inbox triage',
      'Release notes',
    ])
  })

  it('suffixes only the rows that collide', () => {
    const input = rows(
      ['aaaaaa111111', 'Untitled'],
      ['bbbbbb222222', 'Release notes'],
      ['cccccc333333', 'Untitled'],
    )

    expect(disambiguateTitles(input, tail).map((row) => row.title)).toEqual([
      'Untitled · 111111',
      'Release notes',
      'Untitled · 333333',
    ])
  })

  it('makes three of the same title three different rows', () => {
    const input = rows(
      ['a111111', 'Untitled'],
      ['b222222', 'Untitled'],
      ['c333333', 'Untitled'],
    )

    const titles = disambiguateTitles(input, tail).map((row) => row.title)

    expect(new Set(titles).size).toBe(3)
  })

  /**
   * The suffix is the caller's to choose because ids differ in shape. A caller
   * that picks a non-distinguishing one gets rows that still collide — which
   * is the failure this whole function exists to prevent, so it must not be
   * hidden by the suffix silently doing nothing.
   */
  it('does not pretend to fix a suffix that does not distinguish', () => {
    const input = rows(['01a004aa', 'Untitled'], ['01a004bb', 'Untitled'])

    const titles = disambiguateTitles(input, (row) => row.id.slice(0, 6)).map((row) => row.title)

    expect(titles).toEqual(['Untitled · 01a004', 'Untitled · 01a004'])
  })

  it('returns the same array when there is nothing to do', () => {
    const input = rows(['a', 'One'], ['b', 'Two'])

    expect(disambiguateTitles(input, tail)).toBe(input)
  })

  it('handles an empty list', () => {
    expect(disambiguateTitles([], tail)).toEqual([])
  })
})
