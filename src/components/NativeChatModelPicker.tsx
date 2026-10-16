import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AiModelProvider } from '../lib/aiTargets'
import { CHAT_FOCUS_RING_CLASS } from '../lib/chatFocusRing'
import {
  COMPOSER_MENU_COLLISION_PADDING_PX,
  NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS,
  NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
  composerChipMenuSideOffset,
  resolveComposerMenuSide,
  type ComposerMenuSide,
} from '../lib/composerMenuSide'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { middleEllipsis, NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS } from '../lib/middleEllipsis'
import {
  countKeylessRhizomeProviders,
  excludeKeylessRhizomeModels,
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  includeRemovedProviderModel,
  loadRhizomeChatModels,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  rhizomeModelVisibleName,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from '../lib/rhizomeChatModels'
import { resolveNativeChatTarget } from '../lib/nativeChatTargets'
import { trackRhizomeModelChanged } from '../lib/productAnalytics'

const FILTER_PLACEHOLDER = 'Filter models'
const EMPTY_MATCH = 'No models match'
const COMPOSER_BOX_SELECTOR = '[data-testid="chat-composer-box"]'

const MENU_PANEL_CLASS = cn(
  'flex flex-col bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-1',
  'w-[18rem] max-h-[min(24rem,var(--radix-popover-content-available-height))]',
  'overflow-hidden overflow-y-hidden',
)

const ROW_CLASS = cn(
  'h-8 px-2 rounded-md text-[13px]',
  'hover:bg-accent hover:text-accent-foreground',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
)

const GROUP_SEP_CLASS = 'my-1 h-px w-full bg-border'

function modelAccessibleName(model: RhizomeChatModel): string {
  if (model.label === REMOVED_PROVIDER_LABEL) return REMOVED_PROVIDER_LABEL
  return `${model.providerName} · ${model.modelId}`
}

function findComposerBox(trigger: HTMLElement | null): HTMLElement | null {
  if (!trigger) return null
  const scoped = trigger.closest('.chat-column')?.querySelector(COMPOSER_BOX_SELECTOR)
  if (scoped instanceof HTMLElement) return scoped
  const global = document.querySelector(COMPOSER_BOX_SELECTOR)
  return global instanceof HTMLElement ? global : null
}

/** One picker: Rhizome catalog from Settings through the composer. Not an engine control. */
export function NativeChatModelPicker({
  value,
  onChange,
  providers,
  variant = 'row',
  locale = 'en',
  onOpenProviders,
}: {
  value: string | null | undefined
  onChange: (target: string) => void
  providers?: AiModelProvider[] | null
  variant?: 'row' | 'chip'
  locale?: AppLocale
  onOpenProviders?: () => void
}) {
  const t = createTranslator(locale)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<RhizomeChatModel[]>(() => seedRhizomeChatModels(providers))
  const [menuSide, setMenuSide] = useState<ComposerMenuSide>(variant === 'chip' ? 'top' : 'bottom')
  const [sideOffset, setSideOffset] = useState(4)
  const selectedId = resolveNativeChatTarget(value, providers)
  const listed = includeRemovedProviderModel(models, selectedId)
  const selected = resolveRhizomeChatModel(listed, selectedId)
  const visibleName = selected ? rhizomeModelVisibleName(selected) : selectedId
  const triggerLabel = variant === 'chip'
    ? middleEllipsis(visibleName, NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS)
    : (selected?.label ?? visibleName)
  const accessibleName = selected ? modelAccessibleName(selected) : selectedId
  const keyed = excludeKeylessRhizomeModels(listed, providers)
  const visible = filterRhizomeChatModels(keyed, query)
  const groups = groupRhizomeChatModels(visible)
  const keylessCount = countKeylessRhizomeProviders(listed, providers)
  const removed = selected?.label === REMOVED_PROVIDER_LABEL
  const chip = variant === 'chip'

  useEffect(() => {
    setModels(seedRhizomeChatModels(providers))
  }, [providers])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadRhizomeChatModels(providers).then((next) => {
      if (!cancelled) setModels(next)
    })
    return () => {
      cancelled = true
    }
  }, [open, providers])

  useEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  const updateMenuPlacement = () => {
    if (!chip) {
      setMenuSide('bottom')
      setSideOffset(4)
      return
    }
    const trigger = triggerRef.current
    const rect = trigger?.getBoundingClientRect()
    const spaceAbove = rect?.top ?? 0
    const spaceBelow = window.innerHeight - (rect?.bottom ?? 0)
    const side = resolveComposerMenuSide({
      spaceAbove,
      spaceBelow,
      menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
      padding: COMPOSER_MENU_COLLISION_PADDING_PX,
    })
    setMenuSide(side)
    const box = findComposerBox(trigger)
    setSideOffset(
      side === 'top'
        ? composerChipMenuSideOffset({
            triggerTop: rect?.top ?? 0,
            composerBoxTop: box ? box.getBoundingClientRect().top : null,
          })
        : 4,
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
            updateMenuPlacement()
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
            aria-label={t('ai.composer.modelNamed', { name: accessibleName })}
            title={t('ai.composer.modelNamed', { name: accessibleName })}
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
          sideOffset={chip ? sideOffset : 4}
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
          <div
            className="flex shrink-0 items-center border-b border-border px-2"
            data-testid="native-chat-model-filter-row"
          >
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
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            data-testid="native-chat-model-list"
          >
            {groups.length === 0 ? (
              <div className="px-2 py-1.5 text-[13px] text-muted-foreground" data-testid="native-chat-models-empty">
                {query.trim() ? EMPTY_MATCH : t('ai.composer.modelsEmpty')}
              </div>
            ) : (
              groups.map((group, index) => (
                <div key={group.provider}>
                  {index > 0 ? (
                    <div className={GROUP_SEP_CLASS} data-testid="native-chat-model-group-sep" />
                  ) : null}
                  <DropdownMenuLabel
                    className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground normal-case tracking-normal"
                    data-testid="native-chat-model-provider"
                  >
                    {group.provider}
                  </DropdownMenuLabel>
                  {group.models.map((model) => {
                    const label = rhizomeModelVisibleName(model)
                    const isSelected = model.id === selectedId
                    return (
                      <DropdownMenuItem
                        key={model.id}
                        className={ROW_CLASS}
                        title={model.modelId}
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
                  })}
                </div>
              ))
            )}
          </div>
          {chip ? (
            <div className="shrink-0" data-testid="native-chat-model-footer">
              <div className={GROUP_SEP_CLASS} data-testid="native-chat-model-footer-sep" />
              {keylessCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-md px-2 py-1.5 text-[12px] font-normal text-muted-foreground"
                  data-testid="native-chat-model-open-providers"
                  onPointerDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={() => {
                    onOpenProviders?.()
                    setOpen(false)
                  }}
                >
                  {`${keylessCount} providers need a key · Open settings`}
                </Button>
              ) : null}
              <p
                className="px-2 py-1.5 text-[12px] text-muted-foreground"
                data-testid="native-chat-model-new-chats"
              >
                {t('ai.composer.modelAppliesToNewChats')}
              </p>
            </div>
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
