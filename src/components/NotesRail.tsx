import type { ReactNode } from 'react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { NotesPanelModeControl } from './NotesPanelModeControl'
import type { NotesPanelMode } from '../lib/notesPanelMode'
import { notesRailRecentItems, notesRailSectionItems, type NotesRailItem } from '../lib/notesRailItems'
import type { NoteStatus, SidebarSelection, VaultEntry } from '../types'
import {
  NOTES_RAIL_GAP_PX,
  NOTES_RAIL_HIT_PX,
  NOTES_RAIL_ICON_PX,
  RAIL_COLLAPSED_WIDTH_PX,
  RAIL_WIDTH_TRANSITION_MS,
} from '../lib/railChrome'
import { cn } from '@/lib/utils'

export type { NotesRailItem }

interface NotesRailProps {
  mode: NotesPanelMode
  onModeChange: (mode: NotesPanelMode) => void
  expanded: boolean
  overlaying: boolean
  width: number
  panelRef: React.Ref<HTMLDivElement>
  modeButtonRef?: React.Ref<HTMLButtonElement>
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocusCapture?: () => void
  onMenuOpenChange?: (open: boolean) => void
  items?: readonly NotesRailItem[]
  showInbox?: boolean
  selection?: SidebarSelection
  onSelectSection?: (selection: SidebarSelection) => void
  entries?: readonly VaultEntry[]
  getNoteStatus?: (path: string) => NoteStatus
  onSelectNote?: (entry: VaultEntry) => void
  children?: ReactNode
}

export function NotesRail({
  mode,
  onModeChange,
  expanded,
  overlaying,
  width,
  panelRef,
  modeButtonRef,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onMenuOpenChange,
  items,
  showInbox = false,
  selection,
  onSelectSection,
  entries = [],
  getNoteStatus,
  onSelectNote,
  children,
}: NotesRailProps) {
  const railItems = items ?? [
    ...(selection && onSelectSection
      ? notesRailSectionItems({ showInbox, selection, onSelect: onSelectSection })
      : []),
    ...notesRailRecentItems({ entries, getNoteStatus, onSelectNote }),
  ]
  const layoutWidth = expanded && !overlaying ? width : RAIL_COLLAPSED_WIDTH_PX
  const visualWidth = expanded ? width : RAIL_COLLAPSED_WIDTH_PX

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative flex shrink-0 flex-col items-center py-2',
        overlaying ? 'bg-background shadow-md' : 'bg-[var(--surface-sidebar)]',
        'motion-reduce:transition-none',
      )}
      data-testid="notes-panel-rail"
      data-mode={mode}
      data-expanded={expanded ? 'true' : 'false'}
      data-overlay={overlaying ? 'true' : 'false'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      style={{
        width: visualWidth,
        marginLeft: overlaying ? -(visualWidth - RAIL_COLLAPSED_WIDTH_PX) : undefined,
        zIndex: overlaying ? 50 : undefined,
        borderLeft: '1px solid var(--border-subtle)',
        transition: `width ${RAIL_WIDTH_TRANSITION_MS}ms ease-out`,
        flexBasis: layoutWidth,
        minWidth: layoutWidth,
        maxWidth: overlaying ? visualWidth : layoutWidth,
      }}
    >
      <div
        className="flex w-full flex-col items-center"
        style={{ gap: NOTES_RAIL_GAP_PX, paddingTop: 0 }}
        data-testid="notes-panel-rail-icons"
      >
        {expanded ? null : (
          <NotesPanelModeControl
            mode={mode}
            onModeChange={onModeChange}
            onMenuOpenChange={onMenuOpenChange}
            triggerRef={modeButtonRef}
          />
        )}
        {!expanded
          ? railItems.map((item) => {
              const Icon = item.icon
              return (
                <ActionTooltip key={item.id} copy={{ label: item.label }} side="left">
                  <Button
                    type="button"
                    variant="ghost"
                    className="relative shrink-0 p-0 hover:bg-[var(--state-hover,var(--accent))]"
                    style={{
                      width: NOTES_RAIL_HIT_PX,
                      height: NOTES_RAIL_HIT_PX,
                      color: item.active ? 'var(--foreground)' : 'var(--text-muted)',
                      backgroundColor: item.active ? 'var(--state-selected)' : undefined,
                    }}
                    aria-label={item.label}
                    aria-current={item.active ? 'page' : undefined}
                    data-testid={`notes-rail-${item.id}`}
                    onClick={item.onSelect}
                  >
                    <Icon size={NOTES_RAIL_ICON_PX} weight={item.active ? 'fill' : 'regular'} />
                    {item.unsaved ? (
                      <span
                        aria-hidden="true"
                        data-testid="notes-rail-unsaved"
                        className="absolute right-1 top-1 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: 'var(--text-muted)',
                        }}
                      />
                    ) : null}
                  </Button>
                </ActionTooltip>
              )
            })
          : null}
      </div>
      {expanded ? (
        <div className="min-h-0 w-full flex-1 overflow-hidden" data-testid="notes-panel-rail-expanded">
          {children}
        </div>
      ) : null}
    </div>
  )
}
