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
import { callHost } from '../lib/callHost'
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
import { loadPrimeModelCatalog } from '../lib/primeModelCatalog'
import { groupModelsByProvider, modelKey, type PrimeModel } from '../lib/primeModels'
import { primeProviderLabel } from '../lib/primeProviderLabels'
import {
  forgetListedProviderModels,
  listProviderFailures,
  loadLiveRhizomeChatModels,
  pendingLiveProviderNames,
  providerModelsCacheKey,
  providersToListLive,
} from '../lib/listProviderModels'
import {
  filterRhizomeChatModels,
  includeRemovedProviderModel,
  providerForDiscover,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  rhizomeProviderNeedsApiKey,
  seedRhizomeChatModels,
  type RhizomeChatModel,
  rhizomeChatModelTriggerLabel,
  formatChatModelLabel,
  unresolvedRhizomeChatModelLabel,
} from '../lib/rhizomeChatModels'
import {
  buildPickerMenu,
  unsetProviderGroupCount,
  type PickerMenuGroup,
  pickerHintI18nKey,
} from '../lib/pickerModelMenu'
import { requestProviderSettingsFocus, CONNECTED_SUMMARY_ROW_ID } from '../lib/providerSettingsFocus'
import { nativeSessionTargetForSlot } from '../lib/nativeChatTranscript'
import { useNativeLiveSlot } from '../lib/nativeLiveSlot'
import { visionForTargets } from '../lib/nativeVision'
import { resolveNativeChatTarget } from '../lib/nativeChatTargets'
import { providerAllowsChatgptSignIn } from '../lib/accountSignInProviders'
import { useOauthAccounts } from '../lib/useOauthAccounts'
import { SETTINGS_MENU_Z_CLASS } from '../lib/settingsMenuLayer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { trackPrimeModelChanged, trackRhizomeModelChanged } from '../lib/productAnalytics'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'

const FILTER_PLACEHOLDER = 'Filter models'
const EMPTY_MATCH = 'No models match'
const CLEAR_FILTER = 'Clear filter'
const LOADING_STATUS = 'Loading…'
const COMPOSER_BOX_SELECTOR = '[data-testid="chat-composer-box"]'

const MENU_PANEL_CLASS = cn(
  'flex flex-col bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-1',
  'w-[18rem] overflow-hidden overflow-y-hidden',
)

const ROW_CLASS = cn(
  'h-8 px-2 rounded-md text-[13px] text-foreground',
  'hover:bg-[var(--state-menu-hover)] hover:text-foreground',
  'focus:bg-[var(--state-menu-hover)] focus:text-foreground',
  'data-[highlighted]:bg-[var(--state-menu-hover)] data-[highlighted]:text-foreground',
  'data-[selected=true]:bg-[var(--state-menu-selected)] data-[selected=true]:text-foreground',
  'data-[selected=true]:hover:bg-[var(--state-menu-selected)]',
  'data-[selected=true]:data-[highlighted]:bg-[var(--state-menu-selected)]',
  'shadow-[inset_2px_0_0_transparent]',
  'hover:shadow-[inset_2px_0_0_var(--accent-blue)]',
  'focus:shadow-[inset_2px_0_0_var(--accent-blue)]',
  'data-[highlighted]:shadow-[inset_2px_0_0_var(--accent-blue)]',
  'data-[selected=true]:shadow-[inset_2px_0_0_var(--accent-blue)]',
  '[&_svg]:text-foreground',
)

const GROUP_SEP_CLASS = 'my-2 h-px w-full bg-border-subtle'

function menuModel(
  model: RhizomeChatModel,
  providers?: AiModelProvider[] | null,
): {
  id: string
  modelId: string
  displayName: string
  providerName: string
  providerKind: string
  providerId: string
  cacheKey: string
  baseUrl?: string | null
} {
  const configured = (providers ?? []).find((provider) => provider.id === model.providerId)
  const discovered = providerForDiscover(model.providerKind)
  const source = configured ?? discovered
  const baseUrl = configured ? configured.base_url : discovered.base_url
  return {
    id: model.id,
    modelId: model.modelId,
    displayName: model.label === REMOVED_PROVIDER_LABEL
      ? REMOVED_PROVIDER_LABEL
      : (model.displayName.trim() || model.modelId),
    providerName: model.providerName,
    providerKind: model.providerKind,
    providerId: model.providerId,
    cacheKey: providerModelsCacheKey({
      id: model.providerId,
      kind: source.kind,
      base_url: baseUrl,
    }),
    baseUrl,
  }
}

function findComposerBox(trigger: HTMLElement | null): HTMLElement | null {
  if (!trigger) return null
  const scoped = trigger.closest('.chat-column')?.querySelector(COMPOSER_BOX_SELECTOR)
  if (scoped instanceof HTMLElement) return scoped
  const global = document.querySelector(COMPOSER_BOX_SELECTOR)
  return global instanceof HTMLElement ? global : null
}

/** One picker: Rhizome catalog on the native engine, Prime catalog on a Prime chat. */
export function NativeChatModelPicker({
  value,
  onChange,
  providers,
  variant = 'row',
  locale = 'en',
  onOpenProviders,
  engine = 'native',
  vaultPath,
  showLabel = true,
  nativeLiveSlot,
}: {
  value: string | null | undefined
  onChange: (target: string) => void
  providers?: AiModelProvider[] | null
  variant?: 'row' | 'chip'
  locale?: AppLocale
  onOpenProviders?: () => void
  engine?: 'native' | 'prime'
  vaultPath?: string
  showLabel?: boolean
  /** The chat panel that owns this picker. Other sessions are ignored. */
  nativeLiveSlot?: string | null
}) {
  const contextSlot = useNativeLiveSlot()
  const liveSlot = nativeLiveSlot ?? contextSlot
  const oauth = useOauthAccounts()
  const t = createTranslator(locale)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const selectedRowRef = useRef<HTMLDivElement | null>(null)
  const skipCloseAutoFocusRef = useRef(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const openPicker = () => setOpen(true)
    window.addEventListener('rhizome-open-model-picker', openPicker)
    return () => window.removeEventListener('rhizome-open-model-picker', openPicker)
  }, [])
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<RhizomeChatModel[]>(() => seedRhizomeChatModels(providers))
  const [primeModels, setPrimeModels] = useState<PrimeModel[]>([])
  const [loadingNames, setLoadingNames] = useState<string[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const [visionById, setVisionById] = useState<Record<string, string>>({})
  const [menuSide, setMenuSide] = useState<ComposerMenuSide>(variant === 'chip' ? 'top' : 'bottom')
  const [sideOffset, setSideOffset] = useState(4)
  const primeHost = usePrimeHostStatus(engine === 'prime', vaultPath)
  const prime = engine === 'prime'
  const primeSelectedId = primeHost.modelProvider && primeHost.modelId
    ? `${primeHost.modelProvider}/${primeHost.modelId}`
    : null
  const selectedId = prime
    ? (primeSelectedId ?? resolveNativeChatTarget(value, providers))
    : resolveNativeChatTarget(value, providers, oauth.oauthByProvider)
  const listed = includeRemovedProviderModel(models, selectedId)
  const selectedRhizome = resolveRhizomeChatModel(listed, selectedId)
  const selectedPrime = primeModels.find((model) => modelKey(model) === selectedId) ?? null
  const chip = variant === 'chip'
  const providerName = prime
    ? (primeHost.modelProvider
      ? primeProviderLabel(primeHost.modelProvider)
      : (selectedPrime ? primeProviderLabel(selectedPrime.provider) : null))
    : (selectedRhizome?.providerName ?? null)
  const rawId = prime
    ? (primeHost.modelId ?? selectedPrime?.id ?? null)
    : (selectedRhizome?.modelId ?? null)
  const displayName = prime
    ? (primeModelLabel(primeHost) ?? selectedPrime?.name ?? selectedId)
    : (selectedRhizome
      ? (selectedRhizome.displayName.trim() || selectedRhizome.modelId)
      : selectedId)
  // Unlisted selection: Provider · model from Settings providers (#283).
  const labelFallback = (!prime && !selectedRhizome && selectedId)
    ? unresolvedRhizomeChatModelLabel(selectedId, providers)
    : displayName
  const rowLabel = prime
    ? displayName
    : rhizomeChatModelTriggerLabel(selectedRhizome, labelFallback, { chip: false })
  // Chip and Settings share the same "Provider · model" label (#283).
  const visibleText = prime
    ? displayName
    : rhizomeChatModelTriggerLabel(selectedRhizome, labelFallback, { chip })
  const tooltipTitle = prime
    ? (providerName ? formatChatModelLabel(providerName, displayName) : displayName)
    : rowLabel
  const tooltipRawId = prime ? rawId : (selectedRhizome?.id ?? selectedId)
  const showRawId = tooltipRawId != null && tooltipRawId !== visibleText
  // WCAG 2.5.3: the accessible name starts with the text the control shows.
  const accessibleName = [visibleText, showRawId ? tooltipRawId : null]
    .filter((part): part is string => Boolean(part))
    .join(', ')
  const visibleRhizome = filterRhizomeChatModels(listed, query)
  const needle = query.trim().toLowerCase()
  const visiblePrime = needle
    ? primeModels.filter((model) =>
      [model.provider, model.name, model.id].some((field) => field.toLowerCase().includes(needle)))
    : primeModels
  const primeGroups = groupModelsByProvider(visiblePrime)
  const primeMenu = primeGroups.map((group) => ({
    provider: primeProviderLabel(group.provider),
    models: group.models.map((model) => ({
      id: modelKey(model),
      modelId: model.id,
      label: model.name || model.id,
      providerKind: model.provider,
    })),
  }))
  const rhizomeMenuRaw: PickerMenuGroup[] = prime
    ? []
    : buildPickerMenu({
      models: visibleRhizome.map((model) => menuModel(model, providers)),
      failures: listProviderFailures(),
      loadingNames,
      needsKey: (kind) => {
        if (kind === 'open_ai' && oauth.chatgptReady) return false
        return kind !== 'free_tier' && rhizomeProviderNeedsApiKey(kind, providers)
      },
      accountNeedsSignIn: (kind, providerId) => {
        if (kind !== 'open_ai') return false
        const provider = (providers ?? []).find((item) => item.id === providerId)
          ?? { id: providerId, kind, base_url: null }
        return providerAllowsChatgptSignIn({
          id: provider.id,
          kind: provider.kind,
          baseUrl: 'base_url' in provider ? provider.base_url : null,
        }) && !oauth.chatgptReady
      },
      oauthByProvider: oauth.oauthByProvider,
    })
  const rhizomeMenu = needle
    ? rhizomeMenuRaw.filter((group) => {
      if (group.section !== 'accounts') return true
      const hay = [group.label, group.hint, group.providerId].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
    : rhizomeMenuRaw
  const unsetCount = unsetProviderGroupCount(rhizomeMenu)
  const sessionTarget = prime ? null : nativeSessionTargetForSlot(liveSlot)
  const sessionModel = sessionTarget ? resolveRhizomeChatModel(listed, sessionTarget) : undefined
  const sessionLabel = sessionModel
    ? (sessionModel.displayName.trim() || sessionModel.modelId)
    : null
  const footnote = sessionLabel && sessionLabel !== displayName
    ? t('ai.composer.chatStaysOn', { model: sessionLabel })
    : t('ai.composer.modelAppliesToNewChats')
  const removed = !prime && selectedRhizome?.label === REMOVED_PROVIDER_LABEL
  // Prefer keeping the model name when the chip is narrow: provider ellipsizes first (#283).
  const splitChipLabel = Boolean(
    chip
    && !prime
    && !removed
    && providerName
    && selectedRhizome?.providerKind !== 'free_tier',
  )
  const showFooter = chip && !prime

  useEffect(() => {
    setModels(seedRhizomeChatModels(providers))
  }, [providers])

  useEffect(() => {
    if (!open) {
      setLoadingNames([])
      return
    }
    let cancelled = false
    if (prime) {
      void loadPrimeModelCatalog().then((next) => {
        if (!cancelled) setPrimeModels(next)
      })
      return () => {
        cancelled = true
      }
    }
    setLoadingNames(pendingLiveProviderNames(providers))
    void loadLiveRhizomeChatModels(providers).then((next) => {
      if (cancelled) return
      setModels(next)
      setLoadingNames([])
    })
    return () => {
      cancelled = true
    }
  }, [open, prime, providers, reloadToken])

  useEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || prime) return
    let cancelled = false
    const ids = models.map((model) => model.id)
    void visionForTargets(ids).then((next) => {
      if (!cancelled) setVisionById(next)
    })
    return () => {
      cancelled = true
    }
  }, [open, prime, models, reloadToken])

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

  const pick = async (id: string, providerKind: string) => {
    if (prime) {
      const model = primeModels.find((entry) => modelKey(entry) === id)
      if (!model) return
      const vault = vaultPath?.trim()
      if (vault) await callHost('ensure_prime_session_host', { vaultPath: vault })
      await callHost('set_prime_model', { provider: model.provider, modelId: model.id })
      trackPrimeModelChanged(model.provider)
      return
    }
    onChange(id)
    trackRhizomeModelChanged(providerKind)
  }

  return (
    <div
      className={
        chip
          ? cn('inline-flex min-w-0 self-center', removed ? 'flex-col items-start gap-1' : 'items-center')
          : showLabel
            ? 'flex items-center gap-2 px-3 py-2'
            : 'flex items-center justify-end'
      }
      data-testid="native-chat-model-picker"
      data-engine={engine}
      data-variant={variant}
      data-model-id={selectedId}
    >
      {chip || !showLabel ? null : <span className="text-xs text-muted-foreground">{t('ai.composer.modelLabel')}</span>}
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (next) {
            skipCloseAutoFocusRef.current = false
            updateMenuPlacement()
            setQuery('')
            setLoadingNames(prime ? [] : pendingLiveProviderNames(providers))
          }
          setOpen(next)
        }}
      >
        <Tooltip delayDuration={chip ? 300 : undefined}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 transition-colors',
                  CHAT_FOCUS_RING_CLASS,
                  chip
                    ? cn(
                        'h-6 max-w-full shrink self-center rounded-md border border-border bg-transparent px-2',
                        'text-[12px] text-muted-foreground',
                        'hover:bg-accent/50 hover:text-foreground',
                        'data-[state=open]:bg-accent',
                        NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS,
                      )
                    : 'h-8 min-w-[12rem] max-w-[20rem] rounded-md border border-border bg-background px-2 text-left text-sm',
                )}
                aria-label={accessibleName}
                data-testid="native-chat-model-trigger"
              >
                {splitChipLabel ? (
                  <span
                    className="inline-flex min-w-0 max-w-full items-center overflow-hidden"
                    data-testid="native-chat-model-trigger-label"
                  >
                    <span className="min-w-0 shrink-[999] truncate" data-testid="native-chat-model-trigger-provider">
                      {providerName}
                    </span>
                    <span className="shrink-0 whitespace-nowrap" aria-hidden="true">
                      {' · '}
                    </span>
                    <span className="min-w-0 truncate" data-testid="native-chat-model-trigger-model">
                      {displayName}
                    </span>
                  </span>
                ) : (
                  <span className="min-w-0 truncate" data-testid="native-chat-model-trigger-label">
                    {visibleText}
                  </span>
                )}
                <CaretDown
                  size={chip ? 12 : 9}
                  weight="bold"
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" data-testid="native-chat-model-tooltip">
            <div>{tooltipTitle}</div>
            {showRawId ? (
              <div className="font-mono text-[11px]" data-testid="native-chat-model-tooltip-id">{tooltipRawId}</div>
            ) : null}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side={chip ? menuSide : 'bottom'}
          align="start"
          sideOffset={chip ? sideOffset : 4}
          collisionPadding={COMPOSER_MENU_COLLISION_PADDING_PX}
          avoidCollisions
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (skipCloseAutoFocusRef.current) {
              skipCloseAutoFocusRef.current = false
              return
            }
            triggerRef.current?.focus()
          }}
          className={cn(MENU_PANEL_CLASS, chip ? undefined : SETTINGS_MENU_Z_CLASS)}
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
            {(prime ? primeMenu.length : rhizomeMenu.length) === 0 ? (
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
            ) : prime ? (
              primeMenu.map((group, index) => (
                <div key={group.provider}>
                  {index > 0 ? (
                    <div className={GROUP_SEP_CLASS} data-testid="native-chat-model-group-sep" />
                  ) : null}
                  <DropdownMenuLabel
                    className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground normal-case tracking-normal"
                    data-testid="native-chat-model-provider"
                  >
                    <span>{group.provider}</span>
                  </DropdownMenuLabel>
                  {group.models.map((model) => {
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
                          void pick(model.id, model.providerKind)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground" title={model.modelId}>
                          {model.label}
                        </span>
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
            ) : (
              rhizomeMenu.map((group, index) => {
                const loading = loadingNames.includes(group.label) || loadingNames.includes(group.cacheKey)
                const isAccount = group.section === 'accounts'
                const rawHeaderReason = isAccount
                  ? (group.hint && !group.blocked ? group.hint : (group.blocked ? 'Needs sign-in' : null))
                  : (group.blocked ? group.rows.find((row) => row.reason)?.reason : group.hint)
                const hintKey = !isAccount && !group.blocked ? pickerHintI18nKey(group.hint) : null
                const headerReason = hintKey ? t(hintKey) : rawHeaderReason
                const headerAction = group.accountSignIn || group.rows.some((row) => row.action === 'sign_in')
                  ? 'sign_in' as const
                  : group.blocked
                    ? group.rows.find((row) => row.action)?.action ?? null
                    : (!isAccount && group.hint ? 'retry' as const : null)
                const openFix = () => {
                  if (headerAction === 'sign_in') {
                    void oauth.signIn(group.providerId)
                    return
                  }
                  if (headerAction === 'retry') {
                    const provider = providersToListLive(providers).find((item) => providerModelsCacheKey(item) === group.cacheKey || item.id === group.providerId)
                    if (provider) forgetListedProviderModels(provider)
                    setReloadToken((token) => token + 1)
                    return
                  }
                  skipCloseAutoFocusRef.current = true
                  requestProviderSettingsFocus({
                    tab: group.tab === 'agents' ? 'api' : group.tab,
                    rowId: headerAction === 'add_key' ? `summary-provider-row-${group.providerId}` : CONNECTED_SUMMARY_ROW_ID,
                  })
                  onOpenProviders?.()
                  setOpen(false)
                }
                return (
                  <div key={group.id}>
                    {index > 0 ? (
                      <div className={GROUP_SEP_CLASS} data-testid="native-chat-model-group-sep" />
                    ) : null}
                    <DropdownMenuLabel
                      className="flex items-start gap-2 px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground normal-case tracking-normal"
                      data-testid="native-chat-model-provider"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{group.label}</span>
                        {headerReason ? (
                          <span
                            className="mt-0.5 block whitespace-normal font-normal text-muted-foreground"
                            data-testid={
                              isAccount
                                ? 'native-chat-model-account-status'
                                : (group.hint ? 'native-chat-model-offline' : 'native-chat-model-reason')
                            }
                          >
                            {headerReason}
                          </span>
                        ) : null}
                      </span>
                      {loading ? (
                        <span className="font-normal text-muted-foreground" data-testid="native-chat-model-loading">
                          {LOADING_STATUS}
                        </span>
                      ) : null}
                      {headerAction === 'sign_in' ? (
                        <button
                          type="button"
                          className={cn('ml-auto shrink-0 text-[12px] font-normal text-[var(--link-color)] underline-offset-2 hover:underline', CHAT_FOCUS_RING_CLASS)}
                          data-testid="native-chat-model-sign-in"
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation()
                            openFix()
                          }}
                        >
                          {oauth.signingIn && oauth.busyProvider === group.providerId ? 'Waiting…' : 'Sign in with ChatGPT'}
                        </button>
                      ) : null}
                      {isAccount && !group.blocked ? (
                        <button
                          type="button"
                          className={cn('ml-auto shrink-0 text-[12px] font-normal text-[var(--link-color)] underline-offset-2 hover:underline', CHAT_FOCUS_RING_CLASS)}
                          data-testid="native-chat-model-sign-out"
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation()
                            void oauth.signOut(group.providerId)
                          }}
                        >
                          Sign out
                        </button>
                      ) : null}
                      {headerAction === 'add_key' ? (
                        <button
                          type="button"
                          className={cn('ml-auto shrink-0 text-[12px] font-normal text-[var(--link-color)] underline-offset-2 hover:underline', CHAT_FOCUS_RING_CLASS)}
                          data-testid="native-chat-model-add-key"
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation()
                            openFix()
                          }}
                        >
                          {t('ai.composer.addKey')}
                        </button>
                      ) : null}
                      {headerAction === 'retry' ? (
                        <button
                          type="button"
                          className={cn('ml-auto shrink-0 text-[12px] font-normal text-[var(--link-color)] underline-offset-2 hover:underline', CHAT_FOCUS_RING_CLASS)}
                          data-testid="native-chat-model-retry"
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation()
                            openFix()
                          }}
                        >
                          {t('ai.composer.retryModels')}
                        </button>
                      ) : null}
                    </DropdownMenuLabel>
                    {group.rows.filter((row) => row.modelId).map((row) => {
                      const isSelected = row.id === selectedId
                      return (
                        <DropdownMenuItem
                          key={row.id}
                          ref={isSelected ? selectedRowRef : undefined}
                          className={cn(ROW_CLASS, row.disabled && 'text-muted-foreground')}
                          title={row.modelId}
                          aria-disabled={row.disabled || undefined}
                          data-testid={`native-chat-model-${row.id}`}
                          data-selected={isSelected ? 'true' : undefined}
                          onSelect={(event) => {
                            if (row.disabled) {
                              event.preventDefault()
                              if (row.action) openFix()
                              return
                            }
                            void pick(row.id, row.providerKind)
                          }}
                        >
                          <span className={cn('min-w-0 flex-1 truncate', row.disabled ? 'text-muted-foreground' : 'text-foreground')} title={row.modelId}>
                            {row.label}
                          </span>
                          {visionById[row.id] === 'yes' ? (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground" data-testid="native-chat-model-vision">
                              {t('ai.composer.vision')}
                            </span>
                          ) : null}
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
                )
              })
            )}
          </div>
          {showFooter ? (
            <div className="shrink-0" data-testid="native-chat-model-footer">
              <div className={GROUP_SEP_CLASS} data-testid="native-chat-model-footer-sep" />
              {unsetCount > 0 ? (
                <div className="px-2 py-1.5" data-testid="native-chat-model-open-providers">
                  <button
                    type="button"
                    className={cn(
                      'rounded-sm text-left text-[12px] font-normal text-[var(--link-color)] underline-offset-2',
                      'hover:underline',
                      CHAT_FOCUS_RING_CLASS,
                    )}
                    data-testid="native-chat-model-open-settings"
                    onPointerDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      skipCloseAutoFocusRef.current = true
                      requestProviderSettingsFocus({ tab: 'agents', rowId: CONNECTED_SUMMARY_ROW_ID })
                      onOpenProviders?.()
                      setOpen(false)
                    }}
                  >
                    <span data-testid="native-chat-model-keyless-note">
                      {unsetCount === 1
                        ? t('ai.composer.providerNeedsAttention')
                        : t('ai.composer.providersNeedAttention', { count: String(unsetCount) })}
                    </span>
                  </button>
                </div>
              ) : null}
              <p
                className="px-2 py-1.5 text-[12px] text-muted-foreground"
                data-testid="native-chat-model-new-chats"
              >
                {footnote}
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
