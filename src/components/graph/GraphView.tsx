import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { X } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../../mock-tauri'
import { translate, type AppLocale, DEFAULT_APP_LOCALE } from '../../lib/i18n'
import { trackEvent } from '../../lib/telemetry'
import { useRhizomeJobs } from '../../hooks/useRhizomeJobs'
import { useGraphKeyboardNav } from '../../hooks/useGraphKeyboardNav'
import { useLayoutPanels } from '../../hooks/useLayoutPanels'
import { ResizeHandle } from '../ResizeHandle'
import {
  buildAdjacency,
  countGhosts,
  egoSubgraph,
  filterGraph,
  findNode,
  nodeTypesIn,
  parseGraphResponse,
} from './graphData'
import { createTypeColorResolver } from './typeColorResolver'
import { createEdgeColorResolver } from './edgeColorResolver'
import { ForceGraph3DCanvas, type ForceGraphHandle } from './ForceGraph3DCanvas'
import { GraphControls } from './GraphControls'
import { GraphLegend } from './GraphLegend'
import { NodePreviewPanel } from './NodePreviewPanel'
import type { GraphEdgeKind, WikiGraphData, WikiGraphNode } from './graphTypes'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

export interface GraphViewProps {
  vaultPath: string
  onOpenNote?: (relativePath: string) => void
  refreshKey?: number
  locale?: AppLocale
  /** Leave the graph and return to the previous view. Without this the graph
   *  is a one-way trip: Escape only cleared selection and there was no close
   *  control, so the only way out was re-clicking the rail/status-bar toggle. */
  onExit?: () => void
}

/**
 * Top-level wiki graph view (GalaxyBrain-style 3D force layout).
 * Owns fetch/selection/ego state and telemetry; rendering lives in the
 * WebGL-only ForceGraph3DCanvas, preview in NodePreviewPanel.
 */
export function GraphView({
  vaultPath,
  onOpenNote,
  refreshKey = 0,
  locale = DEFAULT_APP_LOCALE,
  onExit,
}: GraphViewProps) {
  const [data, setData] = useState<WikiGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [egoRootId, setEgoRootId] = useState<string | null>(null)
  const [creatingIds, setCreatingIds] = useState<ReadonlySet<string>>(new Set())
  const [query, setQuery] = useState('')
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set())
  const [hideGhosts, setHideGhosts] = useState(false)
  const [colorVersion, setColorVersion] = useState(0)
  const canvasRef = useRef<ForceGraphHandle | null>(null)
  const { startJob } = useRhizomeJobs()
  const { graphPreviewWidth, handleGraphPreviewResize } = useLayoutPanels()

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
      translate(locale, key, values),
    [locale],
  )

  const fetchIdRef = useRef(0)
  const loadGraph = useCallback(async () => {
    const requestId = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    try {
      const json = await tauriCall<string>('call_rhizome_tool', {
        name: 'rhizome_wiki_graph',
        args: { vaultPath },
      })
      if (fetchIdRef.current !== requestId) return
      const parsed = parseGraphResponse(json)
      setData(parsed)
      trackEvent('graph_view_opened', {
        nodeCount: parsed.nodes.length,
        edgeCount: parsed.edges.length,
        ghostCount: countGhosts(parsed),
      })
    } catch (err) {
      if (fetchIdRef.current !== requestId) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fetchIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [vaultPath])

  useEffect(() => {
    loadGraph()
  }, [loadGraph, refreshKey])

  const resolver = useMemo(() => createTypeColorResolver(), [])
  const edgeResolver = useMemo(() => createEdgeColorResolver(), [])
  useEffect(() => {
    const observer = new MutationObserver(() => {
      resolver.invalidate()
      edgeResolver.invalidate()
      setColorVersion((v) => v + 1)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-theme', 'data-accent', 'class'],
    })
    return () => observer.disconnect()
  }, [resolver, edgeResolver])

  const adjacency = useMemo(
    () => (data ? buildAdjacency(data) : new Map<string, Set<string>>()),
    [data],
  )
  // Ego view narrows first, then user filters apply on top — so filtering
  // inside a local graph stays scoped to that neighbourhood rather than
  // silently escaping back to the whole vault.
  const scopedData = useMemo(() => {
    if (!data) return null
    return egoRootId ? egoSubgraph(data, egoRootId) : data
  }, [data, egoRootId])

  const displayData = useMemo(() => {
    if (!scopedData) return null
    return filterGraph(scopedData, { query, hiddenTypes, hideGhosts })
  }, [scopedData, query, hiddenTypes, hideGhosts])

  const availableTypes = useMemo(
    () => (scopedData ? nodeTypesIn(scopedData) : []),
    [scopedData],
  )

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const selectedNode = data ? findNode(data, selectedId) : null

  // Titles of projects the selected node belongs to (belongs_to edges).
  const selectedProjects = useMemo(() => {
    if (!data || !selectedId) return []
    return data.edges
      .filter((e) => e.source === selectedId && e.kind === 'belongs_to')
      .map((e) => findNode(data, e.target)?.title)
      .filter((title): title is string => Boolean(title))
  }, [data, selectedId])

  const openNote = useCallback(
    (path: string) => {
      trackEvent('graph_node_opened', {})
      onOpenNote?.(path)
    },
    [onOpenNote],
  )

  const selectNode = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const toggleEgo = useCallback(() => {
    setEgoRootId((current) => (current ? null : selectedId))
  }, [selectedId])

  const handleEscape = useCallback(() => {
    // Progressive escape: narrow context first, then leave the view entirely.
    // Exiting last means Escape never destroys an ego view or selection the
    // user still wanted, but still gets them out when there's nothing to clear.
    if (egoRootId) {
      setEgoRootId(null)
    } else if (selectedId) {
      setSelectedId(null)
    } else {
      onExit?.()
    }
  }, [egoRootId, selectedId, onExit])

  const createGhostNote = useCallback(
    (title: string) => {
      const ghostId = selectedId
      if (!ghostId) return
      trackEvent('graph_ghost_create_fired', {})
      setCreatingIds((prev) => new Set(prev).add(ghostId))
      void startJob(
        'rhizome_distill',
        { vaultPath, text: title },
        `${t('graph.createNote')} → ${title}`,
      ).finally(() => {
        setCreatingIds((prev) => {
          const next = new Set(prev)
          next.delete(ghostId)
          return next
        })
      })
    },
    [selectedId, startJob, vaultPath, t],
  )

  useGraphKeyboardNav({
    enabled: true,
    adjacency,
    focusedId: selectedId,
    getPositions: () => canvasRef.current?.getScreenPositions() ?? new Map(),
    onFocus: (id) => {
      setSelectedId(id)
      canvasRef.current?.flyToNode(id)
    },
    onOpen: (id) => {
      const node = data ? findNode(data, id) : null
      if (node?.path) openNote(node.path)
    },
    onEscape: handleEscape,
  })

  const colorForNode = useCallback(
    (node: WikiGraphNode) => resolver.colorFor(node.isA, node.ghost),
    [resolver],
  )

  const colorForEdge = useCallback(
    (edge: { kind: GraphEdgeKind }) => edgeResolver.colorFor(edge.kind),
    [edgeResolver],
  )

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground" data-testid="graph-error">
        {t('graph.error', { error })}
      </div>
    )
  }
  // displayData is derived from scopedData; either both exist or neither does.
  if (loading || !data || !scopedData || !displayData) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground" data-testid="graph-loading">
        {t('graph.loading')}
      </div>
    )
  }
  if (data.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground" data-testid="graph-empty">
        {t('graph.empty')}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full min-h-0 bg-background" data-testid="graph-view">
      <div className="relative min-w-0 flex-1">
        <ForceGraph3DCanvas
          ref={canvasRef}
          data={displayData}
          selectedId={selectedId}
          colorForNode={colorForNode}
          colorForEdge={colorForEdge}
          colorVersion={colorVersion}
          onNodeClick={selectNode}
          onBackgroundClick={() => setSelectedId(null)}
          onError={(err) => setError(err instanceof Error ? err.message : String(err))}
        />
        <GraphControls
          query={query}
          onQueryChange={setQuery}
          types={availableTypes}
          hiddenTypes={hiddenTypes}
          onToggleType={toggleType}
          ghostCount={countGhosts(scopedData)}
          hideGhosts={hideGhosts}
          onToggleGhosts={() => setHideGhosts((v) => !v)}
          colorForType={(type) => resolver.colorFor(type || null, false)}
          visibleCount={displayData.nodes.length}
          totalCount={scopedData.nodes.length}
          locale={locale}
        />
        {displayData.nodes.length === 0 && (
          // Filters can empty the canvas. Without this the graph looks
          // broken rather than filtered, and the only way back is guessing
          // which control did it.
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
            data-testid="graph-no-matches"
          >
            {query
              ? t('graph.controls.noMatches', { query })
              : t('graph.controls.allFiltered')}
          </div>
        )}
        <GraphLegend
          data={displayData}
          ghostCount={countGhosts(displayData)}
          colorForNode={colorForNode}
          colorForEdge={colorForEdge}
          locale={locale}
        />
        {onExit && (
          <button
            type="button"
            data-testid="graph-exit"
            aria-label={t('graph.exit')}
            title={t('graph.exit')}
            onClick={onExit}
            className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-[var(--radius)] border px-2 py-1 text-[12px]"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-panel, var(--sidebar))',
              color: 'var(--muted-foreground)',
            }}
          >
            <X size={13} weight="regular" />
            {t('graph.exit')}
          </button>
        )}
      </div>
      {selectedNode && (
        <>
          <ResizeHandle onResize={handleGraphPreviewResize} />
          <div
            className="shrink-0 flex flex-col min-h-0 p-2"
            style={{ width: graphPreviewWidth, minWidth: 280, height: '100%' }}
            data-testid="graph-preview-dock"
          >
            <NodePreviewPanel
              node={selectedNode}
              projects={selectedProjects}
              egoActive={egoRootId !== null}
              nodeColor={colorForNode(selectedNode)}
              locale={locale}
              onOpenNote={openNote}
              onToggleEgo={toggleEgo}
              onCreateNote={createGhostNote}
              creating={creatingIds.has(selectedNode.id)}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default GraphView
