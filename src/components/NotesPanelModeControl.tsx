import type { Ref } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  NOTES_PANEL_MODE_ICONS,
  NOTES_PANEL_MODES,
  isNotesPanelMode,
  type NotesPanelMode,
  notesPanelModeLabel,
  notesPanelModeShortcutAria,
  notesPanelModeShortcutDisplay,
  notesPanelModeTooltip,
} from '../lib/notesPanelMode'
import { NOTES_MODE_BUTTON_PX, NOTES_MODE_BUTTON_RADIUS_PX, NOTES_PANEL_MENU_Z } from '../lib/railChrome'

interface NotesPanelModeControlProps {
  mode: NotesPanelMode
  onModeChange: (mode: NotesPanelMode) => void
  onMenuOpenChange?: (open: boolean) => void
  triggerRef?: Ref<HTMLButtonElement>
  windowTooNarrow?: boolean
  openForNow?: boolean
}

export function NotesPanelModeControl({
  mode,
  onModeChange,
  onMenuOpenChange,
  triggerRef,
  windowTooNarrow = false,
  openForNow = false,
}: NotesPanelModeControlProps) {
  const CurrentIcon = NOTES_PANEL_MODE_ICONS[mode]
  const tooltip = notesPanelModeTooltip(mode, { windowTooNarrow, openForNow })
  const shortcut = notesPanelModeShortcutDisplay()

  return (
    <DropdownMenu onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-6 w-6 shrink-0 p-0 hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)] dark:hover:bg-[var(--state-hover)]"
          style={{
            width: NOTES_MODE_BUTTON_PX,
            height: NOTES_MODE_BUTTON_PX,
            borderRadius: NOTES_MODE_BUTTON_RADIUS_PX,
            color: 'var(--text-primary)',
          }}
          title={`${tooltip} ${shortcut}`}
          aria-label={tooltip}
          aria-keyshortcuts={notesPanelModeShortcutAria()}
          data-testid="notes-panel-mode-trigger"
          data-mode={mode}
          data-window-too-narrow={windowTooNarrow ? 'true' : 'false'}
          data-open-for-now={openForNow ? 'true' : 'false'}
          ref={triggerRef}
        >
          <CurrentIcon size={16} weight={mode === 'open' ? 'fill' : 'regular'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-testid="notes-panel-mode-menu"
        style={{ zIndex: NOTES_PANEL_MENU_Z }}
      >
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            if (isNotesPanelMode(value)) onModeChange(value)
          }}
        >
          {NOTES_PANEL_MODES.map((option) => {
            const Icon = NOTES_PANEL_MODE_ICONS[option]
            const selected = option === mode
            return (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                data-testid={`notes-panel-mode-${option}`}
                data-checked={selected ? 'true' : 'false'}
                className="gap-2"
              >
                <Icon size={16} weight={option === 'open' ? 'fill' : 'regular'} />
                <span className="flex-1">{notesPanelModeLabel(option)}</span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
