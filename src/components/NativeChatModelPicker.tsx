import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react'
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
  COMPOSER_MENU_COLLISION_PADDING_PX,
  NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS,
  NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
  resolveComposerMenuSide,
  type ComposerMenuSide,
} from '../lib/composerMenuSide'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  includeRemovedProviderModel,
  loadRhizomeChatModels,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  rhizomeProviderNeedsApiKey,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from '../lib/rhizomeChatModels'
import { resolveNativeChatTarget } from '../lib/nativeChatTargets'
import { trackRhizomeModelChanged } from '../lib/productAnalytics'

const FILTER_PLACEHOLDER = 'Filter models'
const EMPTY_MATCH = 'No models match'
const EMPTY_ADD_KEY = 'Add a key in Settings to use this provider'

const MENU_PANEL_CLASS = cn(
  'bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-1',
  'w-[18rem] max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto',
)

const ROW_CLASS = cn(
  'h-8 px-2 rounded-md text-[13px]',
  'focus:bg-accent/60 data-[highlighted]:bg-accent/60',
)

function rowLabel(model: RhizomeChatModel): string {
  return model.label === REMOVED_PROVIDER_LABEL ? model.label : model.modelId
}

/** One picker: Rhizome catalog from Settings through the composer. Not an engine control. */
export function NativeChatModelPicker({
  value,
  onChange,
  providers,
  variant = 'row',
  locale = 'en',
}: {
  value: string | null | undefined
  onChange: (target: string) => void
  providers?: AiModelProvider[] | null
  variant?: 'row' | 'chip'
  locale?: AppLocale
}) {
  const t = createTranslator(locale)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<RhizomeChatModel[]>(() => seedRhizomeChatModels(providers))
  const [menuSide, setMenuSide] = useState<ComposerMenuSide>(variant === 'chip' ? 'top' : 'bottom')
  const selectedId = resolveNativeChatTarget(value, providers)
  const listed = includeRemovedProviderModel(models, selectedId)
  const selected = resolveRhizomeChatModel(listed, selectedId)
  const triggerLabel = selected?.label ?? selected?.modelId ?? selectedId
  const visible = filterRhizomeChatModels(listed, query)
  const groups = groupRhizomeChatModels(visible)
  const removed = selected?.label === REMOVED_PROVIDER_LABEL
  const chip = variant === 'chip'

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

  useEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  const updateMenuSide = () => {
    if (!chip) {
      setMenuSide('bottom')
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    const spaceAbove = rect?.top ?? 0
    const spaceBelow = window.innerHeight - (rect?.bottom ?? 0)
    setMenuSide(
      resolveComposerMenuSide({
        spaceAbove,
        spaceBelow,
        menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
        padding: COMPOSER_MENU_COLLISION_PADDING_PX,
      }),
    )
  }

  return (
    <div
      className={
        chip
          ? cn('inline-flex min-w-0 self-center', removed ? 'flex-col items-start gap-1' : 'items-center')
          : 'flex items-center gap-2 px-3 py-2'
      }
      data-testid="native-chat-model-picker"
    >
      {chip ? null : <span className="text-xs text-muted-foreground">{t('ai.composer.modelLabel')}</span>}
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (next) {
            updateMenuSide()
            setQuery('')
          }
          setOpen(next)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              'inline-flex items-center gap-1 transition-colors',
              CHAT_FOCUS_RING_CLASS,
              chip
                ? cn(
                    'h-6 shrink-0 self-center rounded-md border border-border bg-transparent px-2',
                    'font-mono text-[11px] text-muted-foreground',
                    'hover:bg-accent/50 hover:text-foreground',
                    'data-[state=open]:bg-accent',
                    NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS,
                  )
                : 'h-8 min-w-[12rem] max-w-[20rem] rounded-md border border-border bg-background px-2 text-left text-sm',
            )}
            aria-label={t('ai.composer.modelNamed', { name: triggerLabel })}
            title={triggerLabel}
            data-testid="native-chat-model-trigger"
          >
            <span className="min-w-0 truncate" data-testid="native-chat-model-trigger-label">
              {triggerLabel}
            </span>
            <CaretDown
              size={chip ? 12 : 9}
              weight="bold"
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={chip ? menuSide : 'bottom'}
          align="start"
          sideOffset={4}
          collisionPadding={COMPOSER_MENU_COLLISION_PADDING_PX}
          avoidCollisions
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus()
          }}
          className={MENU_PANEL_CLASS}
          data-testid="native-chat-model-menu"
          data-settings-panel-portal={chip ? undefined : 'true'}
        >
          <div className="flex items-center border-b border-border px-2">
            <MagnifyingGlass size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            <input
              ref={filterRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
              }}
              placeholder={FILTER_PLACEHOLDER}
              autoFocus
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-[13px] shadow-none outline-none placeholder:text-muted-foreground"
              aria-label={FILTER_PLACEHOLDER}
              data-testid="native-chat-model-filter"
            />
          </div>
          {groups.length === 0 ? (
            <div className="px-2 py-1.5 text-[13px] text-muted-foreground" data-testid="native-chat-models-empty">
              {query.trim() ? EMPTY_MATCH : t('ai.composer.modelsEmpty')}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((group, index) => {
                const needsKey = group.models.every((model) => (
                  rhizomeProviderNeedsApiKey(model.providerKind, providers)
                ))
                return (
                  <div key={group.provider}>
                    {index > 0 ? (
                      <div
                        className="h-px bg-border"
                        data-testid="native-chat-model-group-sep"
                      />
                    ) : null}
                    <DropdownMenuLabel
                      className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground normal-case tracking-normal"
                      data-testid="native-chat-model-provider"
                    >
                      {group.provider}
                    </DropdownMenuLabel>
                    {needsKey ? (
                      <div
                        className="px-2 py-1.5 text-[13px] text-muted-foreground"
                        data-testid="native-chat-models-add-key"
                      >
                        {EMPTY_ADD_KEY}
                      </div>
                    ) : (
                      group.models.map((model) => {
                        const label = rowLabel(model)
                        const isSelected = model.id === selectedId
                        return (
                          <DropdownMenuItem
                            key={model.id}
                            className={ROW_CLASS}
                            title={label}
                            data-testid={`native-chat-model-${model.id}`}
                            data-selected={isSelected ? 'true' : undefined}
                            onSelect={() => {
                              onChange(model.id)
                              trackRhizomeModelChanged(model.providerKind)
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {isSelected ? (
                              <Check
                                size={16}
                                aria-hidden="true"
                                className="ml-auto size-4 shrink-0 text-foreground"
                                data-testid="native-chat-model-selected-check"
                              />
                            ) : null}
                          </DropdownMenuItem>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {chip ? (
            <p
              className="border-t border-border px-2 py-1.5 text-[12px] text-muted-foreground"
              data-testid="native-chat-model-new-chats"
            >
              {t('ai.composer.modelAppliesToNewChats')}
            </p>
          ) : null}
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
