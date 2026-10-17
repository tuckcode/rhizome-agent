import type { ReactNode } from 'react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { NotesPanelModeControl } from './NotesPanelModeControl'
import type { NotesPanelMode } from '../lib/notesPanelMode'
import { notesRailRecentItems, notesRailSectionItems, type NotesRailItem } from '../lib/notesRailItems'
import type { NoteStatus, SidebarSelection, VaultEntry } from '../types'
import {
  NOTES_PANEL_OVERLAY_Z,
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
  controlMode?: NotesPanelMode
  windowTooNarrow?: boolean
  openForNow?: boolean
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
  controlMode,
  windowTooNarrow = false,
  openForNow = false,
}: NotesRailProps) {
  const triggerMode = controlMode ?? mode
  const railItems = items ?? [
    ...(selection && onSelectSection
      ? notesRailSectionItems({ showInbox, selection, onSelect: onSelectSection })
      : []),
    ...notesRailRecentItems({ entries, getNoteStatus, onSelectNote }),
  ]
  const slotWidth = expanded && !overlaying ? width : RAIL_COLLAPSED_WIDTH_PX
  const panelWidth = expanded ? width : RAIL_COLLAPSED_WIDTH_PX
  const sheetWidth = Math.max(0, panelWidth - RAIL_COLLAPSED_WIDTH_PX)

  return (
    <div
      className="relative h-full shrink-0 overflow-visible"
      data-testid="notes-panel-rail-slot"
      style={{
        width: slotWidth,
        flexBasis: slotWidth,
        minWidth: slotWidth,
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          'flex h-full flex-col items-center py-2',
          overlaying ? '' : 'relative bg-[var(--surface-sidebar)]',
          'motion-reduce:transition-none',
        )}
        data-testid="notes-panel-rail"
        data-mode={mode}
        data-expanded={expanded ? 'true' : 'false'}
        data-overlay={overlaying ? 'true' : 'false'}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        style={overlaying ? {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: panelWidth,
          zIndex: NOTES_PANEL_OVERLAY_Z,
          pointerEvents: 'none',
        } : {
          width: panelWidth,
          borderLeft: '1px solid var(--border-subtle)',
          transition: `width ${RAIL_WIDTH_TRANSITION_MS}ms ease-out`,
        }}
      >
        <div
          className={cn(
            'flex w-full flex-col items-center',
            overlaying && 'bg-[var(--surface-sidebar)]',
          )}
          style={overlaying ? {
            gap: NOTES_RAIL_GAP_PX,
            pointerEvents: 'auto',
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: RAIL_COLLAPSED_WIDTH_PX,
            zIndex: 1,
            borderLeft: '1px solid var(--border-subtle)',
          } : { gap: NOTES_RAIL_GAP_PX, paddingTop: 0 }}
          data-testid="notes-panel-rail-icons"
        >
          <NotesPanelModeControl
            mode={triggerMode}
            onModeChange={onModeChange}
            onMenuOpenChange={onMenuOpenChange}
            triggerRef={modeButtonRef}
            windowTooNarrow={windowTooNarrow}
            openForNow={openForNow}
          />
          {railItems.map((item) => {
            const Icon = item.icon
            return (
              <ActionTooltip key={item.id} copy={{ label: item.label }} side="left">
                <Button
                  type="button"
                  variant="ghost"
                  className="relative shrink-0 p-0 hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] dark:hover:bg-[var(--state-hover)]"
                  style={{
                    width: NOTES_RAIL_HIT_PX,
                    height: NOTES_RAIL_HIT_PX,
                    color: item.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: item.active ? 'var(--state-hover)' : undefined,
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
          })}
        </div>
        {expanded ? (
          <div
            className="min-h-0 overflow-hidden bg-background shadow-md"
            data-testid="notes-panel-rail-expanded"
            style={overlaying ? {
              position: 'absolute',
              top: 'var(--overlay-titlebar-height, 38px)',
              right: RAIL_COLLAPSED_WIDTH_PX,
              bottom: 0,
              width: sheetWidth,
              pointerEvents: 'auto',
              borderLeft: '1px solid var(--border-subtle)',
            } : {
              width: '100%',
              flex: 1,
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
