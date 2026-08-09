import { describe, expect, it } from 'vitest'
import {
  ALL_NOTES_SELECTION,
  GRAPH_SELECTION,
  INBOX_SELECTION,
  getDefaultSelectionForOrganization,
  isExplicitOrganizationEnabled,
  sanitizeSelectionForOrganization,
  toggleGraphSelection,
} from './organizationWorkflow'

describe('organizationWorkflow', () => {
  it('treats the setting as enabled by default', () => {
    expect(isExplicitOrganizationEnabled(undefined)).toBe(true)
    expect(isExplicitOrganizationEnabled(null)).toBe(true)
  })

  it('treats explicit false as disabled', () => {
    expect(isExplicitOrganizationEnabled(false)).toBe(false)
  })

  it('defaults to Inbox when explicit organization is enabled', () => {
    expect(getDefaultSelectionForOrganization(true)).toEqual(INBOX_SELECTION)
  })

  it('defaults to All Notes when explicit organization is disabled', () => {
    expect(getDefaultSelectionForOrganization(false)).toEqual(ALL_NOTES_SELECTION)
  })

  it('replaces Inbox selection with All Notes when the workflow is disabled', () => {
    expect(sanitizeSelectionForOrganization(INBOX_SELECTION, false)).toEqual(ALL_NOTES_SELECTION)
  })

  it('leaves non-Inbox selections unchanged when the workflow is disabled', () => {
    const selection = { kind: 'filter', filter: 'archived' } as const
    expect(sanitizeSelectionForOrganization(selection, false)).toEqual(selection)
  })

  describe('toggleGraphSelection', () => {
    it('opens the graph from any non-graph selection', () => {
      expect(toggleGraphSelection(INBOX_SELECTION, true)).toEqual(GRAPH_SELECTION)
      expect(toggleGraphSelection(ALL_NOTES_SELECTION, false)).toEqual(GRAPH_SELECTION)
      expect(toggleGraphSelection({ kind: 'filter', filter: 'pulse' }, true)).toEqual(GRAPH_SELECTION)
    })

    it('returns to the org-aware default when already on the graph', () => {
      expect(toggleGraphSelection(GRAPH_SELECTION, true)).toEqual(INBOX_SELECTION)
      expect(toggleGraphSelection(GRAPH_SELECTION, false)).toEqual(ALL_NOTES_SELECTION)
    })
  })
})
