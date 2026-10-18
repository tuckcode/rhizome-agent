import { describe, expect, it } from 'vitest'
import type { ViewDefinition } from '../types'
import { SUGGESTED_STATUSES } from '../utils/statusStyles'
import { presentationFromViewDefinition } from './presentationConfig'

function definition(presentation?: unknown): ViewDefinition {
  const base: ViewDefinition = {
    name: 'Work',
    icon: null,
    color: null,
    sort: 'modified:desc',
    listPropertiesDisplay: ['status'],
    filters: { all: [] },
  }
  return (presentation === undefined ? base : { ...base, presentation }) as ViewDefinition
}

const listFallback = { type: 'list', sort: 'modified:desc', properties: ['status'] }

describe('presentationFromViewDefinition', () => {
  it('reads the frozen board schema', () => {
    expect(presentationFromViewDefinition(definition({
      type: 'board',
      groupBy: 'Status',
      columns: ['Done', 'Review'],
    }))).toEqual({ type: 'board', groupBy: 'Status', columns: ['Done', 'Review'] })
  })

  it('cleans up board columns and defaults to the suggested statuses', () => {
    expect(presentationFromViewDefinition(definition({
      type: 'board',
      columns: [' Done ', 'done', 5, 'Review'],
    }))).toEqual({ type: 'board', groupBy: 'Status', columns: ['Done', 'Review'] })
    for (const columns of [undefined, 'Done', [], ['  ']]) {
      expect(presentationFromViewDefinition(definition({ type: 'board', columns }))).toEqual({
        type: 'board',
        groupBy: 'Status',
        columns: [...SUGGESTED_STATUSES],
      })
    }
  })

  it('falls back to list for a malformed board config', () => {
    for (const presentation of [
      'board',
      { type: 'board', groupBy: 'Owner' },
      { type: 'board', groupBy: ['Status'] },
      { type: ['board'] },
      { type: 'gallery' },
    ]) {
      expect(presentationFromViewDefinition(definition(presentation))).toEqual(listFallback)
    }
  })

  it('keeps list views as they were', () => {
    expect(presentationFromViewDefinition(definition())).toEqual(listFallback)
    expect(presentationFromViewDefinition(definition({ type: 'list', sort: 'title:asc' }))).toEqual({
      type: 'list',
      sort: 'title:asc',
      properties: ['status'],
    })
  })
})
