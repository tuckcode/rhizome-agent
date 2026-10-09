/**
 * Search over harness session transcripts.
 *
 * Rhizome owns this memory layer (ADR-0177). The session list stays
 * metadata-only. The index reads a transcript once per path and list stamp
 * (`mtimeMs`), keeps the extracted turns on disk, and answers later queries
 * without re-reading an unchanged log. A path that leaves the list leaves
 * the index. User turns and assistant prose are searchable. Tool results,
 * status lines, and other non-prose items are not.
 *
 * The record shape is harness-agnostic (path + stamp + searchable turns) so
 * a later Hermes source can use the same store. Prime's sessions directory
 * is the first reader.
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

export interface IndexedTranscriptTurn {
  messageIndex: number
  role: 'user' | 'assistant'
  text: string
}

export interface PersistedSessionRecord {
  path: string
  stamp: string
  id: string
  title: string
  turns: IndexedTranscriptTurn[]
}

export interface SessionTranscriptIndexDocument {
  version: number
  sessions: PersistedSessionRecord[]
}

export interface SessionTranscriptIndexStore {
  load: () => Promise<PersistedSessionRecord[]>
  save: (records: PersistedSessionRecord[]) => Promise<void>
}

export interface SessionTranscriptIndexOptions {
  store?: SessionTranscriptIndexStore
}

export const SESSION_TRANSCRIPT_INDEX_VERSION = 1

export interface SessionTranscriptOpenDeps {
  switchSession: (path: string) => Promise<unknown>
  readTranscript: (path: string) => Promise<PrimeTranscriptItem[]>
}

export interface SessionTranscriptOpenResult {
  transcript: PrimeTranscriptItem[]
  messageIndex: number
}

interface CachedSession {
  stamp: string
  id: string
  title: string
  turns: IndexedTranscriptTurn[]
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

export function createSessionTranscriptIndex(
  reader: SessionTranscriptReader,
  options: SessionTranscriptIndexOptions = {},
): SessionTranscriptIndex {
  const cache = new Map<string, CachedSession>()
  const inflight = new Map<string, InflightRead>()
  let livePaths = new Set<string>()
  let hydrated = false
  let dirty = false
  const store = options.store

  async function search(query: string): Promise<SessionTranscriptHit[]> {
    const needle = query.trim()
    if (!needle) return []

    const sessions = await listedSessions()
    if (!sessions) return []

    await hydrate()
    livePaths = new Set(sessions.map((session) => session.path))
    pruneMissing()

    await Promise.all(sessions.map((session) => ensure(session)))
    await persist()
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
      const id = session.id || session.path
      const title = sessionTitle(session)
      if (cached.id !== id || cached.title !== title) {
        cached.id = id
        cached.title = title
        dirty = true
      }
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

  async function hydrate() {
    if (hydrated || !store) {
      hydrated = true
      return
    }
    hydrated = true
    try {
      const records = await store.load()
      for (const record of records) {
        if (cache.has(record.path)) continue
        cache.set(record.path, {
          stamp: record.stamp,
          id: record.id,
          title: record.title,
          turns: record.turns,
        })
      }
    } catch {
      // A missing or unreadable store is a cold start, not a search failure.
    }
  }

  function pruneMissing() {
    for (const path of cache.keys()) {
      if (livePaths.has(path)) continue
      cache.delete(path)
      dirty = true
    }
  }

  async function persist() {
    if (!store || !dirty) return
    const records = [...cache.entries()].map(([path, cached]) => ({
      path,
      stamp: cached.stamp,
      id: cached.id,
      title: cached.title,
      turns: cached.turns,
    }))
    try {
      await store.save(records)
      dirty = false
    } catch {
      // Keep dirty so the next search retries. Search still used memory.
    }
  }

  function remember(path: string, reading: Promise<CachedSession | null>, stored: CachedSession | null) {
    const pending = inflight.get(path)
    if (pending?.promise === reading) inflight.delete(path)
    if (!livePaths.has(path)) {
      if (cache.delete(path)) dirty = true
      return
    }
    if (!stored) return
    const existing = cache.get(path)
    if (existing && stampRank(existing.stamp) > stampRank(stored.stamp)) return
    cache.set(path, stored)
    dirty = true
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

export function parseSessionTranscriptIndexDocument(raw: unknown): PersistedSessionRecord[] {
  if (!raw || typeof raw !== 'object') return []
  const doc = raw as Partial<SessionTranscriptIndexDocument>
  if (doc.version !== SESSION_TRANSCRIPT_INDEX_VERSION || !Array.isArray(doc.sessions)) return []
  return doc.sessions.filter(isPersistedSessionRecord)
}

export function serializeSessionTranscriptIndexDocument(
  records: PersistedSessionRecord[],
): SessionTranscriptIndexDocument {
  return {
    version: SESSION_TRANSCRIPT_INDEX_VERSION,
    sessions: records.filter(isPersistedSessionRecord),
  }
}

function isPersistedSessionRecord(value: unknown): value is PersistedSessionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<PersistedSessionRecord>
  if (typeof record.path !== 'string' || record.path.length === 0) return false
  if (typeof record.stamp !== 'string') return false
  if (typeof record.id !== 'string') return false
  if (typeof record.title !== 'string') return false
  if (!Array.isArray(record.turns)) return false
  return record.turns.every(isIndexedTranscriptTurn)
}

function isIndexedTranscriptTurn(value: unknown): value is IndexedTranscriptTurn {
  if (!value || typeof value !== 'object') return false
  const turn = value as Partial<IndexedTranscriptTurn>
  return (
    typeof turn.messageIndex === 'number'
    && Number.isFinite(turn.messageIndex)
    && (turn.role === 'user' || turn.role === 'assistant')
    && typeof turn.text === 'string'
  )
}

function searchableTurns(items: PrimeTranscriptItem[]): IndexedTranscriptTurn[] {
  const turns: IndexedTranscriptTurn[] = []
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
