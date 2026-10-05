/**
 * Fixtures for the cold-launch cost of the transcript remount and the
 * Sessions rail. Sizes match this machine's Prime store on 2026-09-27:
 * the newest log was 333 lines and 469127 bytes (what idle restore reads),
 * and 96 of 189 logs mentioned a message in the first 8 KB (what the rail
 * lists). The bytes are synthetic. No session text is copied.
 */

import type { PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'

/** Lines in the newest session log. Idle restore reads that one file. */
export const COLD_LAUNCH_TRANSCRIPT_ITEMS = 333

/** JSON size of that newest log, in bytes. */
export const COLD_LAUNCH_TRANSCRIPT_BYTES = 469_127

/**
 * Logs whose head mentioned a message. `list_prime_session_summaries`
 * drops empty drafts, so this is the rail's row count, not the directory.
 */
export const COLD_LAUNCH_SESSION_ROWS = 96

const USER_TEXT = 'Check the vault index and say what the next edit should be.'
const CODE_FENCE = [
  '```ts',
  'export function ready(note: string): boolean {',
  '  return note.trim().length > 0',
  '}',
  '```',
].join('\n')

function assistantBody(fill: string): string {
  return [
    'The index is current. The next edit is the session list, not the daemon.',
    '',
    fill,
    '',
    CODE_FENCE,
  ].join('\n')
}

/**
 * A transcript the size of the newest log.
 *
 * Item count is fixed. The last assistant body grows until
 * `JSON.stringify` reaches the byte target, so the remount parses about
 * as much text as that log.
 */
export function buildColdLaunchTranscript(
  itemCount = COLD_LAUNCH_TRANSCRIPT_ITEMS,
  targetBytes = COLD_LAUNCH_TRANSCRIPT_BYTES,
): PrimeTranscriptItem[] {
  const pairs = Math.floor(itemCount / 2)
  const items: PrimeTranscriptItem[] = []
  for (let index = 0; index < pairs; index += 1) {
    items.push({
      kind: 'message',
      id: `user-${index}`,
      message: {
        role: 'user',
        text: USER_TEXT,
        content: USER_TEXT,
        timestamp: 1_758_000_000_000 + index,
      },
    })
    items.push({
      kind: 'message',
      id: `assistant-${index}`,
      message: {
        role: 'assistant',
        text: assistantBody(''),
        content: [{ type: 'thinking', thinking: 'Look at the index first.' }],
        timestamp: 1_758_000_000_000 + index,
      },
      tools: [{ id: `tool-${index}`, tool: 'read', path: `/vault/note-${index}.md`, detail: 'read note' }],
    })
  }
  if (itemCount % 2 === 1) {
    items.push({
      kind: 'message',
      id: 'user-tail',
      message: {
        role: 'user',
        text: USER_TEXT,
        content: USER_TEXT,
        timestamp: 1_758_000_000_000,
      },
    })
  }

  const assistantIndexes: number[] = []
  items.forEach((item, index) => {
    if (item.kind === 'message' && item.message.role === 'assistant') assistantIndexes.push(index)
  })
  if (assistantIndexes.length === 0) return items

  let payload = JSON.stringify(items)
  if (payload.length >= targetBytes) return items

  const gap = targetBytes - payload.length
  const share = Math.ceil(gap / assistantIndexes.length)
  const fill = 'word '.repeat(Math.ceil(share / 5)).slice(0, share)
  for (const index of assistantIndexes) {
    const item = items[index]
    if (item.kind !== 'message') continue
    item.message = { ...item.message, text: assistantBody(fill) }
  }

  payload = JSON.stringify(items)
  if (payload.length < targetBytes) {
    const last = assistantIndexes[assistantIndexes.length - 1]
    const item = items[last]
    if (item.kind === 'message') {
      const extra = 'x'.repeat(targetBytes - payload.length)
      item.message = { ...item.message, text: `${item.message.text}${extra}` }
    }
  }
  return items
}

/** One row per listed session. None are archived or scratch, so all are live. */
export function buildColdLaunchSessions(count = COLD_LAUNCH_SESSION_ROWS): PrimeSessionSummary[] {
  const now = Date.UTC(2026, 8, 27, 15, 0, 0)
  const hour = 60 * 60 * 1000
  return Array.from({ length: count }, (_, index) => ({
    id: `session-${index.toString().padStart(4, '0')}`,
    path: `/sessions/session-${index}.jsonl`,
    title: index % 7 === 0 ? 'Vault index' : `Session ${index}`,
    cwd: index % 5 === 0 ? '/tmp/scratch' : '/Users/jdoe/code/projects/rhizome-agent',
    gitBranch: 'main',
    mtimeMs: now - index * hour,
    hasConversation: true,
    archived: false,
    scratch: false,
  }))
}

export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}
