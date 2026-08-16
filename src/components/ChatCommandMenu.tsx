import { cn } from '@/lib/utils'
import type { CommandMenuEntry } from '../lib/primeCommandMenu'

export interface ChatCommandMenuProps {
  entries: readonly CommandMenuEntry[]
  selectedIndex: number
  onHover: (index: number) => void
  onSelect: (index: number) => void
  onDismiss: () => void
  skillLabel: string
  instantLabel: string
  disabled?: Record<string, string>
}

export function ChatCommandMenu({
  entries,
  selectedIndex,
  onHover,
  onSelect,
  onDismiss,
  skillLabel,
  instantLabel,
  disabled = {},
}: ChatCommandMenuProps) {
  return (
    <div
      className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
      data-testid="command-menu"
      role="listbox"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          const entry = entries[selectedIndex]
          if (entry && !disabled[entry.slash]) onSelect(selectedIndex)
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onDismiss()
        }
      }}
    >
      {entries.map((entry, index) => {
        const reason = disabled[entry.slash]
        const selected = index === selectedIndex
        return (
          <button
            key={entry.name}
            type="button"
            role="option"
            aria-selected={selected}
            aria-disabled={reason ? true : undefined}
            data-testid={`command-menu-item-${entry.slash}`}
            className={cn(
              'mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer flex-col items-start rounded-md border-0 bg-transparent px-3 py-2 text-left transition-colors',
              selected ? 'bg-accent' : 'hover:bg-secondary',
              reason && 'cursor-not-allowed opacity-60',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => {
              if (reason) return
              onSelect(index)
            }}
          >
            <span className="flex w-full items-baseline justify-between gap-3">
              <span className="truncate text-sm text-foreground">/{entry.slash}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {entry.kind === 'skill' ? skillLabel : instantLabel}
              </span>
            </span>
            <span className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
              {reason ?? entry.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
