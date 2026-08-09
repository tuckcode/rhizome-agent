/**
 * Pure helpers for the menu-bar companion's network-activity feed.
 * Maps raw `.rhizome/events.jsonl` records (as returned by the
 * `rhizome_read_events` tool, newest-first) into a small display model.
 * No Tauri, no I/O.
 */

export interface ActivityRow {
  /** Plain-language verb: wrote / distilled / imported / edited. */
  verb: string
  /** What was acted on — an artifact/note path or title, best-effort. */
  target: string
  /** Raw ISO timestamp (may be empty if the event lacked one). */
  when: string
  /**
   * Which mechanism performed the save, from the event's `trigger`.
   * Empty when the event has no trigger or an unrecognised one — which is
   * common: a third of records in a real log predate the guarantee that
   * every event carries one, and `mcp-server/index.js` still writes none.
   */
  source: string
}

/**
 * Event `type` → display verb. Unknown types fall back to "updated".
 *
 * The `research-started` / `research-finished` / `source-imported` cases
 * matter most: those are the types the app actually writes, and until
 * 2026-07-31 none of them were handled, so 3 of the 4 distinct types in a
 * real event log all rendered as the generic "updated". `repo-research`
 * below is the opposite problem — mapped here, written by nobody — kept
 * only because older logs may contain it.
 */
function verbFor(eventType: string): string {
  switch (eventType) {
    case 'capture':
    case 'captured':
      return 'captured'
    case 'distill':
    case 'distilled':
      return 'distilled'
    case 'import':
    case 'imported':
    case 'grok-import':
    case 'source-imported':
      return 'imported'
    case 'research-started':
      return 'researching'
    case 'research-finished':
    case 'repo-research':
    case 'wrote':
    case 'write':
      return 'wrote'
    case 'edit':
    case 'edited':
      return 'edited'
    // Written only by mcp-server/index.js, which emits no trigger.
    case 'search':
      return 'searched'
    case 'lint':
      return 'linted'
    case 'graph-summary':
      return 'summarised'
    case 'wiki-generate-started':
      return 'generating'
    case 'wiki-generate-finished':
      return 'generated'
    default:
      return 'updated'
  }
}

/**
 * Event `trigger` → short label naming the mechanism behind the save.
 *
 * Unrecognised and missing triggers return `''` so the row simply omits the
 * label rather than showing "undefined". Deliberately permissive: `trigger`
 * is an unvalidated free string on the write side, so this will meet values
 * it has never seen.
 */
function sourceFor(trigger: unknown): string {
  if (typeof trigger !== 'string') return ''
  switch (trigger) {
    case 'menu_bar':
      return 'menu bar'
    case 'inbox':
      return 'inbox'
    case 'session_auto':
      return 'auto'
    case 'browser_extension':
      return 'browser'
    case 'manual_edit':
      return 'editor'
    case 'manual':
      return 'in app'
    case 'mcp':
      return 'agent'
    default:
      return ''
  }
}

/** Pull the most human-meaningful target string out of a raw event object. */
function targetFor(event: Record<string, unknown>): string {
  const candidate =
    event.title ?? event.artifact_path ?? event.path ?? event.project ?? event.source
  if (typeof candidate !== 'string' || candidate.length === 0) return 'a note'
  // Show just the file stem for path-like targets.
  const stem = candidate.split('/').pop() ?? candidate
  return stem.replace(/\.md$/, '')
}

/**
 * Take raw events (already newest-first from the reader) and return the top
 * `limit` as display rows. Records that aren't objects are skipped.
 */
export function toActivityRows(
  events: Array<Record<string, unknown>>,
  limit = 3,
): ActivityRow[] {
  return events
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .slice(0, limit)
    .map((e) => ({
      verb: verbFor(typeof e.type === 'string' ? e.type : ''),
      target: targetFor(e),
      when: typeof e.timestamp === 'string' ? e.timestamp : '',
      source: sourceFor(e.trigger),
    }))
}
