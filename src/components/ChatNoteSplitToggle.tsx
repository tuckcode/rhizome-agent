import { Button } from '@/components/ui/button'
import type { ChatNoteSplit } from './chatNoteSplit'

const OPTIONS = [
  { value: 'stacked', label: 'On top', name: 'Note on top of Chat' },
  { value: 'side-by-side', label: 'Beside', name: 'Note beside Chat' },
] as const

export function ChatNoteSplitToggle({
  split,
  onChange,
}: {
  split: ChatNoteSplit
  onChange: (next: ChatNoteSplit) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Note and Chat layout"
      data-testid="chat-note-split-toggle"
      className="flex shrink-0 gap-0.5 rounded-md border border-border bg-background p-0.5"
      onMouseDown={event => event.stopPropagation()}
    >
      {OPTIONS.map(option => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          size="xs"
          variant={split === option.value ? 'secondary' : 'ghost'}
          aria-checked={split === option.value}
          aria-label={option.name}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
