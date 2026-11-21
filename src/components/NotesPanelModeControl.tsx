import { useId, type Ref } from 'react'
import { Button } from './ui/button'
import {
  NOTES_PANEL_MODES,
  type NotesPanelMode,
  notesPanelModeLabel,
  notesPanelModeShortcutAria,
  notesPanelModeShortcutDisplay,
  notesPanelModeTooltip,
} from '../lib/notesPanelMode'
import { cn } from '@/lib/utils'

interface NotesPanelModeControlProps {
  mode: NotesPanelMode
  onModeChange: (mode: NotesPanelMode) => void
  triggerRef?: Ref<HTMLButtonElement>
  windowTooNarrow?: boolean
  openForNow?: boolean
  vertical?: boolean
}

export function NotesPanelModeControl({
  mode,
  onModeChange,
  triggerRef,
  windowTooNarrow = false,
  openForNow = false,
  vertical = false,
}: NotesPanelModeControlProps) {
  const statusId = useId()
  const status = windowTooNarrow
    ? 'Window too narrow to keep Notes open.'
    : openForNow ? 'Notes is open for now.' : null
  const shortcut = notesPanelModeShortcutDisplay()

  return (
    <div
      role="group"
      aria-label="Notes panel mode"
      data-testid="notes-panel-mode"
      className={cn('flex shrink-0 gap-0.5 rounded-md border border-input p-0.5', vertical && 'flex-col')}
    >
      {NOTES_PANEL_MODES.map((option) => {
        const label = notesPanelModeLabel(option)
        const selected = option === mode
        const tooltip = notesPanelModeTooltip(option, selected ? { windowTooNarrow, openForNow } : undefined)
        return (
          <Button
            key={option}
            type="button"
            variant={selected ? 'secondary' : 'ghost'}
            size="xs"
            className="min-h-7 px-1.5 text-xs"
            title={`${tooltip} ${shortcut}`}
            aria-pressed={selected}
            aria-describedby={selected && status ? statusId : undefined}
            aria-keyshortcuts={selected ? notesPanelModeShortcutAria() : undefined}
            data-testid={`notes-panel-mode-${option}`}
            ref={selected ? triggerRef : undefined}
            onClick={() => onModeChange(option)}
          >
            {label}
          </Button>
        )
      })}
      {status ? <span id={statusId} className="sr-only">{status}</span> : null}
    </div>
  )
}
