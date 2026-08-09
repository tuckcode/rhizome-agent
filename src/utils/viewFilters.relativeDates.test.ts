import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry, ViewDefinition } from '../types'
import { evaluateView } from './viewFilters'

const BASE_ENTRY: VaultEntry = {
  path: '/vault/test.md',
  filename: 'test.md',
  title: 'Test',
  isA: null,
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1,
  createdAt: 1,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  favorite: false,
  favoriteIndex: null,
  outgoingLinks: [],
  properties: {},
  listPropertiesDisplay: [],
}

function makeEntry(title: string, date: string): VaultEntry {
  return {
    ...BASE_ENTRY,
    path: `/vault/${title.toLowerCase()}.md`,
    filename: `${title.toLowerCase()}.md`,
    title,
    properties: { date },
  }
}

function dateEqualsView(value: string): ViewDefinition {
  return {
    name: 'Relative date',
    icon: null,
    color: null,
    sort: null,
    filters: { all: [{ field: 'date', op: 'equals', value }] },
  }
}

describe('relative date view filters', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches today against date frontmatter at query time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'))

    const result = evaluateView(dateEqualsView('today'), [
      makeEntry('Yesterday', '2026-04-06'),
      makeEntry('Today', '2026-04-07'),
      makeEntry('Tomorrow', '2026-04-08'),
    ])

    expect(result.map((entry) => entry.title)).toEqual(['Today'])
  })

  it('matches future relative expressions against date frontmatter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'))

    const result = evaluateView(dateEqualsView('in 1 week'), [
      makeEntry('Today', '2026-04-07'),
      makeEntry('Next Week', '2026-04-14'),
      makeEntry('Later', '2026-04-15'),
    ])

    expect(result.map((entry) => entry.title)).toEqual(['Next Week'])
  })

  it('keeps unsupported calendar tokens from matching arbitrary dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'))

    expect(evaluateView(dateEqualsView('this month'), [
      makeEntry('April Entry', '2026-04-15'),
    ])).toEqual([])
  })
})
