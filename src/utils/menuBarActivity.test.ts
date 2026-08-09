import { describe, expect, it } from 'vitest'
import { toActivityRows } from './menuBarActivity'

describe('toActivityRows', () => {
  it('maps event types to display verbs', () => {
    const rows = toActivityRows([
      { type: 'capture', artifact_path: 'raw/inbox/2026-07-25-thought.md', timestamp: '2026-07-19T11:00:00Z' },
      { type: 'distill', artifact_path: 'wiki/concepts/event-sourcing.md', timestamp: '2026-07-19T10:00:00Z' },
      { type: 'import', title: 'Some Doc', timestamp: '2026-07-19T09:00:00Z' },
      { type: 'edited', path: 'raw/inbox/note.md', timestamp: '2026-07-19T08:00:00Z' },
    ])
    expect(rows).toEqual([
      { verb: 'captured', target: '2026-07-25-thought', when: '2026-07-19T11:00:00Z', source: '' },
      { verb: 'distilled', target: 'event-sourcing', when: '2026-07-19T10:00:00Z', source: '' },
      { verb: 'imported', target: 'Some Doc', when: '2026-07-19T09:00:00Z', source: '' },
      // limit default 3 — only first three rows
    ].slice(0, 3))
  })

  it('caps at the limit (newest-first is preserved from the reader)', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({ type: 'distill', title: `n${i}` }))
    expect(toActivityRows(events)).toHaveLength(3)
    expect(toActivityRows(events, 5)).toHaveLength(5)
  })

  it('falls back to "updated" verb and "a note" target for unknown/empty', () => {
    expect(toActivityRows([{ type: 'mystery' }])).toEqual([
      { verb: 'updated', target: 'a note', when: '', source: '' },
    ])
  })

  it('skips non-object entries', () => {
    // @ts-expect-error deliberately malformed input
    expect(toActivityRows([null, 'x', { type: 'distill', title: 'ok' }])).toEqual([
      { verb: 'distilled', target: 'ok', when: '', source: '' },
    ])
  })

  /**
   * Audit finding 9: verbFor mapped `capture`/`distill`/`import`/
   * `repo-research`/`edit`, but the types actually written are
   * `research-started`, `research-finished` and `source-imported`. All three
   * fell through to the generic "updated" — 3 of the 4 distinct types in a
   * real event log.
   */
  it('maps the event types actually written by the app', () => {
    const verbs = toActivityRows(
      [
        { type: 'research-started', title: 'a' },
        { type: 'research-finished', title: 'b' },
        { type: 'source-imported', title: 'c' },
      ],
      10,
    ).map((r) => r.verb)
    expect(verbs).toEqual(['researching', 'wrote', 'imported'])
  })

  it('maps the JS-only MCP event types', () => {
    const verbs = toActivityRows(
      [
        { type: 'search', title: 'a' },
        { type: 'lint', title: 'b' },
        { type: 'graph-summary', title: 'c' },
        { type: 'wiki-generate-started', title: 'd' },
        { type: 'wiki-generate-finished', title: 'e' },
      ],
      10,
    ).map((r) => r.verb)
    expect(verbs).toEqual(['searched', 'linted', 'summarised', 'generating', 'generated'])
  })

  /**
   * Audit finding 1: `trigger` was written by six sites and read by nothing.
   * This is the reader — it says which mechanism performed the save.
   */
  it('surfaces the trigger as a human-readable source', () => {
    const sources = toActivityRows(
      [
        { type: 'capture', trigger: 'menu_bar' },
        { type: 'distill', trigger: 'inbox' },
        { type: 'distill', trigger: 'session_auto' },
        { type: 'capture', trigger: 'browser_extension' },
        { type: 'edit', trigger: 'manual_edit' },
        { type: 'distill', trigger: 'manual' },
        { type: 'distill', trigger: 'mcp' },
      ],
      10,
    ).map((r) => r.source)
    expect(sources).toEqual([
      'menu bar',
      'inbox',
      'auto',
      'browser',
      'editor',
      'in app',
      'agent',
    ])
  })

  /**
   * 33% of records in a real log predate the trigger guarantee, and the JS
   * writer still emits none. Those must render cleanly, not as "undefined".
   */
  it('yields an empty source for missing or unknown triggers', () => {
    const sources = toActivityRows(
      [{ type: 'distill' }, { type: 'distill', trigger: 'something-new' }, { type: 'distill', trigger: '' }],
      10,
    ).map((r) => r.source)
    expect(sources).toEqual(['', '', ''])
  })
})
