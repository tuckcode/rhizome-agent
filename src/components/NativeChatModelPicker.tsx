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
  NATIVE_CHAT_MODEL_LIST_MAX_HEIGHT_CLASS,
  NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
  composerChipMenuSideOffset,
  resolveComposerMenuSide,
  type ComposerMenuSide,
} from '../lib/composerMenuSide'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { middleEllipsis, NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS } from '../lib/middleEllipsis'
import {
  liveProviderHeadingNames,
  loadLiveRhizomeChatModels,
  offlineLiveProviderNames,
  pendingLiveProviderNames,
} from '../lib/listProviderModels'
import {
  countKeylessRhizomeProviders,
  excludeKeylessRhizomeModels,
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  includeRemovedProviderModel,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  rhizomeModelRowLabel,
  rhizomeModelVisibleName,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from '../lib/rhizomeChatModels'
import { resolveNativeChatTarget } from '../lib/nativeChatTargets'
import { trackRhizomeModelChanged } from '../lib/productAnalytics'

const FILTER_PLACEHOLDER = 'Filter models'
const EMPTY_MATCH = 'No models match'
const CLEAR_FILTER = 'Clear filter'
const LOADING_STATUS = 'Loading…'
const OFFLINE_STATUS = 'offline, showing saved list'
const COMPOSER_BOX_SELECTOR = '[data-testid="chat-composer-box"]'

const MENU_PANEL_CLASS = cn(
  'flex flex-col bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-1',
  'w-[18rem] overflow-hidden overflow-y-hidden',
)

const ROW_CLASS = cn(
  'h-8 px-2 rounded-md text-[13px]',
  'hover:bg-accent hover:text-accent-foreground',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
)

const GROUP_SEP_CLASS = 'my-1 h-px w-full bg-[var(--border-input)]'

function modelAccessibleName(model: RhizomeChatModel): string {
  if (model.label === REMOVED_PROVIDER_LABEL) return REMOVED_PROVIDER_LABEL
  return `${model.providerName} · ${model.modelId}`
}

function groupsWithLiveHeadings(
  groups: Array<{ provider: string; models: RhizomeChatModel[] }>,
  liveNames: string[],
  query: string,
): Array<{ provider: string; models: RhizomeChatModel[] }> {
  const needle = query.trim().toLowerCase()
  const next = [...groups]
  const seen = new Set(groups.map((group) => group.provider))
  for (const name of liveNames) {
    if (seen.has(name)) continue
    if (needle && !name.toLowerCase().includes(needle)) continue
    seen.add(name)
    next.push({ provider: name, models: [] })
  }
  return next
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
  const selectedRowRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<RhizomeChatModel[]>(() => seedRhizomeChatModels(providers))
  const [loadingNames, setLoadingNames] = useState<string[]>([])
  const [offlineNames, setOfflineNames] = useState<string[]>([])
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
  const groups = groupsWithLiveHeadings(
    groupRhizomeChatModels(visible),
    liveProviderHeadingNames(providers),
    query,
  )
  const keylessCount = countKeylessRhizomeProviders(listed, providers)
  const removed = selected?.label === REMOVED_PROVIDER_LABEL
  const chip = variant === 'chip'

  useEffect(() => {
    setModels(seedRhizomeChatModels(providers))
  }, [providers])

  useEffect(() => {
    if (!open) {
      setLoadingNames([])
      return
    }
    let cancelled = false
    setLoadingNames(pendingLiveProviderNames(providers))
    void loadLiveRhizomeChatModels(providers).then((next) => {
      if (cancelled) return
      setModels(next)
      setLoadingNames([])
      setOfflineNames(offlineLiveProviderNames(providers))
    })
    return () => {
      cancelled = true
    }
  }, [open, providers])

  useEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedId, models, query])

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
            setLoadingNames(pendingLiveProviderNames(providers))
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
          className={cn(MENU_PANEL_CLASS, chip ? undefined : 'z-[12000]')}
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
            className={cn('min-h-0 flex-1 overflow-y-auto', NATIVE_CHAT_MODEL_LIST_MAX_HEIGHT_CLASS)}
            data-testid="native-chat-model-list"
          >
            {groups.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground" data-testid="native-chat-models-empty">
                <span>{query.trim() ? EMPTY_MATCH : t('ai.composer.modelsEmpty')}</span>
                {query.trim() ? (
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    data-testid="native-chat-models-clear-filter"
                    onPointerDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      setQuery('')
                    }}
                  >
                    {CLEAR_FILTER}
                  </button>
                ) : null}
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
                    <span>{group.provider}</span>
                    {(() => {
                      const live = liveProviderHeadingNames(providers).includes(group.provider)
                      if (!live) return null
                      const loading = loadingNames.includes(group.provider)
                      const offline = !loading && offlineNames.includes(group.provider)
                      const status = loading ? LOADING_STATUS : offline ? OFFLINE_STATUS : LOADING_STATUS
                      return (
                        <span
                          className={cn(
                            'ml-1.5 font-normal text-muted-foreground',
                            !loading && !offline && 'invisible',
                          )}
                          data-testid={
                            loading
                              ? 'native-chat-model-loading'
                              : offline
                                ? 'native-chat-model-offline'
                                : undefined
                          }
                          aria-hidden={!loading && !offline}
                        >
                          {status}
                        </span>
                      )
                    })()}
                  </DropdownMenuLabel>
                  {group.models.map((model) => {
                    const label = rhizomeModelRowLabel(model, keyed)
                    const isSelected = model.id === selectedId
                    return (
                      <DropdownMenuItem
                        key={model.id}
                        ref={isSelected ? selectedRowRef : undefined}
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
                <div
                  className="flex flex-wrap items-center gap-x-1 px-2 py-1.5 text-[12px]"
                  data-testid="native-chat-model-open-providers"
                >
                  <span className="text-muted-foreground" data-testid="native-chat-model-keyless-note">
                    {`${keylessCount} providers need a key · `}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-[12px] font-normal text-primary underline-offset-4"
                    data-testid="native-chat-model-open-settings"
                    onPointerDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      onOpenProviders?.()
                      setOpen(false)
                    }}
                  >
                    Open settings
                  </Button>
                </div>
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
