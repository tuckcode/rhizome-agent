import { useState } from 'react'
import { CaretDown, CaretUp, Eye, LinkBreak, MagnifyingGlass, X } from '@phosphor-icons/react'
import { translate, type AppLocale } from '../../lib/i18n'
import { Input } from '../ui/input'

export interface GraphControlsProps {
  query: string
  onQueryChange: (query: string) => void
  /** Every node type present, in display order. `''` means untyped. */
  types: string[]
  hiddenTypes: ReadonlySet<string>
  onToggleType: (type: string) => void
  ghostCount: number
  hideGhosts: boolean
  onToggleGhosts: () => void
  /** Notes with no links in and no links out, newest first. */
  unlinked?: readonly { id: string; title: string; isA: string | null }[]
  hideUnlinked?: boolean
  onToggleUnlinked?: () => void
  /** Selects an unlinked note. The selection keeps it visible in the graph. */
  onPickUnlinked?: (id: string) => void
  /** Resolves a swatch color for a type, via the canvas's own resolver. */
  colorForType: (type: string) => string
  /** Nodes currently visible, for the "n of m" readout. */
  visibleCount: number
  totalCount: number
  locale: AppLocale
  /** Test seam — collapsed by default so the graph stays visible. */
  defaultExpanded?: boolean
}

/** A pill toggle. Hidden types read as "off" rather than disappearing, so
 *  the control never hides the means of undoing itself. */
function FilterPill({
  active,
  color,
  label,
  onClick,
  testId,
}: {
  active: boolean
  color?: string
  label: string
  onClick: () => void
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active}
      aria-pressed={active}
      className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-opacity"
      style={{
        borderColor: 'var(--border)',
        background: active ? 'var(--surface-panel, var(--sidebar))' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        opacity: active ? 1 : 0.55,
      }}
    >
      {color && (
        <span
          aria-hidden="true"
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  )
}

/**
 * Search + type filters for the wiki graph.
 *
 * Lives bottom-right as a small Find box so the canvas stays readable.
 * Type pills stay behind an expand control — the old top-left panel covered
 * the graph on any vault with more than a handful of types.
 */
export function GraphControls({
  query,
  onQueryChange,
  types,
  hiddenTypes,
  onToggleType,
  ghostCount,
  hideGhosts,
  onToggleGhosts,
  unlinked = [],
  hideUnlinked = false,
  onToggleUnlinked,
  onPickUnlinked,
  colorForType,
  visibleCount,
  totalCount,
  locale,
  defaultExpanded = false,
}: GraphControlsProps) {
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(locale, key, values)
  const filtered = visibleCount !== totalCount
  const unlinkedCount = unlinked.length
  const hasFilterRow = types.length > 1 || ghostCount > 0 || unlinkedCount > 0
  // Hidden unlinked notes are the default, so they do not force the panel open.
  const filtersActive = hiddenTypes.size > 0 || hideGhosts || Boolean(query.trim())
  const [reviewOpen, setReviewOpen] = useState(false)
  // Search shows unlinked notes, so the chip only speaks when they are hidden.
  const showUnlinkedChip = unlinkedCount > 0 && hideUnlinked && !query.trim()

  // Filters force the panel open; otherwise the Find toggle owns expand state.
  // (Do not sync with useEffect — that trips set-state-in-effect.)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const open = expanded || filtersActive

  return (
    <div
      data-testid="graph-controls"
      data-expanded={open ? 'true' : 'false'}
      // Each bottom corner owns at most half the width, so the controls and
      // the legend never overlap in a narrow window (min width 480 px).
      className={`absolute bottom-3 right-3 z-10 flex max-w-[min(260px,calc(50%-1.125rem))] flex-col-reverse gap-2 ${reviewOpen ? 'max-h-[min(70%,26rem)] w-[260px]' : 'max-h-[min(40%,12rem)]'}`}
    >
      <div
        className="flex items-center gap-1 rounded-[var(--radius)] border p-1.5"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-panel, var(--sidebar))',
        }}
      >
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => {
              if (hasFilterRow) setExpanded(true)
            }}
            placeholder={t('graph.controls.searchPlaceholder')}
            aria-label={t('graph.controls.searchPlaceholder')}
            data-testid="graph-search"
            className="h-7 w-[11rem] max-w-full pl-7 pr-7 text-[12px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              data-testid="graph-search-clear"
              aria-label={t('graph.controls.clearSearch')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {hasFilterRow && (
          <button
            type="button"
            data-testid="graph-controls-expand"
            aria-expanded={open}
            aria-label={open ? 'Hide type filters' : 'Show type filters'}
            onClick={() => setExpanded((value) => !value)}
            className="flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {open ? <CaretDown size={12} /> : <CaretUp size={12} />}
          </button>
        )}
      </div>

      {showUnlinkedChip && !reviewOpen && (
        <button
          type="button"
          data-testid="graph-unlinked-chip"
          onClick={() => setReviewOpen(true)}
          className="flex items-center gap-1.5 self-end rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-panel, var(--sidebar))',
            color: 'var(--foreground)',
          }}
        >
          <LinkBreak size={12} style={{ color: 'var(--muted-foreground)' }} />
          {unlinkedCount === 1 ? '1 unlinked note' : `${unlinkedCount} unlinked notes`}
          <span style={{ color: 'var(--muted-foreground)' }}>· Review</span>
        </button>
      )}

      {reviewOpen && unlinkedCount > 0 && (
        <section
          aria-label="Unlinked notes"
          data-testid="graph-unlinked-review"
          className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-panel, var(--sidebar))',
          }}
        >
          <header className="flex items-start gap-2 border-b px-2.5 py-2" style={{ borderColor: 'var(--border)' }}>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>
                Unlinked notes · {unlinkedCount}
              </div>
              <div className="text-[11px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                No links in or out. Pick one to place it in the graph.
              </div>
            </div>
            <button
              type="button"
              data-testid="graph-unlinked-review-close"
              aria-label="Close unlinked notes"
              onClick={() => setReviewOpen(false)}
              className="p-0.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X size={12} />
            </button>
          </header>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1" data-testid="graph-unlinked-list">
            {unlinked.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  data-testid="graph-unlinked-row"
                  onClick={() => onPickUnlinked?.(note.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12px] hover:bg-[var(--muted)]"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: colorForType(note.isA ?? '') }}
                  />
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  <span className="shrink-0 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {note.isA || 'Note'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hideUnlinked && onToggleUnlinked && (
            <button
              type="button"
              data-testid="graph-unlinked-show-all"
              onClick={() => {
                onToggleUnlinked()
                setReviewOpen(false)
              }}
              className="flex items-center justify-center gap-1.5 border-t px-2.5 py-1.5 text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <Eye size={12} />
              Show all in graph
            </button>
          )}
        </section>
      )}

      {open && hasFilterRow && (
        <div
          className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-[var(--radius)] border p-2"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-panel, var(--sidebar))',
          }}
          data-testid="graph-controls-filters"
        >
          <div className="flex flex-wrap gap-1" data-testid="graph-type-filters">
            {types.map((type) => (
              <FilterPill
                key={type || '__untyped__'}
                testId={`graph-type-filter-${type || 'untyped'}`}
                active={!hiddenTypes.has(type)}
                color={colorForType(type)}
                label={type || t('graph.legend.untyped')}
                onClick={() => onToggleType(type)}
              />
            ))}
            {unlinkedCount > 0 && onToggleUnlinked && (
              <FilterPill
                testId="graph-type-filter-unlinked"
                active={!hideUnlinked}
                label={`Unlinked · ${unlinkedCount}`}
                onClick={onToggleUnlinked}
              />
            )}
            {ghostCount > 0 && (
              <FilterPill
                testId="graph-type-filter-ghosts"
                active={!hideGhosts}
                color="var(--muted-foreground)"
                label={t('graph.legend.ghost')}
                onClick={onToggleGhosts}
              />
            )}
          </div>

          {filtered && (
            <div
              className="text-[11px]"
              style={{ color: 'var(--muted-foreground)' }}
              data-testid="graph-filter-count"
            >
              {t('graph.controls.showing', {
                visible: String(visibleCount),
                total: String(totalCount),
              })}
            </div>
          )}
        </div>
      )}

      {!open && filtered && (
        <div
          className="rounded-[var(--radius)] border px-2 py-1 text-[11px]"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-panel, var(--sidebar))',
            color: 'var(--muted-foreground)',
          }}
          data-testid="graph-filter-count"
        >
          {t('graph.controls.showing', {
            visible: String(visibleCount),
            total: String(totalCount),
          })}
        </div>
      )}
    </div>
  )
}
