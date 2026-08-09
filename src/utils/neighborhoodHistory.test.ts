import { describe, expect, it } from 'vitest'
import type { SidebarSelection, VaultEntry } from '../types'
import {
  focusNoteListContainer,
  isEditorEscapeTarget,
  isEditableElement,
  popNeighborhoodHistory,
  pushNeighborhoodHistory,
  resolveNeighborhoodSelection,
  selectionsEqual,
  shouldProcessNeighborhoodEscape,
} from './neighborhoodHistory'

function buildEntry(path: string, title: string): VaultEntry {
  return {
    path,
    filename: `${title.toLowerCase()}.md`,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: 1,
    createdAt: 1,
    fileSize: 1,
    snippet: '',
    wordCount: 1,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  }
}

const inboxSelection: SidebarSelection = { kind: 'filter', filter: 'inbox' }
const alphaSelection: SidebarSelection = { kind: 'entity', entry: buildEntry('/vault/alpha.md', 'Alpha') }
const betaSelection: SidebarSelection = { kind: 'entity', entry: buildEntry('/vault/beta.md', 'Beta') }

describe('neighborhoodHistory', () => {
  it('compares selections by their stable identity fields', () => {
    expect(selectionsEqual(inboxSelection, { kind: 'filter', filter: 'inbox' })).toBe(true)
    expect(selectionsEqual(alphaSelection, { kind: 'entity', entry: buildEntry('/vault/alpha.md', 'Alpha copy') })).toBe(true)
    expect(selectionsEqual(alphaSelection, betaSelection)).toBe(false)
  })

  it('pushes the current selection when Neighborhood pivots to a different context', () => {
    expect(pushNeighborhoodHistory([], inboxSelection, alphaSelection)).toEqual([inboxSelection])
    expect(pushNeighborhoodHistory([inboxSelection], alphaSelection, alphaSelection)).toEqual([inboxSelection])
  })

  it('resolves Neighborhood entry as enter, switch, or exit actions', () => {
    expect(resolveNeighborhoodSelection(inboxSelection, alphaSelection.entry)).toEqual({
      action: 'enter',
      selection: alphaSelection,
    })
    expect(resolveNeighborhoodSelection(alphaSelection, betaSelection.entry)).toEqual({
      action: 'switch',
      selection: betaSelection,
    })
    expect(resolveNeighborhoodSelection(alphaSelection, buildEntry('/vault/alpha.md', 'Alpha copy'))).toEqual({
      action: 'exit',
      selection: { kind: 'filter', filter: 'all' },
    })
  })

  it('pops one level of note-list history at a time', () => {
    expect(popNeighborhoodHistory([inboxSelection, alphaSelection])).toEqual({
      previousSelection: alphaSelection,
      nextHistory: [inboxSelection],
    })
    expect(popNeighborhoodHistory([])).toEqual({
      previousSelection: null,
      nextHistory: [],
    })
  })

  it('only processes Escape when Neighborhood is active and nothing higher priority is open', () => {
    expect(shouldProcessNeighborhoodEscape(
      { defaultPrevented: false, key: 'Escape', metaKey: false, ctrlKey: false, altKey: false },
      alphaSelection,
      false,
    )).toBe(true)
    expect(shouldProcessNeighborhoodEscape(
      { defaultPrevented: false, key: 'Escape', metaKey: false, ctrlKey: false, altKey: false },
      inboxSelection,
      false,
    )).toBe(false)
    expect(shouldProcessNeighborhoodEscape(
      { defaultPrevented: false, key: 'Escape', metaKey: false, ctrlKey: false, altKey: false },
      alphaSelection,
      true,
    )).toBe(false)
  })

  it('detects editable targets that belong to the editor surfaces', () => {
    document.body.innerHTML = `
      <div class="editor__blocknote-container">
        <div id="rich-editor" contenteditable="true"></div>
      </div>
      <div class="cm-editor">
        <div id="raw-editor" contenteditable="true"></div>
      </div>
      <input id="outside-input" />
    `

    expect(isEditorEscapeTarget(document.getElementById('rich-editor'))).toBe(true)
    expect(isEditorEscapeTarget(document.getElementById('raw-editor'))).toBe(true)
    expect(isEditableElement(document.getElementById('outside-input'))).toBe(true)
    expect(isEditorEscapeTarget(document.getElementById('outside-input'))).toBe(false)
  })

  it('focuses the note list container when asked', () => {
    document.body.innerHTML = '<div data-testid="note-list-container" tabindex="0"></div>'

    expect(focusNoteListContainer(document)).toBe(true)
    expect(document.activeElement).toBe(document.querySelector('[data-testid="note-list-container"]'))
  })
})
