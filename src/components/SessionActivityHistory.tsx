import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import { compactSessionFacts, readableSessionLabel } from '../lib/myceliumCompactSummary'
import type { PrimeTranscriptItem, PrimeTranscriptTool } from '../lib/primeTranscriptToConversation'
import type { AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { visibleUserText } from '../utils/ai-chat'
const MyceliumView = lazy(() => import('./MyceliumView'))
interface Session { path: string; name: string }
export interface SessionActivityRetainedState { path: string; selected: number | null; scrollTop: number }
const NOTE_SUFFIXES = ['.md', '.markdown', '.canvas']
/**
 * Session history is global: it records coding files and other vaults too, and
 * the only opener wired to this panel resolves entries in the current vault.
 * So the action is offered for the paths that opener can actually resolve —
 * a note inside this vault, named absolutely or relative to it.
 */
function isOpenableInVault(path: string | undefined, vaultPath: string | undefined): path is string {
  if (!path || !NOTE_SUFFIXES.some(suffix => path.toLowerCase().endsWith(suffix))) return false
  if (path.startsWith('/')) return Boolean(vaultPath) && path.startsWith(`${vaultPath}/`)
  return !path.split('/').includes('..')
}
export function SessionActivityHistory({ expanded, locale, vaultPath, canOpenNote, onOpenNote, retainedState, onRetainedStateChange }: {
  expanded: boolean
  locale: AppLocale
  vaultPath?: string
  /** The host's own check that a path resolves to a note it can open. */
  canOpenNote?: (path: string) => boolean
  onOpenNote?: (path: string) => void
  /** Small selection state retained while the sidecar and its iframe are stopped. */
  retainedState?: SessionActivityRetainedState
  onRetainedStateChange?: (state: SessionActivityRetainedState) => void
}) {
  function openable(path: string | undefined): path is string {
    if (!isOpenableInVault(path, vaultPath) || !onOpenNote) return false
    return canOpenNote ? canOpenNote(path) : true
  }
  const [sessions, setSessions] = useState<Session[]>([])
  const [path, setPath] = useState(() => retainedState?.path ?? '')
  const [items, setItems] = useState<PrimeTranscriptItem[]>([])
  const [selected, setSelected] = useState<number | null>(() => retainedState?.selected ?? null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const actionListRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(() => retainedState?.scrollTop ?? 0)

  useEffect(() => {
    onRetainedStateChange?.({ path, selected, scrollTop })
  }, [onRetainedStateChange, path, scrollTop, selected])

  useEffect(() => {
    if (actionListRef.current) actionListRef.current.scrollTop = scrollTop
  }, [scrollTop])
  useEffect(() => {
    let cancelled = false
    callHost<Session[]>('list_prime_sessions').then(value => {
      if (cancelled) return
      setSessions(value)
      setPath(previous => previous || value[0]?.path || '')
      if (!value.length) setLoading(false)
    }).catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [revision])
  useEffect(() => {
    if (!path) return
    let cancelled = false
    callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', { path }).then(value => {
      if (!cancelled) { setItems(value); setLoading(false) }
    }).catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [path, revision])
  const actions: { tool: PrimeTranscriptTool; prompt: string }[] = []
  let prompt = ''
  for (const item of items) {
    if (item.kind !== 'message') continue
    if (item.message.role === 'user') prompt = visibleUserText(item.message.text)
    for (const tool of item.tools ?? []) actions.push({ tool, prompt })
  }
  const touchedPaths = [...new Set(actions.map(a => a.tool.path).filter((p): p is string => Boolean(p)))]
  const selectedPath = selected === null ? undefined : actions[selected]?.tool.path
  const currentName = sessions.find(session => session.path === path)?.name ?? path
  const facts = compactSessionFacts(actions.map(action => action.tool.path))
  const toolLabel = facts.toolCount === 1 ? '1 tool' : `${facts.toolCount} tools`
  const fileLabel = facts.fileCount === 1 ? '1 file' : `${facts.fileCount} files`
  const filePreview = facts.fileNames.slice(0, 4).join(', ')
  const extraFiles = facts.fileNames.length > 4 ? ` +${facts.fileNames.length - 4}` : ''
  return <div className={`flex min-h-0 min-w-0 flex-1 ${expanded ? 'flex-row' : 'flex-col'}`}>
    <div className={`flex min-h-0 flex-col ${expanded ? 'w-80 shrink-0 border-r border-border' : 'flex-1'}`}>
      <div className="flex shrink-0 gap-1 p-2">
        <select aria-label="Activity session" className="min-w-0 flex-1 rounded border border-border bg-background p-1 text-xs" value={path} onChange={e => { setPath(e.target.value); setItems([]); setSelected(null); setError(''); setLoading(true) }}>
          {!sessions.length && <option value="">No saved sessions</option>}
          {sessions.map(s => <option key={s.path} value={s.path}>{readableSessionLabel(s.name, s.name)}</option>)}
        </select>
        <button type="button" className="px-1 text-xs" onClick={() => { setError(''); setLoading(true); setRevision(v => v + 1) }}>Refresh</button>
      </div>
      {!expanded ? <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="mycelium-compact-summary">
        {error ? <p role="alert" className="text-xs">Could not load activity: {error}</p> : loading ? <p className="text-xs">Loading session…</p> : <>
          <p className="text-sm font-medium text-foreground" data-testid="mycelium-compact-title">{readableSessionLabel(currentName)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{toolLabel} · {fileLabel}</p>
          {facts.fileNames.length > 0 ? <p className="mt-2 truncate text-xs text-muted-foreground">{filePreview}{extraFiles}</p> : <p className="mt-2 text-xs text-muted-foreground">No recorded tool actions in this session.</p>}
          <p className="mt-3 text-[11px] text-muted-foreground">Expand to open the city for this session.</p>
        </>}
      </div> : <div ref={actionListRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
        {error ? <p role="alert" className="p-3 text-xs">Could not load activity: {error}</p> : loading ? <p className="p-3 text-xs">Loading actions…</p> : !actions.length ? <p className="p-3 text-xs text-muted-foreground">No recorded tool actions in this session.</p> : <ol className="divide-y divide-border">
          {actions.map(({ tool, prompt: request }, index) => {
            const openPath = openable(tool.path) ? tool.path : ''
            return <li key={`${tool.id ?? tool.tool}-${index}`}>
              <button type="button" aria-expanded={selected === index} className="w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { setSelected(selected === index ? null : index); trackEvent('connections_action_selected', { tool: tool.tool }) }}>
                <span className="block font-medium">{index + 1}. {tool.tool}</span>
                {tool.path && <span className="block truncate text-muted-foreground">{tool.path}</span>}
              </button>
              {selected === index && <div className="space-y-2 bg-muted px-3 pb-3 text-xs">
                {request && <p className="whitespace-pre-wrap break-words">{request}</p>}
                {tool.detail && <pre className="whitespace-pre-wrap break-words font-mono">{tool.detail}</pre>}
                {tool.path && <p className="break-all">{tool.path}</p>}
                {openPath
                  ? <button type="button" className="underline" onClick={() => onOpenNote?.(openPath)}>Open file</button>
                  : tool.path && <p className="text-muted-foreground">Outside this vault — not openable here.</p>}
              </div>}
            </li>
          })}
        </ol>}
      </div>}
    </div>
    {expanded && path && <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {touchedPaths.length > 0 && <div className="shrink-0 border-b border-border p-2" data-testid="touched-files">
        <p className="pb-1 text-[11px] text-muted-foreground">{selectedPath ? `Touched by step ${(selected ?? 0) + 1}` : 'Files and notes this session touched'}</p>
        <ul className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {touchedPaths.map(touched => {
            const active = touched === selectedPath
            const canOpen = openable(touched)
            return <li key={touched}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                disabled={!canOpen}
                className={`max-w-[16rem] truncate rounded border px-2 py-1 text-[11px] ${active ? 'border-foreground bg-muted font-medium text-foreground' : 'border-border text-muted-foreground'} ${canOpen ? 'hover:bg-muted' : 'cursor-default'}`}
                onClick={() => { if (canOpen && onOpenNote) onOpenNote(touched) }}
              >{touched.split('/').pop()}</button>
            </li>
          })}
        </ul>
      </div>}
      <Suspense fallback={<p className="p-3 text-xs">Loading Mycelium…</p>}><MyceliumView locale={locale} focusSessionPath={path} /></Suspense>
    </div>}
  </div>
}
