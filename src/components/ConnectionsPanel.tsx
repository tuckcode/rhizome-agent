import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { trackEvent } from '../lib/telemetry'
import type { AppLocale } from '../lib/i18n'
import { SessionActivityHistory, type SessionActivityRetainedState } from './SessionActivityHistory'
import type { GraphViewRetainedState } from './graph/GraphView'
import {
  CONNECTIONS_OPEN_EVENT,
  NOTES_CHROME_EVENT,
  consumePendingConnectionsFocus,
  type ConnectionsOpenDetail,
  consumePendingConnectionsView,
  type ConnectionsChromeView,
  type NotesChromeDestination,
} from '../lib/notesChrome'
import { PeerToolExitButton } from './PeerToolExitButton'
import { PEER_TOOL_EXIT_NOTES } from '../lib/peerToolExit'
const GraphView = lazy(() => import('./graph/GraphView'))
export type ConnectionsView = 'graph' | 'mycelium'
export interface ConnectionsPanelHandle {
  /** Opens the given view, focusing a specific Mycelium session when asked. */
  openView: (view: ConnectionsView, options?: { focusPath?: string }) => void
}
export interface ConnectionsViewRequest {
  view: ConnectionsView
  focusPath?: string
  requestId: number
}
/**
 * Graph and Mycelium stay closed until an icon or a context menu opens them.
 * They open over the workspace. They do not take a share of the Notes column.
 */
export const ConnectionsPanel = forwardRef<ConnectionsPanelHandle, {
  vaultPath: string
  locale?: AppLocale
  onOpenNote?: (path: string) => void
  /** Whether the opener can actually resolve a path, asked before offering it. */
  canOpenNote?: (path: string) => boolean
  /** Opens a view after mount, used when Inbox was closed at the moment of the request. */
  requestedView?: ConnectionsViewRequest | null
  exitLabel?: string
}>(function ConnectionsPanel({
  vaultPath,
  locale = 'en',
  onOpenNote,
  canOpenNote,
  requestedView,
  exitLabel = PEER_TOOL_EXIT_NOTES,
}, ref) {
  const [view, setView] = useState<ConnectionsView>(() => requestedView?.view ?? 'graph')
  const [presented, setPresented] = useState(() => requestedView != null)
  const [graphFocusToken, setGraphFocusToken] = useState(0)
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
  const available: ConnectionsView[] = ['graph', 'mycelium']
  const selected = available.includes(view) ? view : available[0]
  function select(target: ConnectionsView) {
    setView(target)
    trackEvent('connections_view_selected', { view: target })
  }
  function applyRequest(target: ConnectionsView, options?: { focusPath?: string }) {
    select(target)
    setPresented(true)
    if (target === 'mycelium' && options?.focusPath) {
      setMyceliumState({ path: options.focusPath, selected: null, scrollTop: 0 })
      setMyceliumFocusToken(token => token + 1)
    }
    if (target === 'graph' && options?.focusPath) {
      setGraphState(state => ({ ...state, selectedId: options.focusPath ?? null, egoRootId: options.focusPath ?? null }))
      setGraphFocusToken(token => token + 1)
    }
  }
  const applyRequestRef = useRef(applyRequest)
  useEffect(() => {
    applyRequestRef.current = applyRequest
  })
  useEffect(() => {
    const pending = consumePendingConnectionsView()
    const pendingFocus = consumePendingConnectionsFocus()
    if (pending) applyRequestRef.current(pending, pendingFocus ? { focusPath: pendingFocus } : undefined)
    const onChrome = (event: Event) => {
      const destination = (event as CustomEvent<NotesChromeDestination>).detail
      if (destination === 'graph' || destination === 'mycelium') {
        consumePendingConnectionsView()
        const focusPath = consumePendingConnectionsFocus()
        applyRequestRef.current(destination as ConnectionsChromeView, focusPath ? { focusPath } : undefined)
      }
    }
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ConnectionsOpenDetail>).detail
      if (detail?.view === 'graph' || detail?.view === 'mycelium') {
        applyRequestRef.current(detail.view, detail.focusPath ? { focusPath: detail.focusPath } : undefined)
      }
    }
    window.addEventListener(NOTES_CHROME_EVENT, onChrome)
    window.addEventListener(CONNECTIONS_OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener(NOTES_CHROME_EVENT, onChrome)
      window.removeEventListener(CONNECTIONS_OPEN_EVENT, onOpen)
    }
  }, [])
  function closePanel() {
    setPresented(false)
  }
  function openNote(path: string) {
    onOpenNote?.(path)
    closePanel()
  }
  useImperativeHandle(ref, () => ({
    openView(target, options) {
      applyRequest(target, options)
    },
  }))
  if (requestedView && requestedView.requestId !== seenRequestId) {
    setSeenRequestId(requestedView.requestId)
    setView(requestedView.view)
    setPresented(true)
    if (requestedView.view === 'mycelium' && requestedView.focusPath) {
      setMyceliumState({ path: requestedView.focusPath, selected: null, scrollTop: 0 })
      setMyceliumFocusToken(token => token + 1)
    }
  }
  if (!presented || !selected) return null
  return <div
    data-testid="connections-panel"
    data-expanded="true"
    role="region"
    aria-label="Connections"
    className="fixed inset-4 top-10 z-40 flex min-h-0 flex-col overflow-hidden rounded border border-border bg-background shadow-lg"
  >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-1">
        <div role="tablist" aria-label="Connection views" className="flex min-w-0 flex-1">
          {available.map(target => <button type="button" role="tab" aria-selected={selected === target} key={target} className={`min-h-8 px-2 text-xs ${selected === target ? 'bg-muted text-foreground' : 'text-muted-foreground'}`} onClick={() => select(target)}>{target === 'graph' ? 'Graph' : 'Mycelium'}</button>)}
        </div>
        <PeerToolExitButton label={exitLabel} onClick={closePanel} testId="connections-exit" />
      </div>
      <div
        role="tabpanel"
        className="flex min-h-0 flex-1 overflow-hidden isolate"
        style={{ clipPath: 'inset(0)' }}
      >
        <Suspense fallback={<p className="p-3 text-xs">Loading connections…</p>}>
          {selected === 'graph'
            ? <GraphView key={graphFocusToken} vaultPath={vaultPath} locale={locale} onOpenNote={openNote} retainedState={graphState} onRetainedStateChange={setGraphState} exitLabel={exitLabel} />
            : <SessionActivityHistory key={myceliumFocusToken} expanded locale={locale} vaultPath={vaultPath} canOpenNote={canOpenNote} onOpenNote={onOpenNote ? openNote : undefined} retainedState={myceliumState} onRetainedStateChange={setMyceliumState} />}
        </Suspense>
      </div>
  </div>
})
