import { forwardRef, lazy, Suspense, useImperativeHandle, useState } from 'react'
import { ArrowsIn, ArrowsOut, CaretRight, DotsThree, X } from '@phosphor-icons/react'
import { trackEvent } from '../lib/telemetry'
import type { AppLocale } from '../lib/i18n'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { startResizeDrag } from '../utils/startResizeDrag'
import { SessionActivityHistory, type SessionActivityRetainedState } from './SessionActivityHistory'
import type { GraphViewRetainedState } from './graph/GraphView'
const GraphView = lazy(() => import('./graph/GraphView'))
type View = 'graph' | 'mycelium'
type Placement = 'sidebar' | 'full' | 'off'
export interface ConnectionsPanelHandle {
  /** Opens the given view, focusing a specific Mycelium session when asked. */
  openView: (view: View, options?: { focusPath?: string }) => void
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
 * Connections docks on the right, opposite the rail, so the left column stays
 * for navigation. Closed it is a one-word edge strip; open it is a resizable
 * column with room for a graph and an activity list side by side.
 */
export const ConnectionsPanel = forwardRef<ConnectionsPanelHandle, {
  vaultPath: string
  locale?: AppLocale
  onOpenNote?: (path: string) => void
  /** Whether the opener can actually resolve a path, asked before offering it. */
  canOpenNote?: (path: string) => boolean
}>(function ConnectionsPanel({ vaultPath, locale = 'en', onOpenNote, canOpenNote }, ref) {
  const [placements, setPlacements] = useState(readPlacements)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('graph')
  const [expanded, setExpanded] = useState(false)
  const [graphState, setGraphState] = useState<GraphViewRetainedState>({ selectedId: null, egoRootId: null, query: '', hiddenTypes: [], hideGhosts: false })
  const [myceliumState, setMyceliumState] = useState<SessionActivityRetainedState>({ path: '', selected: null, scrollTop: 0 })
  // Bumped on every external focus request so SessionActivityHistory remounts
  // with the new session path — its own `path` state only reads the retained
  // value once, on mount.
  const [myceliumFocusToken, setMyceliumFocusToken] = useState(0)
  const width = usePanelWidth(APP_STORAGE_KEYS.connectionsPanelWidth, 420, 300, 900)
  const available = (['graph', 'mycelium'] as const).filter(v => placements[v] !== 'off')
  const selected = available.includes(view) ? view : available[0]
  const full = open && Boolean(selected) && (expanded || placements[selected] === 'full')
  function changePlacement(target: View, placement: Placement) {
    const next = { ...placements, [target]: placement }
    setPlacements(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* In-memory preferences still work. */ }
    trackEvent('connections_placement_changed', { view: target, placement })
  }
  function select(target: View) {
    setView(target)
    setOpen(true)
    trackEvent('connections_view_selected', { view: target })
  }
  // Both views open notes the same way: hand the path up, then get out of the
  // editor's way. Without the shared handler an expanded Mycelium stayed over
  // the file it had just opened.
  function openNote(path: string) {
    onOpenNote?.(path)
    setExpanded(false)
    if (full) setOpen(false)
  }
  useImperativeHandle(ref, () => ({
    openView(target, options) {
      select(target)
      if (target === 'mycelium' && options?.focusPath) {
        setMyceliumState({ path: options.focusPath, selected: null, scrollTop: 0 })
        setMyceliumFocusToken(token => token + 1)
      }
    },
  }))
  if (!open) return <button
    type="button"
    aria-expanded="false"
    data-testid="connections-edge"
    className="flex w-7 shrink-0 cursor-pointer items-center justify-center border-l border-border bg-background text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    style={{ writingMode: 'vertical-rl' }}
    onClick={() => setOpen(true)}
  >Connections</button>
  return <section
    className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
    style={{ width: width.width }}
    aria-label="Connections"
  >
    {/* `resizeBy` already assumes a handle on the panel's left edge, which is
        where this one is, so it takes the raw delta. Negating first cancels
        that out and inverts the drag. */}
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize connections"
      className="absolute inset-y-0 -left-[10px] z-20 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-border"
      onMouseDown={event => startResizeDrag(event, 'col-resize', deltaX => width.resizeBy(deltaX))}
    />
    <div className="flex shrink-0 items-center">
      <button type="button" className="flex min-h-8 min-w-0 flex-1 items-center gap-1 px-2 text-left text-xs" aria-expanded onClick={() => setOpen(false)}>
        <CaretRight size={14} /> Connections
      </button>
      <details className="relative">
        <summary aria-label="Connections settings" className="cursor-pointer px-2 py-2 text-xs"><DotsThree size={16} aria-hidden="true" /><span className="sr-only">Connections settings</span></summary>
        <div className="absolute right-0 z-50 w-56 space-y-3 rounded border border-border bg-background p-3 text-xs shadow-md">
          {(['graph', 'mycelium'] as const).map(target => <label className="flex flex-col gap-1" key={target}>
            {target === 'graph' ? 'Graph' : 'Mycelium'} placement
            <select aria-label={`${target === 'graph' ? 'Graph' : 'Mycelium'} placement`} className="rounded border border-border bg-background p-1" value={placements[target]} onChange={e => changePlacement(target, e.target.value as Placement)}>
              <option value="sidebar">Side panel</option><option value="full">Full view only</option><option value="off">Off</option>
            </select>
          </label>)}
        </div>
      </details>
    </div>
    <div data-testid="connections-panel" data-expanded={full ? 'true' : 'false'} className={full ? 'fixed inset-4 top-10 z-40 flex min-h-0 flex-col rounded border border-border bg-background shadow-lg' : 'flex min-h-0 flex-1 flex-col border-t border-border'}>
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-1 py-1">
        <div role="tablist" aria-label="Connection views" className="flex min-w-0 flex-1">
          {available.map(target => <button type="button" role="tab" aria-selected={selected === target} key={target} className={`min-h-8 px-2 text-xs ${selected === target ? 'bg-muted text-foreground' : 'text-muted-foreground'}`} onClick={() => select(target)}>{target === 'graph' ? 'Graph' : 'Mycelium'}</button>)}
        </div>
        {selected && <button type="button" className="p-2" aria-label={full ? 'Return to side panel' : 'Expand connections'} onClick={() => {
          if (full && placements[selected] === 'full') setOpen(false)
          setExpanded(!full)
          trackEvent('connections_expanded', { expanded: full ? 0 : 1 })
        }}>{full ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}</button>}
        <button type="button" className="p-2" aria-label="Close connections" onClick={() => { setOpen(false); setExpanded(false) }}><X size={14} /></button>
      </div>
      {!selected && <p className="p-3 text-xs text-muted-foreground">Enable a view in Connections settings.</p>}
      {selected && <div
        role="tabpanel"
        className="flex min-h-0 flex-1 overflow-hidden"
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
