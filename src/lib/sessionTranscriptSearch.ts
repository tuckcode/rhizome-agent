/**
 * In-memory search over Prime session transcripts.
 *
 * The session list stays metadata-only. This index reads a transcript once
 * per path and list stamp (`mtimeMs`), then answers later queries from memory.
 * A path that leaves the list leaves the index. User turns and assistant
 * prose are searchable. Tool results, status lines, and other non-prose
 * items are not.
 */

import type { PrimeTranscriptItem } from './primeTranscriptToConversation'
import { visibleUserText } from '../utils/ai-chat'

export interface SessionTranscriptSource {
  id: string
  path: string
  title?: string | null
  mtimeMs?: number | null
}

export interface SessionTranscriptHit {
  sessionId: string
  sessionPath: string
  sessionTitle: string
  messageIndex: number
  role: 'user' | 'assistant'
  excerpt: string
}

export interface SessionTranscriptReader {
  listSessions: () => Promise<SessionTranscriptSource[]>
  readTranscript: (path: string) => Promise<PrimeTranscriptItem[]>
}

export interface SessionTranscriptIndex {
  search: (query: string) => Promise<SessionTranscriptHit[]>
  indexedPaths: () => readonly string[]
}

export interface SessionTranscriptOpenDeps {
  switchSession: (path: string) => Promise<unknown>
  readTranscript: (path: string) => Promise<PrimeTranscriptItem[]>
}

export interface SessionTranscriptOpenResult {
  transcript: PrimeTranscriptItem[]
  messageIndex: number
}

interface IndexedTurn {
  messageIndex: number
  role: 'user' | 'assistant'
  text: string
}

interface CachedSession {
  stamp: string
  id: string
  title: string
  turns: IndexedTurn[]
}

interface InflightRead {
  stamp: string
  promise: Promise<CachedSession | null>
}

const EXCERPT_RADIUS = 72

/**
 * Switch the live host to the hit's session and read that transcript.
 *
 * The message index is the point in the transcript array. The chat panel
 * still has to apply that index; this function does not render it.
 */
export async function openSessionTranscriptHit(
  hit: Pick<SessionTranscriptHit, 'sessionPath' | 'messageIndex'>,
  deps: SessionTranscriptOpenDeps,
): Promise<SessionTranscriptOpenResult> {
  await deps.switchSession(hit.sessionPath)
  const transcript = await deps.readTranscript(hit.sessionPath)
  return { transcript, messageIndex: hit.messageIndex }
}

type SessionTranscriptHitListener = (hit: SessionTranscriptHit) => void

const hitOpenListeners = new Set<SessionTranscriptHitListener>()

/**
 * Ask the live chat to open a search hit. SearchPanel lives in App;
 * the session switcher lives in the chat panel. This is the seam.
 */
export function requestOpenSessionTranscriptHit(hit: SessionTranscriptHit): void {
  for (const listener of hitOpenListeners) listener(hit)
}

export function subscribeSessionTranscriptHitOpen(
  listener: SessionTranscriptHitListener,
): () => void {
  hitOpenListeners.add(listener)
  return () => {
    hitOpenListeners.delete(listener)
  }
}

export function createSessionTranscriptIndex(reader: SessionTranscriptReader): SessionTranscriptIndex {
  const cache = new Map<string, CachedSession>()
  const inflight = new Map<string, InflightRead>()
  let livePaths = new Set<string>()

  async function search(query: string): Promise<SessionTranscriptHit[]> {
    const needle = query.trim()
    if (!needle) return []

    const sessions = await listedSessions()
    if (!sessions) return []

    livePaths = new Set(sessions.map((session) => session.path))
    for (const path of cache.keys()) {
      if (!livePaths.has(path)) cache.delete(path)
    }

    await Promise.all(sessions.map((session) => ensure(session)))
    return collect(needle, sessions)
  }

  async function listedSessions(): Promise<SessionTranscriptSource[] | null> {
    try {
      const rows = await reader.listSessions()
      if (!Array.isArray(rows)) return null
      return rows.filter((row) => typeof row?.path === 'string' && row.path.length > 0)
    } catch {
      return null
    }
  }

  function ensure(session: SessionTranscriptSource): Promise<void> {
    const stamp = stampOf(session)
    const cached = cache.get(session.path)
    if (cached && cached.stamp === stamp) {
      cached.id = session.id || session.path
      cached.title = sessionTitle(session)
      return Promise.resolve()
    }

    const pending = inflight.get(session.path)
    if (pending?.stamp === stamp) {
      return pending.promise.then((stored) => {
        remember(session.path, pending.promise, stored)
      })
    }

    const promise = readCached(session, stamp)
    inflight.set(session.path, { stamp, promise })
    return promise.then((stored) => {
      remember(session.path, promise, stored)
    })
  }

  async function readCached(session: SessionTranscriptSource, stamp: string): Promise<CachedSession | null> {
    try {
      const items = await reader.readTranscript(session.path)
      if (!Array.isArray(items)) return null
      return {
        stamp,
        id: session.id || session.path,
        title: sessionTitle(session),
        turns: searchableTurns(items),
      }
    } catch {
      return null
    }
  }

  function remember(path: string, reading: Promise<CachedSession | null>, stored: CachedSession | null) {
    const pending = inflight.get(path)
    if (pending?.promise === reading) inflight.delete(path)
    if (!livePaths.has(path)) {
      cache.delete(path)
      return
    }
    if (!stored) return
    const existing = cache.get(path)
    if (existing && stampRank(existing.stamp) > stampRank(stored.stamp)) return
    cache.set(path, stored)
  }

  function collect(needle: string, sessions: SessionTranscriptSource[]): SessionTranscriptHit[] {
    const lowered = needle.toLowerCase()
    const hits: SessionTranscriptHit[] = []
    for (const session of sessions) {
      const cached = cache.get(session.path)
      if (!cached) continue
      for (const turn of cached.turns) {
        if (!turn.text.toLowerCase().includes(lowered)) continue
        hits.push({
          sessionId: cached.id,
          sessionPath: session.path,
          sessionTitle: cached.title,
          messageIndex: turn.messageIndex,
          role: turn.role,
          excerpt: excerptAround(turn.text, needle),
        })
      }
    }
    return hits
  }

  return {
    search,
    indexedPaths: () => [...cache.keys()],
  }
}

function stampOf(session: SessionTranscriptSource): string {
  return typeof session.mtimeMs === 'number' && Number.isFinite(session.mtimeMs)
    ? String(session.mtimeMs)
    : ''
}

function stampRank(stamp: string): number {
  const value = Number(stamp)
  return Number.isFinite(value) ? value : 0
}

function sessionTitle(session: SessionTranscriptSource): string {
  const title = session.title?.trim()
  return title ? title : 'Untitled session'
}

function searchableTurns(items: PrimeTranscriptItem[]): IndexedTurn[] {
  const turns: IndexedTurn[] = []
  items.forEach((item, messageIndex) => {
    if (item.kind !== 'message') return
    if (item.message.role !== 'user' && item.message.role !== 'assistant') return
    const text = proseOf(item)
    if (!text || isNoiseLine(text)) return
    turns.push({ messageIndex, role: item.message.role, text })
  })
  return turns
}

function proseOf(item: Extract<PrimeTranscriptItem, { kind: 'message' }>): string {
  const raw = typeof item.message.text === 'string' ? item.message.text : ''
  const text = item.message.role === 'user' ? visibleUserText(raw) : raw
  return text.replace(/\s+/g, ' ').trim()
}

function isNoiseLine(text: string): boolean {
  if (/^(agent_status|session_state|tool_status)\b/i.test(text)) return true
  return text.includes('"type":"agent_status"') || text.includes('"type": "agent_status"')
}

function excerptAround(text: string, query: string): string {
  const needle = query.trim().toLowerCase()
  const at = text.toLowerCase().indexOf(needle)
  if (at < 0) return text.slice(0, EXCERPT_RADIUS * 2)
  const start = Math.max(0, at - EXCERPT_RADIUS)
  const end = Math.min(text.length, at + needle.length + EXCERPT_RADIUS)
  const slice = text.slice(start, end).trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${slice}${suffix}`
}
