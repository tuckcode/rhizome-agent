import { useEffect, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { AiModelProvider } from '../lib/aiTargets'
import { CHAT_FOCUS_RING_CLASS } from '../lib/chatFocusRing'
import {
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  includeRemovedProviderModel,
  loadRhizomeChatModels,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from '../lib/rhizomeChatModels'
import { resolveNativeChatTarget } from '../lib/nativeChatTargets'
import { trackRhizomeModelChanged } from '../lib/productAnalytics'
import { Input } from './ui/input'

/** One picker: Rhizome catalog from Settings through the composer. Not an engine control. */
export function NativeChatModelPicker({
  value,
  onChange,
  providers,
  variant = 'row',
}: {
  value: string | null | undefined
  onChange: (target: string) => void
  providers?: AiModelProvider[] | null
  variant?: 'row' | 'chip'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<RhizomeChatModel[]>(() => seedRhizomeChatModels(providers))
  const selectedId = resolveNativeChatTarget(value, providers)
  const listed = includeRemovedProviderModel(models, selectedId)
  const selected = resolveRhizomeChatModel(listed, selectedId)
  const triggerLabel = selected?.label ?? selected?.modelId ?? selectedId
  const visible = filterRhizomeChatModels(listed, query)
  const groups = groupRhizomeChatModels(visible)
  const removed = selected?.label === REMOVED_PROVIDER_LABEL

  useEffect(() => {
    setModels(seedRhizomeChatModels(providers))
  }, [providers])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadRhizomeChatModels(providers).then((listed) => {
      if (!cancelled) setModels(listed)
    })
    return () => {
      cancelled = true
    }
  }, [open, providers])

  const chip = variant === 'chip'
  return (
    <div
      className={
        chip
          ? cn('inline-flex min-w-0', removed ? 'flex-col items-start gap-1' : 'items-center')
          : 'flex items-center gap-2 px-3 py-2'
      }
      data-testid="native-chat-model-picker"
    >
      {chip ? null : <span className="text-xs text-muted-foreground">Model</span>}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 transition-colors',
              CHAT_FOCUS_RING_CLASS,
              chip
                ? cn(
                    'rounded-full border border-border px-2 py-0.5',
                    'font-mono text-[11px] text-muted-foreground',
                    'hover:border-border-strong hover:text-foreground',
                  )
                : 'h-8 min-w-[12rem] max-w-[20rem] rounded-md border border-border bg-background px-2 text-left text-sm',
            )}
            aria-label={`Model: ${triggerLabel}`}
            data-testid="native-chat-model-trigger"
          >
            <span className="min-w-0 truncate">{triggerLabel}</span>
            <CaretDown size={9} weight="bold" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={chip ? 'top' : 'bottom'}
          align="start"
          className="max-h-[320px] w-72 overflow-y-auto"
          data-testid="native-chat-model-menu"
        >
          <div className="px-1.5 pb-1 pt-0.5">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
              }}
              placeholder="Filter models"
              className="h-8 font-mono text-[11px]"
              aria-label="Filter models"
              data-testid="native-chat-model-filter"
            />
          </div>
          {groups.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground" data-testid="native-chat-models-empty">
              No models match.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.provider}>
                <DropdownMenuLabel
                  className="font-mono text-[10px] uppercase tracking-[0.1em] text-primary"
                  data-testid="native-chat-model-provider"
                >
                  {group.provider}
                </DropdownMenuLabel>
                {group.models.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    className="text-[12px]"
                    data-testid={`native-chat-model-${model.id}`}
                    onSelect={() => {
                      onChange(model.id)
                      trackRhizomeModelChanged(model.providerKind)
                    }}
                  >
                    <span className="truncate">{model.label}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {removed ? (
        <p
          className={cn('text-xs text-destructive', chip ? 'max-w-[16rem]' : 'max-w-[22rem]')}
          data-testid="native-chat-removed-provider"
        >
          {REMOVED_PROVIDER_ERROR}
        </p>
      ) : null}
    </div>
  )
}
