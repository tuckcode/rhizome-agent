import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { CircleNotch as Loader2, DotsThree, MagnifyingGlass, Plus, SidebarSimple, X } from '@phosphor-icons/react'
import type { VaultEntry } from '../../types'
import type { SortOption, SortDirection } from '../../utils/noteListHelpers'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../../hooks/appCommandDispatcher'
import { trackEvent } from '../../lib/telemetry'
import { useDragRegion } from '../../hooks/useDragRegion'
import { NotesChromeShortcuts } from '../NotesChromeShortcuts'
import { SortDropdown } from '../SortDropdown'
import { ListPropertiesPopover, type ListPropertiesPopoverProps } from './ListPropertiesPopover'
import { GitRepositorySelect } from '../GitRepositorySelect'
import type { GitRepositoryOption } from '../../utils/gitRepositories'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  hasNativeMacosTrafficLights,
  MACOS_TRAFFIC_LIGHT_SAFE_PADDING,
} from '../../utils/trafficLights'

const NOTE_LIST_ACTION_BUTTON_CLASSNAME = '!h-[32px] !w-[32px] !min-w-[32px] !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent data-[state=open]:!bg-accent data-[state=open]:!text-foreground [&_svg]:!size-4'
const NOTE_LIST_EXPAND_BUTTON_CLASSNAME = '!h-[32px] !w-[32px] !min-w-[32px] !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-4'
const PROPERTY_TRIGGER_TITLE_KEYS: Record<string, TranslationKey> = {
  'Customize columns': 'noteList.properties.customizeColumns',
  'Customize All Notes columns': 'noteList.properties.customizeAllColumns',
  'Customize Inbox columns': 'noteList.properties.customizeInboxColumns',
}

const localizePropertiesTriggerTitle = (triggerTitle: string, locale: AppLocale): string => {
  const titleKey = PROPERTY_TRIGGER_TITLE_KEYS[triggerTitle]
  if (titleKey) return translate(locale, titleKey)
  return localizeViewPropertiesTriggerTitle(triggerTitle, locale)
}

const localizeViewPropertiesTriggerTitle = (triggerTitle: string, locale: AppLocale): string => {
  return triggerTitle.replace(/^Customize (.+) columns$/, (_match, name: string) => {
    return translate(locale, 'noteList.properties.customizeViewColumns', { name })
  })
}

interface NoteListHeaderProps {
  title: string
  typeDocument: VaultEntry | null
  isEntityView: boolean
  isChangesView?: boolean
  listSort: SortOption
  listDirection: SortDirection
  customProperties: string[]
  sidebarCollapsed?: boolean
  searchVisible: boolean
  search: string
  isSearching: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  propertyPicker?: ListPropertiesPopoverProps | null
  gitRepositories?: GitRepositoryOption[]
  selectedGitRepositoryPath?: string
  locale?: AppLocale
  onSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  onCreateNote: () => void
  onOpenType: (entry: VaultEntry) => void
  onToggleSearch: () => void
  onSearchChange: (value: string) => void
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onGitRepositoryChange?: (path: string) => void
}

function dispatchExpandSidebarFromHeader() {
  trackEvent('sidebar_expanded_from_note_list_header')
  window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
    detail: APP_COMMAND_IDS.viewAll,
  }))
}

function ExpandSidebarButton({ locale }: { locale: AppLocale }) {
  const expandSidebarLabel = translate(locale, 'sidebar.action.expand')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={NOTE_LIST_EXPAND_BUTTON_CLASSNAME}
      onClick={dispatchExpandSidebarFromHeader}
      title={expandSidebarLabel}
      aria-label={expandSidebarLabel}
      data-no-drag
    >
      <SidebarSimple size={16} weight="regular" />
    </Button>
  )
}

/**
 * Truncates with an ellipsis instead of the C78 fixed-width, never-shrink
 * approach: that kept "Changes" readable but let text spill past its own box
 * into the space held by the trailing chrome shortcuts / sort / columns
 * group, which then painted over it (Astra 2026-09-26 repro: shortcuts box
 * drawn on top of "Notes" at ~520px). `truncate` (overflow-hidden +
 * ellipsis) plus a `min-w-[5.5rem]` floor keeps the title fully visible for
 * ordinary titles and cleanly ellipsized instead of overlapped when the row
 * is genuinely too tight.
 */
const HEADER_TITLE_CLASSNAME = 'm-0 min-w-[5.5rem] max-w-full flex-1 truncate text-[14px] font-semibold'

function HeaderTitle({
  title,
  typeDocument,
  onOpenType,
  titleRef,
}: Pick<NoteListHeaderProps, 'title' | 'typeDocument' | 'onOpenType'> & {
  titleRef: RefObject<HTMLElement | null>
}) {
  const handleClick = typeDocument ? () => onOpenType(typeDocument) : undefined

  if (typeDocument && handleClick) {
    return (
      <button
        ref={titleRef as RefObject<HTMLButtonElement>}
        type="button"
        className={`${HEADER_TITLE_CLASSNAME} border-0 bg-transparent p-0 text-left`}
        onClick={handleClick}
        data-testid="type-header-link"
      >
        {title}
      </button>
    )
  }

  return (
    <h3
      ref={titleRef as RefObject<HTMLHeadingElement>}
      className={HEADER_TITLE_CLASSNAME}
    >
      {title}
    </h3>
  )
}

function HeaderLeading({
  title,
  typeDocument,
  sidebarCollapsed,
  locale,
  onOpenType,
  titleRef,
}: Pick<NoteListHeaderProps, 'title' | 'typeDocument' | 'sidebarCollapsed' | 'locale' | 'onOpenType'> & {
  locale: AppLocale
  titleRef: RefObject<HTMLElement | null>
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {sidebarCollapsed && <ExpandSidebarButton locale={locale} />}
      <HeaderTitle title={title} typeDocument={typeDocument} onOpenType={onOpenType} titleRef={titleRef} />
    </div>
  )
}

/**
 * Moves the workspace shortcuts / sort / columns group into the "…" overflow
 * menu once the title is actually being truncated, rather than letting those
 * fixed-size, shrink-0 controls crowd it out. Mirrors the pattern in
 * `BreadcrumbBar`'s `useBreadcrumbOverflow`, simplified to a single
 * scrollWidth-vs-clientWidth check since this title has no sibling crumbs to
 * measure around.
 */
/**
 * Move optional tools into "…" once the title row cannot hold them.
 *
 * Measures the title, its flex wrapper, and the row: the wrapper can be
 * squeezed to nothing while the title keeps its own minimum width and
 * spills under the tools, which a title-only check never sees (browser
 * preview, 2026-09-26). Collapsing frees exactly the room that made the
 * title fit, so re-expanding waits until the row is as wide as it needed
 * to be; otherwise the header flips back and forth on every measure.
 */
function useNoteListHeaderOverflow(titleRef: RefObject<HTMLElement | null>) {
  const [collapsed, setCollapsed] = useState(false)
  const neededRowWidth = useRef<number | null>(null)

  useLayoutEffect(() => {
    const title = titleRef.current
    const wrapper = title?.parentElement
    const row = wrapper?.parentElement
    if (!title || !wrapper || !row) return undefined

    let frame = 0
    const measure = () => {
      const rowWidth = row.clientWidth
      if (rowWidth <= 0) return
      const shortfall = Math.max(
        title.scrollWidth - title.clientWidth,
        wrapper.scrollWidth - wrapper.clientWidth,
        row.scrollWidth - row.clientWidth,
      )
      if (!collapsed && shortfall > 1) {
        neededRowWidth.current = rowWidth + shortfall
        setCollapsed(true)
      } else if (collapsed && neededRowWidth.current !== null && rowWidth >= neededRowWidth.current) {
        neededRowWidth.current = null
        setCollapsed(false)
      }
    }
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    scheduleMeasure()
    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(row)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  })

  return collapsed
}

function RepositorySelectorRow({
  isChangesView,
  gitRepositories = [],
  selectedGitRepositoryPath = '',
  locale = 'en',
  onGitRepositoryChange,
}: Pick<
  NoteListHeaderProps,
  | 'isChangesView'
  | 'gitRepositories'
  | 'selectedGitRepositoryPath'
  | 'locale'
  | 'onGitRepositoryChange'
>) {
  if (!isChangesView || !onGitRepositoryChange || gitRepositories.length <= 1) return null

  return (
    <div className="flex h-11 shrink-0 items-center border-b border-border px-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <GitRepositorySelect
        label={translate(locale, 'git.repository.select')}
        repositories={gitRepositories}
        selectedPath={selectedGitRepositoryPath}
        onChange={onGitRepositoryChange}
        testId="changes-repository-select"
      />
    </div>
  )
}

/**
 * Renders the sort dropdown and columns popover exactly once — either here,
 * inline, or inside `HeaderOverflowMenu` — never both at once, so tests that
 * look up `sort-button-__list__` (a single element) keep working regardless
 * of which layout is active.
 */
function SortAndColumnsTools({
  isEntityView,
  listSort,
  listDirection,
  customProperties,
  propertyPicker,
  locale,
  onSortChange,
}: Pick<
  NoteListHeaderProps,
  'isEntityView' | 'listSort' | 'listDirection' | 'customProperties' | 'propertyPicker' | 'onSortChange'
> & {
  locale: AppLocale
}) {
  return (
    <>
      {!isEntityView && <SortDropdown groupLabel="__list__" current={listSort} direction={listDirection} customProperties={customProperties} locale={locale} onChange={onSortChange} />}
      {propertyPicker && (
        <ListPropertiesPopover
          {...propertyPicker}
          triggerTitle={localizePropertiesTriggerTitle(propertyPicker.triggerTitle, locale)}
          triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
          locale={locale}
        />
      )}
    </>
  )
}

type OptionalToolsProps = Pick<
  NoteListHeaderProps,
  'isEntityView' | 'listSort' | 'listDirection' | 'customProperties' | 'propertyPicker' | 'onSortChange'
> & {
  locale: AppLocale
  collapsed: boolean
}

/** The workspace shortcuts group plus sort/columns — an "optional tools"
 * cluster (required-order step 2) that moves into the overflow menu before
 * the title has to shrink below its floor. */
function HeaderOptionalTools({ collapsed, locale, ...sortProps }: OptionalToolsProps) {
  if (collapsed) return null
  return (
    <div className="flex shrink-0 items-center gap-2" data-testid="note-list-header-optional-tools">
      <NotesChromeShortcuts locale={locale} />
      <SortAndColumnsTools locale={locale} {...sortProps} />
    </div>
  )
}

function HeaderOverflowMenu({ collapsed, locale, ...sortProps }: OptionalToolsProps) {
  if (!collapsed) return null
  // Inline English string — this repo does not add new en.json keys (C18).
  const label = 'More list actions'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
          title={label}
          aria-label={label}
          data-testid="note-list-header-overflow-trigger"
        >
          <DotsThree size={16} weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="note-list-header-overflow-menu">
        <div className="flex flex-col gap-1 px-1 py-1" onClick={(event) => event.stopPropagation()}>
          <NotesChromeShortcuts locale={locale} />
          <div className="flex items-center gap-2">
            <SortAndColumnsTools locale={locale} {...sortProps} />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HeaderActions({
  onCreateNote,
  onToggleSearch,
  locale,
}: Pick<NoteListHeaderProps, 'onCreateNote' | 'onToggleSearch'> & {
  locale: AppLocale
}) {
  return (
    <div className="ml-3 flex shrink-0 items-center justify-end gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onClick={onToggleSearch} title={translate(locale, 'noteList.searchAction')} aria-label={translate(locale, 'noteList.searchAction')}>
        <MagnifyingGlass size={16} />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onClick={onCreateNote} title={translate(locale, 'noteList.createNote')} aria-label={translate(locale, 'noteList.createNote')}>
        <Plus size={16} />
      </Button>
    </div>
  )
}

function SearchRow({
  searchVisible,
  search,
  isSearching,
  searchInputRef,
  locale,
  onSearchChange,
  onSearchKeyDown,
}: Pick<
  NoteListHeaderProps,
  | 'searchVisible'
  | 'search'
  | 'isSearching'
  | 'searchInputRef'
  | 'locale'
  | 'onSearchChange'
  | 'onSearchKeyDown'
> & {
  locale: AppLocale
}) {
  if (!searchVisible) return null

  const hasSearch = search.length > 0
  const clearLabel = translate(locale, 'noteList.clearSearch')

  const handleClearSearch = () => {
    onSearchChange('')
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  return (
    <div className="border-b border-border px-3 py-2">
      <div className="relative flex-1" aria-live="polite">
        <Input
          ref={searchInputRef}
          placeholder={translate(locale, 'noteList.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          className="h-8 pr-16 text-[13px]"
        />
        {hasSearch && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute inset-y-1 right-8 !h-6 !w-6 !min-w-0 !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-3"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClearSearch}
            title={clearLabel}
            aria-label={clearLabel}
          >
            <X size={12} />
          </Button>
        )}
        {isSearching && (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
            data-testid="note-list-search-loading"
          >
            <Loader2 size={12} className="animate-spin" />
          </span>
        )}
      </div>
    </div>
  )
}

export function NoteListHeader({
  title,
  typeDocument,
  isEntityView,
  isChangesView = false,
  listSort,
  listDirection,
  customProperties,
  sidebarCollapsed,
  searchVisible,
  search,
  isSearching,
  searchInputRef,
  propertyPicker,
  gitRepositories = [],
  selectedGitRepositoryPath = '',
  locale = 'en',
  onSortChange,
  onCreateNote,
  onOpenType,
  onToggleSearch,
  onSearchChange,
  onSearchKeyDown,
  onGitRepositoryChange,
}: NoteListHeaderProps) {
  const { dragRegionRef } = useDragRegion<HTMLDivElement>()
  const titleRef = useRef<HTMLElement | null>(null)
  const collapsed = useNoteListHeaderOverflow(titleRef)
  const collapsedSidebarPadding = sidebarCollapsed && hasNativeMacosTrafficLights()
    ? MACOS_TRAFFIC_LIGHT_SAFE_PADDING
    : undefined
  const optionalToolsProps = {
    isEntityView,
    listSort,
    listDirection,
    customProperties,
    propertyPicker,
    onSortChange,
    locale,
  }

  return (
    <>
      <div ref={dragRegionRef} className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4" style={{ cursor: 'default', paddingLeft: collapsedSidebarPadding }}>
        <HeaderLeading
          title={title}
          typeDocument={typeDocument}
          sidebarCollapsed={sidebarCollapsed}
          locale={locale}
          onOpenType={onOpenType}
          titleRef={titleRef}
        />
        <HeaderOptionalTools collapsed={collapsed} {...optionalToolsProps} />
        <HeaderOverflowMenu collapsed={collapsed} {...optionalToolsProps} />
        <HeaderActions
          onCreateNote={onCreateNote}
          onToggleSearch={onToggleSearch}
          locale={locale}
        />
      </div>
      <RepositorySelectorRow
        isChangesView={isChangesView}
        gitRepositories={gitRepositories}
        selectedGitRepositoryPath={selectedGitRepositoryPath}
        locale={locale}
        onGitRepositoryChange={onGitRepositoryChange}
      />
      <SearchRow
        searchVisible={searchVisible}
        search={search}
        isSearching={isSearching}
        searchInputRef={searchInputRef}
        locale={locale}
        onSearchChange={onSearchChange}
        onSearchKeyDown={onSearchKeyDown}
      />
    </>
  )
}
