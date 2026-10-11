import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  nativeChatTargetOptions,
  resolveNativeChatTarget,
} from '../lib/nativeChatTargets'

/** One picker: catalog models and Free tier (auto). Not an engine control. */
export function NativeChatModelPicker({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (target: string) => void
}) {
  const options = nativeChatTargetOptions()
  const selected = resolveNativeChatTarget(value)
  return (
    <div className="flex items-center gap-2 px-3 py-2" data-testid="native-chat-model-picker">
      <span className="text-xs text-muted-foreground">Model</span>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[280px]" aria-label="Native chat model">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
