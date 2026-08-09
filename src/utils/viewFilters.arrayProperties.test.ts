import { describe, expect, it } from 'vitest'
import type { VaultEntry, ViewDefinition } from '../types'
import { evaluateView } from './viewFilters'

const NOW = Math.floor(Date.now() / 1000)

function makeEntry(title: string, tags: string[]): VaultEntry {
  return {
    path: `/vault/${title.toLowerCase()}.md`,
    filename: `${title.toLowerCase()}.md`,
    title,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: NOW,
    createdAt: NOW,
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
    organized: false,
    favorite: false,
    favoriteIndex: null,
    outgoingLinks: [],
    properties: { tags },
    listPropertiesDisplay: [],
    hasH1: true,
  }
}

function tagsView(value: string): ViewDefinition {
  return {
    name: 'Tags',
    icon: null,
    color: null,
    sort: null,
    filters: { all: [{ field: 'tags', op: 'contains', value }] },
  }
}

describe('evaluateView array properties', () => {
  it('contains matches an exact element in a multi-value frontmatter array', () => {
    const entries = [
      makeEntry('Blues', ['blues', 'chicago']),
      makeEntry('Jazz', ['jazz', 'chicago']),
    ]

    expect(evaluateView(tagsView('blues'), entries).map((entry) => entry.title)).toEqual(['Blues'])
  })

  it('contains does not match partial substrings inside array elements', () => {
    const entries = [
      makeEntry('Bluegrass', ['bluegrass', 'chicago']),
      makeEntry('Blue', ['blue', 'chicago']),
    ]

    expect(evaluateView(tagsView('blue'), entries).map((entry) => entry.title)).toEqual(['Blue'])
  })
})
