import { Check } from '@phosphor-icons/react'
import type { Ref } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  NOTES_PANEL_MODE_ICONS,
  NOTES_PANEL_MODES,
  type NotesPanelMode,
  notesPanelModeLabel,
  notesPanelModeShortcutAria,
  notesPanelModeShortcutDisplay,
  notesPanelModeTooltip,
} from '../lib/notesPanelMode'
import { NOTES_MODE_BUTTON_PX, NOTES_MODE_BUTTON_RADIUS_PX } from '../lib/railChrome'

interface NotesPanelModeControlProps {
  mode: NotesPanelMode
  onModeChange: (mode: NotesPanelMode) => void
  onMenuOpenChange?: (open: boolean) => void
  triggerRef?: Ref<HTMLButtonElement>
}

export function NotesPanelModeControl({
  mode,
  onModeChange,
  onMenuOpenChange,
  triggerRef,
}: NotesPanelModeControlProps) {
  const CurrentIcon = NOTES_PANEL_MODE_ICONS[mode]
  const tooltip = notesPanelModeTooltip(mode)
  const shortcut = notesPanelModeShortcutDisplay()

  return (
    <DropdownMenu onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-6 w-6 shrink-0 p-0 hover:bg-[var(--state-hover,var(--accent))]"
          style={{
            width: NOTES_MODE_BUTTON_PX,
            height: NOTES_MODE_BUTTON_PX,
            borderRadius: NOTES_MODE_BUTTON_RADIUS_PX,
          }}
          title={`${tooltip} ${shortcut}`}
          aria-label={tooltip}
          aria-keyshortcuts={notesPanelModeShortcutAria()}
          data-testid="notes-panel-mode-trigger"
          data-mode={mode}
          ref={triggerRef}
        >
          <CurrentIcon size={16} weight={mode === 'open' ? 'fill' : 'regular'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="notes-panel-mode-menu">
        {NOTES_PANEL_MODES.map((option) => {
          const Icon = NOTES_PANEL_MODE_ICONS[option]
          const selected = option === mode
          return (
            <DropdownMenuItem
              key={option}
              onSelect={() => onModeChange(option)}
              data-testid={`notes-panel-mode-${option}`}
              data-checked={selected ? 'true' : 'false'}
              className="gap-2"
            >
              <Icon size={16} weight={option === 'open' ? 'fill' : 'regular'} />
              <span className="flex-1">{notesPanelModeLabel(option)}</span>
              {selected ? <Check size={14} aria-hidden="true" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
