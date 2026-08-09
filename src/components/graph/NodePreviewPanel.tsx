import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { relativeDate } from '../../utils/noteListHelpers'
import { translate, type AppLocale, DEFAULT_APP_LOCALE } from '../../lib/i18n'
import type { WikiGraphNode } from './graphTypes'

export interface NodePreviewPanelProps {
  node: WikiGraphNode
  /** Titles of projects this node belongs to (derived from belongs_to edges). */
  projects: string[]
  egoActive: boolean
  /** Concrete color for the type dot (already resolved, no CSS vars). */
  nodeColor: string
  locale?: AppLocale
  onOpenNote: (path: string) => void
  onToggleEgo: () => void
  onCreateNote: (title: string) => void
  creating?: boolean
}

/**
 * Docked preview card for the selected graph node. Pure presentation —
 * telemetry and job wiring live in GraphView. Ghost nodes swap the
 * footer for a single Create-note action (the "not written yet" story).
 */
export function NodePreviewPanel({
  node,
  projects,
  egoActive,
  nodeColor,
  locale = DEFAULT_APP_LOCALE,
  onOpenNote,
  onToggleEgo,
  onCreateNote,
  creating = false,
}: NodePreviewPanelProps) {
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(locale, key, values)

  return (
    <Card
      data-testid="graph-node-preview"
      className={`h-full w-full min-h-0 gap-3 overflow-hidden py-3 ${node.ghost ? 'border-dashed' : ''}`}
    >
      <CardHeader className="px-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            data-testid="graph-node-type-dot"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: nodeColor }}
          />
          <NoteTitleIcon icon={node.icon} size={14} />
          <span className="truncate text-sm font-medium">{node.title}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto">
        {node.ghost ? (
          <p className="text-xs text-muted-foreground">{t('graph.ghostHint')}</p>
        ) : (
          node.snippet && (
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {node.snippet}
            </p>
          )
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {node.isA && <Badge variant="secondary">{node.isA}</Badge>}
          {projects.map((project) => (
            <Badge key={project} variant="outline">
              {project}
            </Badge>
          ))}
          {node.modifiedAt !== null && (
            <span className="text-xs text-muted-foreground ml-auto">
              {relativeDate(node.modifiedAt)}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start px-1 text-xs text-muted-foreground"
          onClick={onToggleEgo}
          data-testid="graph-ego-toggle"
        >
          {egoActive
            ? t('graph.exitLocalGraph')
            : t('graph.linksAndBacklinks', {
                links: node.linkCount,
                backlinks: node.backlinkCount,
              })}
        </Button>
      </CardContent>
      <CardFooter className="px-3 gap-2">
        {node.ghost ? (
          <Button
            size="sm"
            onClick={() => onCreateNote(node.title)}
            disabled={creating}
            data-testid="graph-create-note"
          >
            {creating ? t('graph.creating') : t('graph.createNote')}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => node.path && onOpenNote(node.path)}
              data-testid="graph-open-note"
            >
              {t('graph.openNote')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleEgo}
              data-testid="graph-local-graph"
            >
              {egoActive ? t('graph.exitLocalGraph') : t('graph.localGraph')}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
