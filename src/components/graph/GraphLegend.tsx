import { useMemo, useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { translate, type AppLocale } from '../../lib/i18n'
import { trackGraphLegendToggled } from '../../lib/productAnalytics'
import type { GraphEdgeKind, WikiGraphData, WikiGraphNode } from './graphTypes'

/** Every edge kind the graph can draw, in the order they're explained. */
const EDGE_KINDS: GraphEdgeKind[] = ['wikilink', 'belongs_to', 'related_to', 'relationship']

const EDGE_KIND_LABEL_KEY: Record<GraphEdgeKind, Parameters<typeof translate>[1]> = {
  wikilink: 'graph.legend.edge.wikilink',
  belongs_to: 'graph.legend.edge.belongsTo',
  related_to: 'graph.legend.edge.relatedTo',
  relationship: 'graph.legend.edge.relationship',
}

export interface GraphLegendProps {
  data: WikiGraphData
  ghostCount: number
  colorForNode: (node: WikiGraphNode) => string
  colorForEdge: (edge: { kind: GraphEdgeKind }) => string
  locale: AppLocale
  /** Test seam — the panel manages its own open state otherwise. */
  defaultOpen?: boolean
}

/**
 * Key for the wiki graph: what the node and edge colors mean, how big the
 * graph is, and how to drive it.
 *
 * Node types are derived from the data rather than listed statically —
 * `getTypeColor` hashes any unmapped type to a palette entry, so a fixed
 * list would be both incomplete (missing custom types) and misleading
 * (showing types this vault doesn't use). Edge kinds *are* fixed, because
 * the graph builder only ever emits those four.
 */
export function GraphLegend({
  data,
  ghostCount,
  colorForNode,
  colorForEdge,
  locale,
  defaultOpen = true,
}: GraphLegendProps) {
  const [open, setOpen] = useState(defaultOpen)
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(locale, key, values)

  // Distinct real (non-ghost) types present, each with a representative
  // node so the swatch uses the same resolver the canvas does. Labels are
  // applied after memoizing rather than inside it: translating in here
  // would make `t` a dependency, and `t` is a fresh closure every render.
  const nodeTypes = useMemo(() => {
    const seen = new Map<string, WikiGraphNode>()
    for (const node of data.nodes) {
      if (node.ghost) continue
      const key = node.isA ?? ''
      if (!seen.has(key)) seen.set(key, node)
    }
    return [...seen.entries()]
      .map(([key, node]) => ({ key, node }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [data.nodes])

  // Only explain edge kinds this graph actually contains.
  const presentEdgeKinds = useMemo(() => {
    const kinds = new Set(data.edges.map((e) => e.kind))
    return EDGE_KINDS.filter((kind) => kinds.has(kind))
  }, [data.edges])

  const toggle = () => {
    const next = !open
    setOpen(next)
    trackGraphLegendToggled(next ? 'opened' : 'closed')
  }

  return (
    <div
      data-testid="graph-legend"
      className="absolute bottom-3 left-3 z-10 max-w-[240px] rounded-[var(--radius)] border text-[11px]"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface-panel, var(--sidebar))',
        color: 'var(--muted-foreground)',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        data-testid="graph-legend-toggle"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
        style={{ color: 'var(--foreground)' }}
      >
        <span className="font-medium">{t('graph.legend.title')}</span>
        {open ? <CaretDown size={12} /> : <CaretUp size={12} />}
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 px-2.5 pb-2.5" data-testid="graph-legend-body">
          <div data-testid="graph-legend-counts">
            {t('graph.legend.counts', {
              nodes: String(data.nodes.length),
              links: String(data.edges.length),
            })}
            {ghostCount > 0 && (
              <>
                {' · '}
                <span data-testid="graph-legend-ghost-count">
                  {t('graph.legend.ghostCount', { count: String(ghostCount) })}
                </span>
              </>
            )}
          </div>

          {nodeTypes.length > 0 && (
            <div>
              <div className="mb-1 uppercase tracking-wide opacity-70">
                {t('graph.legend.nodesHeading')}
              </div>
              <ul className="flex flex-col gap-1">
                {nodeTypes.map(({ key, node }) => (
                  <li key={key} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ background: colorForNode(node) }}
                    />
                    <span className="truncate">{key || t('graph.legend.untyped')}</span>
                  </li>
                ))}
                {ghostCount > 0 && (
                  <li className="flex items-center gap-1.5" data-testid="graph-legend-ghost">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 shrink-0 rounded-full opacity-50"
                      style={{ background: 'var(--muted-foreground)' }}
                    />
                    <span className="truncate">{t('graph.legend.ghost')}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {presentEdgeKinds.length > 0 && (
            <div>
              <div className="mb-1 uppercase tracking-wide opacity-70">
                {t('graph.legend.linksHeading')}
              </div>
              <ul className="flex flex-col gap-1">
                {presentEdgeKinds.map((kind) => (
                  <li key={kind} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-0.5 w-3 shrink-0 rounded"
                      style={{ background: colorForEdge({ kind }) }}
                    />
                    <span className="truncate">{t(EDGE_KIND_LABEL_KEY[kind])}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="opacity-70" data-testid="graph-legend-controls">
            {t('graph.legend.controls')}
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphLegend
