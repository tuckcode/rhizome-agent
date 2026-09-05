// The ONLY file that touches 3d-force-graph / three.js (WebGL). Keep it
// tiny and imperative — everything testable lives outside. Loaded lazily
// inside an effect so jsdom tests and the main bundle never see three.js.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react'
import type { ForceGraph3DInstance } from '3d-force-graph'
import type {
  GraphEdgeKind,
  NodeScreenPosition,
  WikiGraphData,
  WikiGraphNode,
} from './graphTypes'
import { toGraphData } from './graphData'
import { clampedCameraPosition } from './cameraFraming'

export interface ForceGraphHandle {
  /** Animate the camera to look at a node. */
  flyToNode(id: string): void
  /** Current screen-projected node positions (for arrow-key stepping). */
  getScreenPositions(): Map<string, NodeScreenPosition>
}

export interface ForceGraph3DCanvasProps {
  data: WikiGraphData
  selectedId: string | null
  colorForNode: (node: WikiGraphNode) => string
  /** Colors a link by its `kind` (wikilink/belongs_to/related_to/relationship). */
  colorForEdge: (edge: GraphLinkObject) => string
  onNodeClick: (id: string) => void
  onBackgroundClick: () => void
  /** Bumped when the theme changes so node colors re-evaluate. */
  colorVersion?: number
  style?: CSSProperties
  /** Fired if the 3d-force-graph module fails to load or WebGL init throws —
   * without this the canvas fails completely silently (blank, no error). */
  onError?: (error: unknown) => void
}

type GraphNodeObject = WikiGraphNode & { x?: number; y?: number; z?: number }
// 3d-force-graph rewrites link.source/target from ids to node references
// once the simulation initializes; kind/field are untouched passthrough
// data from toGraphData(), which is all colorForEdge needs to read.
type GraphLinkObject = {
  kind: GraphEdgeKind
  field: string | null
  source?: string | GraphNodeObject
  target?: string | GraphNodeObject
}

export const ForceGraph3DCanvas = forwardRef<ForceGraphHandle, ForceGraph3DCanvasProps>(
  function ForceGraph3DCanvas(
    {
      data,
      selectedId,
      colorForNode,
      colorForEdge,
      onNodeClick,
      onBackgroundClick,
      colorVersion = 0,
      style,
      onError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const graphRef = useRef<ForceGraph3DInstance<GraphNodeObject> | null>(null)
    // zoomToFit frames the bounding box, and a one-node graph is a zero-size
    // box — left alone it flies the camera in until a single note fills the
    // canvas (C63). Runs after the fit, including its animated form.
    const framePreservingMinimumDistance = (
      graph: ForceGraph3DInstance<GraphNodeObject>,
      transitionMs: number,
    ) => {
      graph.zoomToFit(transitionMs, 60)
      window.setTimeout(() => {
        // The view can unmount mid-transition, and _destructor() has already
        // torn down the renderer by then — reading the camera off a destroyed
        // graph throws. graphRef is nulled on cleanup, so it is the liveness check.
        if (graphRef.current !== graph) return
        const clamped = clampedCameraPosition(graph.cameraPosition())
        if (clamped) graph.cameraPosition(clamped, undefined, 0)
      }, transitionMs)
    }
    const latest = useRef({ data, colorForNode, colorForEdge, onNodeClick, onBackgroundClick, selectedId, onError })
    latest.current = { data, colorForNode, colorForEdge, onNodeClick, onBackgroundClick, selectedId, onError }

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      let disposed = false
      let resizeObserver: ResizeObserver | null = null

      import('3d-force-graph')
        .then(({ default: ForceGraph3D }) => {
          if (disposed || !containerRef.current) return
          const graph = new ForceGraph3D(containerRef.current) as unknown as ForceGraph3DInstance<GraphNodeObject>
          graph
            .backgroundColor('rgba(0,0,0,0)')
            .showNavInfo(false)
            .nodeLabel((node) => (node as GraphNodeObject).title)
            .nodeVal((node) => {
              const n = node as GraphNodeObject
              return 1 + n.linkCount + n.backlinkCount
            })
            .nodeColor((node) => latest.current.colorForNode(node as GraphNodeObject))
            .nodeOpacity(0.9)
            // Defaults are near-invisible (thin, faint, untinted) — set
            // explicit width/opacity and color by kind so connection type
            // reads at a glance.
            .linkColor((link) => latest.current.colorForEdge(link as GraphLinkObject))
            .linkWidth(1.5)
            .linkOpacity(0.7)
            .onNodeClick((node) => latest.current.onNodeClick((node as GraphNodeObject).id))
            .onBackgroundClick(() => latest.current.onBackgroundClick())
            // Neither `cameraPosition` nor `zoomToFit` is called by the
            // library automatically. cooldownTime defaults to 15s, too
            // slow for first paint, so frame immediately below and again
            // once physics settles.
            .onEngineStop(() => framePreservingMinimumDistance(graph, 400))
          graphRef.current = graph

          // Feed data here, not just in the [data] effect below — that
          // effect runs synchronously on mount, before this async import
          // resolves, so graphRef.current is still null the first time it
          // runs and it silently no-ops. Without this the graph object is
          // constructed successfully but never actually receives any
          // nodes/links: a fully working, fully empty scene that renders
          // its background and nothing else, with no error anywhere.
          graph.graphData(toGraphData(latest.current.data))
          framePreservingMinimumDistance(graph, 0)

          resizeObserver = new ResizeObserver(() => {
            if (!containerRef.current) return
            graph.width(containerRef.current.clientWidth)
            graph.height(containerRef.current.clientHeight)
          })
          resizeObserver.observe(containerRef.current)
        })
        .catch((err: unknown) => {
          if (disposed) return
          console.error('[ForceGraph3DCanvas] failed to initialize 3d-force-graph:', err)
          latest.current.onError?.(err)
        })

      return () => {
        disposed = true
        resizeObserver?.disconnect()
        graphRef.current?._destructor()
        graphRef.current = null
      }
    }, [])

    // Feed data updates after the initial mount (e.g. ego-view toggling).
    // Copies — 3d-force-graph mutates node objects (x/y/z) in place.
    useEffect(() => {
      const graph = graphRef.current
      if (!graph) return
      graph.graphData(toGraphData(data))
      framePreservingMinimumDistance(graph, 0)
    }, [data])

    // Re-evaluate node colors on selection or theme change.
    useEffect(() => {
      graphRef.current?.nodeColor((node) =>
        latest.current.colorForNode(node as GraphNodeObject),
      )
    }, [selectedId, colorVersion])

    // Re-evaluate link colors on theme change (edge colors resolve CSS vars).
    useEffect(() => {
      graphRef.current?.linkColor((link) =>
        latest.current.colorForEdge(link as GraphLinkObject),
      )
    }, [colorVersion])

    useImperativeHandle(ref, () => ({
      flyToNode(id: string) {
        const graph = graphRef.current
        if (!graph) return
        const node = graph.graphData().nodes.find((n) => n.id === id)
        if (!node || node.x === undefined || node.y === undefined || node.z === undefined) {
          return
        }
        const distance = 120
        const ratio = 1 + distance / Math.hypot(node.x, node.y, node.z || 1)
        graph.cameraPosition(
          { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
          { x: node.x, y: node.y, z: node.z },
          600,
        )
      },
      getScreenPositions() {
        const positions = new Map<string, NodeScreenPosition>()
        const graph = graphRef.current
        if (!graph) return positions
        for (const node of graph.graphData().nodes) {
          if (node.x === undefined || node.y === undefined || node.z === undefined) continue
          const coords = graph.graph2ScreenCoords(node.x, node.y, node.z)
          positions.set(node.id, { x: coords.x, y: coords.y })
        }
        return positions
      },
    }))

    return (
      <div
        ref={containerRef}
        data-testid="graph-canvas"
        style={{ width: '100%', height: '100%', ...style }}
      />
    )
  },
)
