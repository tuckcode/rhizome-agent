import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '../lib/telemetry'
import type { AppLocale } from '../lib/i18n'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { startResizeDrag } from '../utils/startResizeDrag'
import { SessionActivityHistory, type SessionActivityRetainedState } from './SessionActivityHistory'
import type { GraphViewRetainedState } from './graph/GraphView'
import {
  NOTES_CHROME_EVENT,
  consumePendingConnectionsView,
  type ConnectionsChromeView,
  type NotesChromeDestination,
} from '../lib/notesChrome'
const GraphView = lazy(() => import('./graph/GraphView'))
type View = 'graph' | 'mycelium'
type Placement = 'sidebar' | 'full' | 'off'
export interface ConnectionsPanelHandle {
  /** Opens the given view, focusing a specific Mycelium session when asked. */
  openView: (view: View, options?: { focusPath?: string }) => void
}
export interface ConnectionsViewRequest {
  view: View
  focusPath?: string
  requestId: number
}
const STORAGE_KEY = 'rhizome:connections-placement:v1'
function readPlacements(): Record<View, Placement> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const placement = (v: unknown): Placement => v === 'full' || v === 'off' ? v : 'sidebar'
    return { graph: placement(value?.graph), mycelium: placement(value?.mycelium) }
  } catch { return { graph: 'sidebar', mycelium: 'sidebar' } }
}
/**
 * Graph and Mycelium sit under Notes on the Changes tab. Height is the
 * thing you drag — Notes stays the heavy half, this is the bottom quarter
 * to half. Inbox keeps the full notes list (no graph chrome).
 */
export const ConnectionsPanel = forwardRef<ConnectionsPanelHandle, {
  vaultPath: string
  locale?: AppLocale
  onOpenNote?: (path: string) => void
  /** Whether the opener can actually resolve a path, asked before offering it. */
  canOpenNote?: (path: string) => boolean
  /** Opens a view after mount, used when Inbox was closed at the moment of the request. */
  requestedView?: ConnectionsViewRequest | null
}>(function ConnectionsPanel({ vaultPath, locale = 'en', onOpenNote, canOpenNote, requestedView }, ref) {
  const [placements, setPlacements] = useState(readPlacements)
  const [view, setView] = useState<View>(() => requestedView?.view ?? 'graph')
  const [expanded, setExpanded] = useState(false)
  const [graphState, setGraphState] = useState<GraphViewRetainedState>({ selectedId: null, egoRootId: null, query: '', hiddenTypes: [], hideGhosts: false })
  const [myceliumState, setMyceliumState] = useState<SessionActivityRetainedState>(() => ({
    path: requestedView?.view === 'mycelium' ? requestedView.focusPath ?? '' : '',
    selected: null,
    scrollTop: 0,
  }))
  // Bumped on every external focus request so SessionActivityHistory remounts
  // with the new session path — its own `path` state only reads the retained
  // value once, on mount.
  const [myceliumFocusToken, setMyceliumFocusToken] = useState(0)
  const [seenRequestId, setSeenRequestId] = useState<number | null>(
    () => requestedView?.requestId ?? null,
  )
  const height = usePanelWidth(APP_STORAGE_KEYS.connectionsPanelHeight, 280, 140, 560)
  const available = (['graph', 'mycelium'] as const).filter(v => placements[v] !== 'off')
  const selected = available.includes(view) ? view : available[0]
  const full = Boolean(selected) && (expanded || placements[selected] === 'full')
  function changePlacement(target: View, placement: Placement) {
    const next = { ...placements, [target]: placement }
    setPlacements(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* In-memory preferences still work. */ }
    trackEvent('connections_placement_changed', { view: target, placement })
  }
  function select(target: View) {
    setView(target)
    trackEvent('connections_view_selected', { view: target })
  }
  function applyRequest(target: View, options?: { focusPath?: string }) {
    if (placements[target] === 'off') changePlacement(target, 'sidebar')
    select(target)
    if (target === 'mycelium' && options?.focusPath) {
      setMyceliumState({ path: options.focusPath, selected: null, scrollTop: 0 })
      setMyceliumFocusToken(token => token + 1)
    }
  }
  const applyRequestRef = useRef(applyRequest)
  useEffect(() => {
    applyRequestRef.current = applyRequest
  })
  useEffect(() => {
    const pending = consumePendingConnectionsView()
    if (pending) applyRequestRef.current(pending)
    const onChrome = (event: Event) => {
      const destination = (event as CustomEvent<NotesChromeDestination>).detail
      if (destination === 'graph' || destination === 'mycelium') {
        applyRequestRef.current(destination as ConnectionsChromeView)
      }
    }
    window.addEventListener(NOTES_CHROME_EVENT, onChrome)
    return () => window.removeEventListener(NOTES_CHROME_EVENT, onChrome)
  }, [])
  // Both views open notes the same way: hand the path up, then get out of the
  // editor's way. Overlay collapses; the docked sub-panel stays so Notes and
  // Graph are still both there after you open a file.
  function openNote(path: string) {
    onOpenNote?.(path)
    setExpanded(false)
  }
  useImperativeHandle(ref, () => ({
    openView(target, options) {
      applyRequest(target, options)
    },
  }))
  if (requestedView && requestedView.requestId !== seenRequestId) {
    setSeenRequestId(requestedView.requestId)
    setView(requestedView.view)
    if (requestedView.view === 'mycelium' && requestedView.focusPath) {
      setMyceliumState({ path: requestedView.focusPath, selected: null, scrollTop: 0 })
      setMyceliumFocusToken(token => token + 1)
    }
  }
  return <section
    className="relative flex min-h-0 shrink-0 flex-col border-t border-border bg-background"
    style={{ height: full ? undefined : height.width, maxHeight: full ? undefined : '50%' }}
    aria-label="Connections"
  >
    {/* Top-edge handle: dragging up (negative deltaY) grows the panel, which
        matches `usePanelWidth.resizeBy` ("negative delta means growth"). */}
    {!full && <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize graph"
      className="absolute inset-x-0 -top-[10px] z-20 h-4 cursor-row-resize bg-transparent transition-colors hover:bg-border"
      onMouseDown={event => startResizeDrag(event, 'row-resize', (_deltaX, deltaY) => height.resizeBy(deltaY))}
    />}
    <div data-testid="connections-panel" data-expanded={full ? 'true' : 'false'} className={full ? 'fixed inset-4 top-10 z-40 flex min-h-0 flex-col overflow-hidden rounded border border-border bg-background shadow-lg' : 'flex min-h-0 flex-1 flex-col overflow-hidden'}>
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-1">
        <div role="tablist" aria-label="Connection views" className="flex min-w-0 flex-1">
          {available.map(target => <button type="button" role="tab" aria-selected={selected === target} key={target} className={`min-h-8 px-2 text-xs ${selected === target ? 'bg-muted text-foreground' : 'text-muted-foreground'}`} onClick={() => select(target)}>{target === 'graph' ? 'Graph' : 'Mycelium'}</button>)}
        </div>
        {selected && <Button type="button" variant="ghost" size="icon-xs" className="p-2 text-muted-foreground" aria-label={full ? 'Return to side panel' : 'Expand connections'} onClick={() => {
          setExpanded(!full)
          trackEvent('connections_expanded', { expanded: full ? 0 : 1 })
        }}>{full ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}</Button>}
      </div>
      {!selected && <div className="space-y-2 p-3">
        <p className="text-xs text-muted-foreground">Enable a view in Connections settings.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => applyRequest('graph')}>Enable Graph</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => applyRequest('mycelium')}>Enable Mycelium</Button>
        </div>
      </div>}
      {selected && <div
        role="tabpanel"
        className="flex min-h-0 flex-1 overflow-hidden isolate"
        style={{ clipPath: 'inset(0)' }}
      >
        <Suspense fallback={<p className="p-3 text-xs">Loading connections…</p>}>
          {selected === 'graph'
            ? <GraphView vaultPath={vaultPath} locale={locale} compact={!full} onOpenNote={openNote} retainedState={graphState} onRetainedStateChange={setGraphState} />
            : <SessionActivityHistory key={myceliumFocusToken} expanded={full} locale={locale} vaultPath={vaultPath} canOpenNote={canOpenNote} onOpenNote={onOpenNote ? openNote : undefined} retainedState={myceliumState} onRetainedStateChange={setMyceliumState} />}
        </Suspense>
      </div>}
    </div>
  </section>
})
