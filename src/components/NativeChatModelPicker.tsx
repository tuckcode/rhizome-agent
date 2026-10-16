import { CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { CHAT_FOCUS_RING_CLASS } from '../lib/chatFocusRing'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  nativeChatTargetOptions,
  resolveNativeChatTarget,
} from '../lib/nativeChatTargets'

/** Options read "Provider · model-id". The chip shows the model; the menu shows both. */
function splitLabel(label: string): { provider: string | null; model: string } {
  const [provider, model] = label.split(' · ')
  return model ? { provider, model } : { provider: null, model: label }
}

/**
 * One picker: catalog models and Free tier (auto). Not an engine control.
 *
 * Lives on the composer row beside the text box, like the other agent
 * harnesses, and opens upward so the menu never covers what is being typed.
 */
export function NativeChatModelPicker({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (target: string) => void
}) {
  const options = nativeChatTargetOptions()
  const selected = resolveNativeChatTarget(value)
  const current = options.find((option) => option.id === selected)
  const { model } = splitLabel(current?.label ?? selected)

  return (
    <div className="flex min-w-0 items-center" data-testid="native-chat-model-picker">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Native chat model"
            title={current?.label}
            className={cn(
              'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5',
              'font-mono text-[11px] text-muted-foreground transition-colors',
              CHAT_FOCUS_RING_CLASS,
              'border-[var(--border-default,var(--border))]',
              'hover:bg-[var(--state-hover,var(--accent))] hover:text-foreground',
            )}
          >
            <span className="min-w-0 truncate">{model}</span>
            <CaretDown
              size={9}
              weight="bold"
              className="shrink-0 text-[var(--text-faint,var(--muted-foreground))]"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuRadioGroup value={selected} onValueChange={onChange}>
            {options.map((option) => {
              const parts = splitLabel(option.label)
              return (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <span className="truncate font-mono">{parts.model}</span>
                  {parts.provider ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {parts.provider}
                    </span>
                  ) : null}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
