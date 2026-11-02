import { Cube, Info, Monitor, Moon, Stack, Sun, X } from '@phosphor-icons/react'
import {
  createMissingAiAgentsStatus,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  normalizeAiModelProviders,
  type AiModelProvider,
} from '../lib/aiTargets'
import { NativeChatModelPicker } from './NativeChatModelPicker'
import { ConnectedProvidersSummary } from './ConnectedProvidersSummary'
import { useOauthAccounts } from '../lib/useOauthAccounts'
import { LocalAgentCards } from './LocalAgentCards'
import {
  CONNECTED_SUMMARY_ROW_ID,
  clearSettingsOpenAutofocusSuppress,
  consumeProviderSettingsFocus,
  isSettingsOpenAutofocusSuppressed,
  subscribeProviderSettingsFocus,
  type ProviderSettingsTab,
} from '../lib/providerSettingsFocus'
import type { ConnectedRow } from '../lib/connectedProviders'
import { resetListProviderModelsCache } from '../lib/listProviderModels'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { Settings } from '../types'
import {
  APP_LOCALES,
  SYSTEM_UI_LANGUAGE,
  createTranslator,
  localeDisplayName,
  resolveEffectiveLocale,
  serializeUiLanguagePreference,
  type AppLocale,
  type UiLanguagePreference,
} from '../lib/i18n'
import {
  applyAppearanceToDocument,
  appearancePickerOptions,
  clearStoredColorTheme,
  colorThemeFollowsMode,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_THEME,
  DEFAULT_THEME_MODE,
  DUAL_MODE_COLOR_THEME,
  isAppearancePickerOptionSelected,
  normalizeColorTheme,
  readStoredAccentColor,
  readStoredColorTheme,
  readStoredThemeMode,
  resolveStoredColorTheme,
  resolveThemeMode,
  THEME_MODE_PICKER_ORDER,
  writeStoredAccentColor,
  writeStoredColorTheme,
  writeStoredThemeMode,
  type AccentColor,
  type ThemeMode,
} from '../lib/themeMode'
import { cn } from '@/lib/utils'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { AccentColorPicker } from './AccentColorPicker'
import { normalizeReleaseChannel, serializeReleaseChannel, type ReleaseChannel } from '../lib/releaseChannel'
import { shouldHideGitignoredFiles } from '../lib/gitignoredVisibility'
import {
  SECRET_FILE_PATTERN_LINES,
  SECRET_FILES_HELPER_OFF,
  SECRET_FILES_HELPER_ON,
  SECRET_FILES_LABEL,
  shouldBlockSecretFiles,
} from '../lib/secretFiles'
import { areGitFeaturesEnabled } from '../lib/gitSettings'
import { areAutomaticUpdateChecksEnabled } from '../lib/automaticUpdateChecks'
import { trackAllNotesVisibilityChanged } from '../lib/productAnalytics'
import { AiProviderSettings } from './AiProviderSettings'
import { readCelebrationsEnabled } from '../lib/celebration'
import { GitSettingsSection } from './GitSettingsSection'
import { PrivacySettingsSection } from './PrivacySettingsSection'
import { AboutSettingsSection } from './AboutSettingsSection'
import { SessionImportSettingsSection } from './SessionImportSettingsSection'
import { SettingsBodyNav } from './SettingsBodyNav'
import {
  SectionHeading,
  SelectControl,
  SettingsGroup,
  SettingsGroupItem,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
  SettingsSwitchControl,
} from './SettingsControls'
import { SettingsFooter } from './SettingsFooter'
import { VaultContentSettingsSection } from './VaultContentSettingsSection'
import { WorkspaceSettingsSection } from './WorkspaceSettingsSection'
import {
  resolveAllNotesFileVisibility,
  settingsWithAllNotesFileVisibility,
  type AllNotesFileVisibility,
} from '../utils/allNotesFileVisibility'
import { DEFAULT_NOTE_WIDTH_MODE, normalizeNoteWidthMode } from '../utils/noteWidth'
import {
  getVaultConfig,
  subscribeVaultConfig,
  updateVaultConfigField,
} from '../utils/vaultConfigStore'
import {
  DEFAULT_DATE_DISPLAY_FORMAT,
  normalizeDateDisplayFormat,
  normalizeDisplayTimeZone,
  type DateDisplayFormat,
} from '../utils/dateDisplay'
import { BridgeTokenRow } from './BridgeTokenRow'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import type { NoteWidthMode } from '../types'
import type { VaultOption } from './status-bar/types'
import {
  SETTINGS_SECTION_IDS,
  resolveSettingsSectionId,
} from './settingsSectionIds'
import {
  trackSettingsPreferenceChanges,
  trackTelemetryConsentChange,
} from './settingsPreferenceTracking'
import { useSettingsPanelAutofocus, useSettingsPanelFocusTrap } from './useSettingsPanelFocus'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  aiAgentsStatus?: AiAgentsStatus
  initialSectionId?: string | null
  locale?: AppLocale
  systemLocale?: AppLocale
  onSave: (settings: Settings) => void
  onSavePatch?: (patch: Partial<Settings>) => void
  loadError?: string | null
  onCopyMcpConfig?: () => void
  vaults?: VaultOption[]
  activeVaultPath?: string | null
  defaultWorkspacePath?: string | null
  onRemoveVault?: (path: string) => void; onReorderVaults?: (orderedPaths: string[]) => void; onSetDefaultWorkspace?: (path: string) => void; onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  isGitVault?: boolean
  explicitOrganizationEnabled?: boolean
  onSaveExplicitOrganization?: (enabled: boolean) => void
  inboxAutomationEnabled?: boolean
  onSaveInboxAutomation?: (enabled: boolean) => void
  onAdoptPortentTypes?: () => void
  onOpenFeedback?: () => void
  onOpenDocs?: () => void
  onClose: () => void
}

interface SettingsDraft {
  pullInterval: number
  gitFeaturesEnabled: boolean
  autoGitEnabled: boolean
  autoGitIdleThresholdSeconds: number
  autoGitInactiveThresholdSeconds: number
  autoAdvanceInboxAfterOrganize: boolean
  celebrationsEnabled: boolean
  keepInTaskbarOnClose: boolean
  agentProfile: string
  agentMaxSteps: number
  nativeChatTarget: string | null
  aiModelProviders: AiModelProvider[]
  releaseChannel: ReleaseChannel
  automaticUpdateChecksEnabled: boolean
  themeMode: ThemeMode
  colorTheme: string
  accentColor: AccentColor
  uiLanguage: UiLanguagePreference
  dateDisplayFormat: DateDisplayFormat
  displayTimeZone: string | null
  defaultNoteWidth: NoteWidthMode
  sidebarTypePluralizationEnabled: boolean
  initialH1AutoRename: boolean
  hideGitignoredFiles: boolean
  blockSecretFiles: boolean
  allNotesFileVisibility: AllNotesFileVisibility
  multiWorkspaceEnabled: boolean
  crashReporting: boolean
  analytics: boolean
  explicitOrganization: boolean
  inboxAutomationEnabled: boolean
}

interface SettingsBodyProps {
  t: Translate
  pullInterval: number
  setPullInterval: (value: number) => void
  gitFeaturesEnabled: boolean
  setGitFeaturesEnabled: (value: boolean) => void
  isGitVault: boolean
  autoGitEnabled: boolean
  setAutoGitEnabled: (value: boolean) => void
  autoGitIdleThresholdSeconds: number
  setAutoGitIdleThresholdSeconds: (value: number) => void
  autoGitInactiveThresholdSeconds: number
  setAutoGitInactiveThresholdSeconds: (value: number) => void
  autoAdvanceInboxAfterOrganize: boolean
  setAutoAdvanceInboxAfterOrganize: (value: boolean) => void
  celebrationsEnabled: boolean
  setCelebrationsEnabled: (value: boolean) => void
  keepInTaskbarOnClose: boolean
  setKeepInTaskbarOnClose: (value: boolean) => void
  agentProfile: string
  agentMaxSteps: number
  setAgentProfile: (value: string) => void
  setAgentMaxSteps: (value: number) => void
  nativeChatTarget: string | null
  setNativeChatTarget: (value: string) => void
  aiAgentsStatus: AiAgentsStatus
  aiModelProviders: AiModelProvider[]
  setAiModelProviders: (value: AiModelProvider[]) => void
  onCopyMcpConfig?: () => void
  onAdoptPortentTypes?: () => void
  releaseChannel: ReleaseChannel
  setReleaseChannel: (value: ReleaseChannel) => void
  automaticUpdateChecksEnabled: boolean
  setAutomaticUpdateChecksEnabled: (value: boolean) => void
  themeMode: ThemeMode
  setThemeMode: (value: ThemeMode) => void
  colorTheme: string
  setColorTheme: (value: string, mode?: ThemeMode) => void
  accentColor: AccentColor
  setAccentColor: (value: AccentColor) => void
  uiLanguage: UiLanguagePreference
  setUiLanguage: (value: UiLanguagePreference) => void
  dateDisplayFormat: DateDisplayFormat
  setDateDisplayFormat: (value: DateDisplayFormat) => void
  displayTimeZone: string | null
  setDisplayTimeZone: (value: string | null) => void
  defaultNoteWidth: NoteWidthMode
  setDefaultNoteWidth: (value: NoteWidthMode) => void
  sidebarTypePluralizationEnabled: boolean
  setSidebarTypePluralizationEnabled: (value: boolean) => void
  locale: AppLocale
  systemLocale: AppLocale
  initialH1AutoRename: boolean
  setInitialH1AutoRename: (value: boolean) => void
  hideGitignoredFiles: boolean
  setHideGitignoredFiles: (value: boolean) => void
  blockSecretFiles: boolean
  setBlockSecretFiles: (value: boolean) => void
  allNotesFileVisibility: AllNotesFileVisibility
  setAllNotesFileVisibility: (value: AllNotesFileVisibility) => void
  multiWorkspaceEnabled: boolean
  setMultiWorkspaceEnabled: (value: boolean) => void
  vaults: VaultOption[]
  activeVaultPath?: string | null
  defaultWorkspacePath?: string | null
  onRemoveVault?: (path: string) => void; onReorderVaults?: (orderedPaths: string[]) => void; onSetDefaultWorkspace?: (path: string) => void; onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  explicitOrganization: boolean
  setExplicitOrganization: (value: boolean) => void
  inboxAutomationEnabled: boolean
  setInboxAutomationEnabled: (value: boolean) => void
  crashReporting: boolean
  setCrashReporting: (value: boolean) => void
  analytics: boolean
  setAnalytics: (value: boolean) => void
  onOpenFeedback?: () => void
  onOpenDocs?: () => void
  initialSectionId?: string | null
  onClose?: () => void
}

const PULL_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30] as const
const DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS = 90
const DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS = 30
type Translate = ReturnType<typeof createTranslator>

function isSaveShortcut(event: { ctrlKey: boolean; key: string; metaKey: boolean }): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

function isNestedSettingsOverlay(target: EventTarget | null, panel: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-settings-panel-portal="true"], [role="listbox"], [role="menu"]')) return true
  const dialog = target.closest('[role="dialog"]')
  return dialog !== null && dialog !== panel
}

function createSettingsDraft(
  settings: Settings,
  explicitOrganizationEnabled: boolean,
  inboxAutomationEnabled: boolean,
): SettingsDraft {
  return {
    pullInterval: settings.auto_pull_interval_minutes ?? 5,
    gitFeaturesEnabled: areGitFeaturesEnabled(settings),
    autoGitEnabled: settings.autogit_enabled ?? false,
    autoGitIdleThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_idle_threshold_seconds,
      DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS,
    ),
    autoGitInactiveThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_inactive_threshold_seconds,
      DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS,
    ),
    autoAdvanceInboxAfterOrganize: settings.auto_advance_inbox_after_organize ?? false,
    // Absent means never chosen, which is on: the effect is opt-out.
    celebrationsEnabled: readCelebrationsEnabled(settings.celebrations_enabled),
    keepInTaskbarOnClose: settings.keep_in_taskbar_on_close === true,
    agentProfile: settings.agent_profile?.trim() ?? '',
    agentMaxSteps: settings.agent_max_steps ?? 50,
    nativeChatTarget: settings.native_chat_target ?? null,
    aiModelProviders: normalizeAiModelProviders(settings.ai_model_providers),
    releaseChannel: normalizeReleaseChannel(settings.release_channel),
    automaticUpdateChecksEnabled: areAutomaticUpdateChecksEnabled(settings),
    themeMode: resolveSettingsDraftThemeMode(settings.theme_mode),
    colorTheme: resolveSettingsDraftColorTheme(settings.color_theme),
    accentColor: resolveSettingsDraftAccentColor(settings.accent_color),
    uiLanguage: settings.ui_language ?? SYSTEM_UI_LANGUAGE,
    dateDisplayFormat: normalizeDateDisplayFormat(settings.date_display_format) ?? DEFAULT_DATE_DISPLAY_FORMAT,
    displayTimeZone: normalizeDisplayTimeZone(settings.timezone),
    defaultNoteWidth: normalizeNoteWidthMode(settings.note_width_mode) ?? DEFAULT_NOTE_WIDTH_MODE,
    sidebarTypePluralizationEnabled: settings.sidebar_type_pluralization_enabled ?? true,
    initialH1AutoRename: settings.initial_h1_auto_rename_enabled ?? true,
    hideGitignoredFiles: shouldHideGitignoredFiles(settings),
    blockSecretFiles: shouldBlockSecretFiles(settings),
    allNotesFileVisibility: resolveAllNotesFileVisibility(settings),
    multiWorkspaceEnabled: settings.multi_workspace_enabled === true,
    crashReporting: settings.crash_reporting_enabled ?? false,
    analytics: settings.analytics_enabled ?? false,
    explicitOrganization: explicitOrganizationEnabled,
    inboxAutomationEnabled,
  }
}

function resolveSettingsDraftThemeMode(themeMode: Settings['theme_mode']): ThemeMode {
  if (themeMode) return themeMode
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  return readStoredThemeMode(window.localStorage) ?? DEFAULT_THEME_MODE
}

function resolveSettingsDraftColorTheme(
  colorTheme: Settings['color_theme'],
): string {
  const storedColor = colorTheme || (typeof window === 'undefined' ? null : readStoredColorTheme(window.localStorage))
  if (storedColor && storedColor !== DEFAULT_COLOR_THEME) return storedColor
  return ''
}

function resolveSettingsDraftAccentColor(accentColor: Settings['accent_color']): AccentColor {
  if (accentColor) return accentColor
  if (typeof window === 'undefined') return DEFAULT_ACCENT_COLOR
  return readStoredAccentColor(window.localStorage) ?? DEFAULT_ACCENT_COLOR
}

function resolveTelemetryConsent(settings: Settings, draft: SettingsDraft): boolean | null {
  if (draft.crashReporting || draft.analytics) return true
  return settings.telemetry_consent === null ? null : false
}

function resolveAnonymousId(settings: Settings, draft: SettingsDraft): string | null {
  if (draft.crashReporting || draft.analytics) {
    return settings.anonymous_id ?? crypto.randomUUID()
  }

  return settings.anonymous_id
}

function buildSettingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  const nextSettings = {
    ...settings,
    auto_pull_interval_minutes: draft.pullInterval,
    git_enabled: draft.gitFeaturesEnabled,
    autogit_enabled: draft.autoGitEnabled,
    autogit_idle_threshold_seconds: draft.autoGitIdleThresholdSeconds,
    autogit_inactive_threshold_seconds: draft.autoGitInactiveThresholdSeconds,
    auto_advance_inbox_after_organize: draft.autoAdvanceInboxAfterOrganize,
    telemetry_consent: resolveTelemetryConsent(settings, draft),
    crash_reporting_enabled: draft.crashReporting,
    analytics_enabled: draft.analytics,
    anonymous_id: resolveAnonymousId(settings, draft),
    release_channel: serializeReleaseChannel(draft.releaseChannel),
    automatic_update_checks_enabled: draft.automaticUpdateChecksEnabled ? null : false,
    theme_mode: draft.themeMode,
    color_theme: draft.colorTheme || null,
    accent_color: draft.accentColor,
    ui_language: serializeUiLanguagePreference(draft.uiLanguage),
    date_display_format: draft.dateDisplayFormat,
    timezone: draft.displayTimeZone,
    note_width_mode: draft.defaultNoteWidth,
    sidebar_type_pluralization_enabled: draft.sidebarTypePluralizationEnabled,
    initial_h1_auto_rename_enabled: draft.initialH1AutoRename,
    celebrations_enabled: draft.celebrationsEnabled,
    keep_in_taskbar_on_close: draft.keepInTaskbarOnClose ? true : null,
    agent_profile: draft.agentProfile.trim() || null,
    agent_max_steps: draft.agentMaxSteps,
    chat_engine: 'native',
    native_chat_target: draft.nativeChatTarget,
    ai_model_providers: draft.aiModelProviders.length > 0 ? draft.aiModelProviders : null,
    hide_gitignored_files: draft.hideGitignoredFiles,
    block_secret_files: draft.blockSecretFiles,
    multi_workspace_enabled: draft.multiWorkspaceEnabled,
  }
  return settingsWithAllNotesFileVisibility(nextSettings, draft.allNotesFileVisibility)
}

function assignSettingsPatch<K extends keyof Settings>(patch: Partial<Settings>, key: K, value: Settings[K]) {
  patch[key] = value
}

/** Settings keys whose draft values differ. Other keys stay on the object already in memory. */
function settingsPatchFromDraft(
  baseline: SettingsDraft,
  draft: SettingsDraft,
  settings: Settings,
): Partial<Settings> {
  const before = buildSettingsFromDraft(settings, baseline)
  const after = buildSettingsFromDraft(settings, draft)
  const patch: Partial<Settings> = {}
  const keys = new Set<keyof Settings>([
    ...(Object.keys(before) as Array<keyof Settings>),
    ...(Object.keys(after) as Array<keyof Settings>),
  ])
  keys.forEach((key) => {
    if (!Object.is(before[key], after[key])) assignSettingsPatch(patch, key, after[key])
  })
  return patch
}

function sanitizePositiveInteger(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1) return fallback
  return Math.round(value)
}

function persistableColorTheme(colorTheme: string, mode: ThemeMode): string | null {
  const persistedColor = normalizeColorTheme(colorTheme)
  if (!persistedColor || persistedColor === DEFAULT_COLOR_THEME) return null
  if (persistedColor === DUAL_MODE_COLOR_THEME && mode !== 'dark') return null
  return persistedColor
}

function applyAppearanceSelection(mode: ThemeMode, colorTheme: string, accentColor: AccentColor): void {
  const matchMedia = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined
  const persistedColor = persistableColorTheme(colorTheme, mode)
  const selectedColor = persistedColor ?? resolveStoredColorTheme(null, mode, matchMedia)
  if (typeof document !== 'undefined') {
    applyAppearanceToDocument(document, { mode, colorTheme: selectedColor, accentColor }, matchMedia)
  }
  if (typeof window !== 'undefined') {
    writeStoredThemeMode(window.localStorage, mode)
    if (persistedColor) writeStoredColorTheme(window.localStorage, persistedColor)
    else clearStoredColorTheme(window.localStorage)
    writeStoredAccentColor(window.localStorage, accentColor)
  }
}

export function SettingsPanel({
  open,
  settings,
  aiAgentsStatus = createMissingAiAgentsStatus(),
  initialSectionId = null,
  locale = 'en',
  systemLocale = locale,
  onSave,
  onSavePatch,
  loadError = null,
  onCopyMcpConfig,
  vaults = [],
  activeVaultPath = null,
  defaultWorkspacePath = null,
  onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity,
  isGitVault = true,
  explicitOrganizationEnabled = true,
  onSaveExplicitOrganization,
  inboxAutomationEnabled = true,
  onSaveInboxAutomation,
  onAdoptPortentTypes,
  onOpenFeedback,
  onOpenDocs,
  onClose,
}: SettingsPanelProps) {
  const [beenOpen, setBeenOpen] = useState(open)
  if (open && !beenOpen) setBeenOpen(true)
  if (!beenOpen) return null

  return (
    <SettingsPanelInner
      open={open}
      settings={settings}
      aiAgentsStatus={aiAgentsStatus}
      initialSectionId={initialSectionId}
      locale={locale}
      systemLocale={systemLocale}
      onSave={onSave}
      onSavePatch={onSavePatch}
      loadError={loadError}
      onCopyMcpConfig={onCopyMcpConfig}
      vaults={vaults}
      activeVaultPath={activeVaultPath}
      defaultWorkspacePath={defaultWorkspacePath}
      {...{ onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity }}
      isGitVault={isGitVault}
      explicitOrganizationEnabled={explicitOrganizationEnabled}
      onSaveExplicitOrganization={onSaveExplicitOrganization}
      inboxAutomationEnabled={inboxAutomationEnabled}
      onSaveInboxAutomation={onSaveInboxAutomation}
      onAdoptPortentTypes={onAdoptPortentTypes}
      onOpenFeedback={onOpenFeedback}
      onOpenDocs={onOpenDocs}
      onClose={onClose}
    />
  )
}

type SettingsPanelInnerProps = Omit<SettingsPanelProps, 'explicitOrganizationEnabled' | 'inboxAutomationEnabled' | 'aiAgentsStatus' | 'isGitVault'> & {
  open: boolean
  aiAgentsStatus: AiAgentsStatus
  initialSectionId: string | null
  locale: AppLocale
  systemLocale: AppLocale
  isGitVault: boolean
  explicitOrganizationEnabled: boolean
  inboxAutomationEnabled: boolean
}

function SettingsPanelInner({
  open,
  settings,
  aiAgentsStatus,
  initialSectionId,
  systemLocale,
  onSave,
  onSavePatch,
  loadError = null,
  onCopyMcpConfig,
  vaults,
  activeVaultPath,
  defaultWorkspacePath,
  onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity,
  isGitVault,
  explicitOrganizationEnabled,
  onSaveExplicitOrganization,
  inboxAutomationEnabled,
  onSaveInboxAutomation,
  onAdoptPortentTypes,
  onOpenFeedback,
  onOpenDocs,
  onClose,
}: SettingsPanelInnerProps) {
  const initialDraft = createSettingsDraft(settings, explicitOrganizationEnabled, inboxAutomationEnabled)
  const [draft, setDraft] = useState(initialDraft)
  const [baseline, setBaseline] = useState(initialDraft)
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const draftLocale = resolveEffectiveLocale(draft.uiLanguage, [systemLocale])
  const t = createTranslator(draftLocale)

  // Adopt externally-loaded settings only while the draft has no unsaved edits.
  // Instant-apply controls (theme, accent, providers, allow-list) call onSave mid-session,
  // which hands back a fresh settings object; rebuilding the draft on that identity change
  // silently discarded every pending edit the user had typed.
  const [draftDirty, setDraftDirty] = useState(false)
  const [adoptedSettings, setAdoptedSettings] = useState(settings)
  const [adoptedExplicitOrganization, setAdoptedExplicitOrganization] = useState(explicitOrganizationEnabled)
  const [adoptedInboxAutomation, setAdoptedInboxAutomation] = useState(inboxAutomationEnabled)
  const [adoptedLoadError, setAdoptedLoadError] = useState(loadError)

  const settingsSourceChanged =
    adoptedSettings !== settings ||
    adoptedExplicitOrganization !== explicitOrganizationEnabled ||
    adoptedInboxAutomation !== inboxAutomationEnabled
  const loadRecovered = adoptedLoadError != null && loadError == null

  if (settingsSourceChanged || adoptedLoadError !== loadError) {
    setAdoptedSettings(settings)
    setAdoptedExplicitOrganization(explicitOrganizationEnabled)
    setAdoptedInboxAutomation(inboxAutomationEnabled)
    setAdoptedLoadError(loadError)
    if (!draftDirty || loadRecovered) {
      const nextDraft = createSettingsDraft(settings, explicitOrganizationEnabled, inboxAutomationEnabled)
      setDraft(nextDraft)
      setBaseline(nextDraft)
      if (loadRecovered) setDraftDirty(false)
    }
  }

  const savesBlocked = loadError != null
  const warnSavesBlocked = useCallback(() => {
    console.warn('[settings] Did not save settings. The settings file still failed to load.')
  }, [])

  useSettingsPanelAutofocus(panelRef, open)
  useSettingsPanelFocusTrap(panelRef, open)

  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) {
      clearSettingsOpenAutofocusSuppress()
      const opener = openerRef.current
      openerRef.current = null
      if (opener?.isConnected) opener.focus()
      return
    }

    if (openerRef.current) return
    const active = document.activeElement
    if (active instanceof HTMLElement) openerRef.current = active
  }, [open])

  useEffect(() => {
    if (!initialSectionId) return
    const targetId = resolveSettingsSectionId(initialSectionId)
    const timer = window.setTimeout(() => {
      // Provider key focus scrolls the row; a section jump would undo it (#285).
      if (isSettingsOpenAutofocusSuppressed()) return
      if (targetId) document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [initialSectionId])

  const updateDraft = useCallback(
    <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => {
      setDraftDirty(true)
      setDraft((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const persistPatch = useCallback((patch: Partial<Settings>) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    if (onSavePatch) {
      onSavePatch(patch)
      return
    }
    onSave({ ...settings, ...patch })
  }, [onSave, onSavePatch, savesBlocked, settings, warnSavesBlocked])

  const handleGitignoredVisibilityChange = useCallback((value: boolean) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    updateDraft('hideGitignoredFiles', value)
    persistPatch({ hide_gitignored_files: value })
  }, [persistPatch, savesBlocked, updateDraft, warnSavesBlocked])

  const handleAllNotesFileVisibilityChange = useCallback((value: AllNotesFileVisibility) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    trackAllNotesVisibilityChanged(draft.allNotesFileVisibility, value)
    updateDraft('allNotesFileVisibility', value)
    const next = settingsWithAllNotesFileVisibility(settings, value)
    persistPatch({
      all_notes_show_pdfs: next.all_notes_show_pdfs,
      all_notes_show_images: next.all_notes_show_images,
      all_notes_show_unsupported: next.all_notes_show_unsupported,
    })
  }, [draft.allNotesFileVisibility, persistPatch, savesBlocked, settings, updateDraft, warnSavesBlocked])

  const handleThemeModeChange = useCallback((value: ThemeMode) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    updateDraft('themeMode', value)
    updateDraft('colorTheme', '')
    applyAppearanceSelection(value, '', draft.accentColor)
    persistPatch({ theme_mode: value, color_theme: null })
  }, [draft.accentColor, persistPatch, savesBlocked, updateDraft, warnSavesBlocked])

  const handleColorThemeChange = useCallback((value: string, mode?: ThemeMode) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    const nextMode = mode ?? draft.themeMode
    const persistColor = persistableColorTheme(value, nextMode)
    if (mode) updateDraft('themeMode', mode)
    updateDraft('colorTheme', persistColor ?? '')
    applyAppearanceSelection(nextMode, persistColor ?? '', draft.accentColor)
    persistPatch({
      color_theme: persistColor,
      ...(mode ? { theme_mode: mode } : {}),
    })
  }, [draft.accentColor, draft.themeMode, persistPatch, savesBlocked, updateDraft, warnSavesBlocked])

  const handleAccentColorChange = useCallback((value: AccentColor) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    updateDraft('accentColor', value)
    applyAppearanceSelection(draft.themeMode, draft.colorTheme, value)
    persistPatch({ accent_color: value })
  }, [draft.colorTheme, draft.themeMode, persistPatch, savesBlocked, updateDraft, warnSavesBlocked])

  const handleAiModelProvidersChange = useCallback((value: AiModelProvider[]) => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    resetListProviderModelsCache()
    updateDraft('aiModelProviders', value)
    persistPatch({
      ai_model_providers: value.length > 0 ? value : null,
    })
  }, [persistPatch, savesBlocked, updateDraft, warnSavesBlocked])

  const handleSave = useCallback(() => {
    if (savesBlocked) {
      warnSavesBlocked()
      return
    }
    trackTelemetryConsentChange(settings.analytics_enabled === true, draft.analytics)
    trackSettingsPreferenceChanges(settings, draft)
    if (onSavePatch) {
      const patch = settingsPatchFromDraft(baseline, draft, settings)
      if (Object.keys(patch).length > 0) onSavePatch(patch)
    } else {
      onSave(buildSettingsFromDraft(settings, draft))
    }
    onSaveExplicitOrganization?.(draft.explicitOrganization)
    onSaveInboxAutomation?.(draft.inboxAutomationEnabled)
    onClose()
  }, [baseline, draft, onClose, onSave, onSaveExplicitOrganization, onSaveInboxAutomation, onSavePatch, savesBlocked, settings, warnSavesBlocked])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented || isNestedSettingsOverlay(event.target, panelRef.current)) return
        event.stopPropagation()
        onClose()
        return
      }

      if (isSaveShortcut(event)) {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose, open])

  useEffect(() => {
    if (!open) return
    const backdrop = backdropRef.current
    if (!backdrop) return

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === backdrop) onClose()
    }

    backdrop.addEventListener('click', handleBackdropClick)
    return () => backdrop.removeEventListener('click', handleBackdropClick)
  }, [onClose, open])

  return (
    <div
      ref={backdropRef}
      hidden={!open}
      aria-hidden={!open}
      className="fixed inset-0 z-[1300] items-center justify-center"
      style={{ background: 'var(--shadow-overlay)', display: open ? 'flex' : 'none' }}
      data-testid="settings-panel"
    >
      <SettingsBackdropCloseButton onClose={onClose} t={t} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="relative rounded-lg border border-border bg-background shadow-[0_18px_55px_var(--shadow-dialog)]"
        style={{ width: 'min(960px, calc(100vw - 48px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}
      >
        <SettingsHeader onClose={onClose} t={t} />
        <SettingsBodyFromDraft
          t={t}
          draft={draft}
          locale={draftLocale}
          systemLocale={systemLocale}
          updateDraft={updateDraft}
          isGitVault={isGitVault}
          aiAgentsStatus={aiAgentsStatus}
          onCopyMcpConfig={onCopyMcpConfig}
          onAdoptPortentTypes={onAdoptPortentTypes}
          onOpenFeedback={onOpenFeedback}
          onOpenDocs={onOpenDocs}
          vaults={vaults ?? []}
          activeVaultPath={activeVaultPath}
          defaultWorkspacePath={defaultWorkspacePath}
          {...{ onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity }}
          setThemeMode={handleThemeModeChange}
          setColorTheme={handleColorThemeChange}
          setAccentColor={handleAccentColorChange}
          setHideGitignoredFiles={handleGitignoredVisibilityChange}
          setAllNotesFileVisibility={handleAllNotesFileVisibilityChange}
          onAiModelProvidersChange={handleAiModelProvidersChange}
          initialSectionId={initialSectionId}
          onClose={onClose}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} saveDisabled={savesBlocked} t={t} />
      </div>
    </div>
  )
}

function SettingsBackdropCloseButton({ onClose, t }: { onClose: () => void; t: Translate }) {
  return (
    <button
      type="button"
      aria-label={t('settings.close')}
      className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
      onClick={onClose}
    />
  )
}

function SettingsHeader({ onClose, t }: { onClose: () => void; t: Translate }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderBottom: '1px solid var(--border)' }}
    >
      <span id="settings-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{t('settings.title')}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        title={t('settings.close')}
        aria-label={t('settings.close')}
      >
        <X size={16} />
      </Button>
    </div>
  )
}

interface SettingsBodyFromDraftProps {
  t: Translate
  draft: SettingsDraft
  locale: AppLocale
  systemLocale: AppLocale
  updateDraft: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void
  isGitVault: boolean
  aiAgentsStatus: AiAgentsStatus
  onCopyMcpConfig?: () => void
  onAdoptPortentTypes?: () => void
  onOpenFeedback?: () => void
  onOpenDocs?: () => void
  vaults: VaultOption[]
  activeVaultPath?: string | null
  defaultWorkspacePath?: string | null
  onRemoveVault?: (path: string) => void; onReorderVaults?: (orderedPaths: string[]) => void; onSetDefaultWorkspace?: (path: string) => void; onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  setThemeMode: (value: ThemeMode) => void
  setColorTheme: (value: string, mode?: ThemeMode) => void
  setAccentColor: (value: AccentColor) => void
  setHideGitignoredFiles: (value: boolean) => void
  setAllNotesFileVisibility: (value: AllNotesFileVisibility) => void
  onAiModelProvidersChange: (value: AiModelProvider[]) => void
  initialSectionId?: string | null
  onClose?: () => void
}

function SettingsBodyFromDraft({
  t,
  draft,
  locale,
  systemLocale,
  updateDraft,
  isGitVault,
  aiAgentsStatus,
  onCopyMcpConfig,
  onAdoptPortentTypes,
  onOpenFeedback,
  onOpenDocs,
  vaults,
  activeVaultPath,
  defaultWorkspacePath,
  onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity,
  setThemeMode,
  setColorTheme,
  setAccentColor,
  setHideGitignoredFiles,
  setAllNotesFileVisibility,
  onAiModelProvidersChange,
  initialSectionId,
  onClose,
}: SettingsBodyFromDraftProps) {
  return (
    <SettingsBody
      t={t}
      locale={locale}
      systemLocale={systemLocale}
      pullInterval={draft.pullInterval}
      setPullInterval={(value) => updateDraft('pullInterval', value)}
      gitFeaturesEnabled={draft.gitFeaturesEnabled}
      setGitFeaturesEnabled={(value) => updateDraft('gitFeaturesEnabled', value)}
      isGitVault={isGitVault}
      autoGitEnabled={draft.autoGitEnabled}
      setAutoGitEnabled={(value) => updateDraft('autoGitEnabled', value)}
      autoGitIdleThresholdSeconds={draft.autoGitIdleThresholdSeconds}
      setAutoGitIdleThresholdSeconds={(value) => updateDraft('autoGitIdleThresholdSeconds', value)}
      autoGitInactiveThresholdSeconds={draft.autoGitInactiveThresholdSeconds}
      setAutoGitInactiveThresholdSeconds={(value) => updateDraft('autoGitInactiveThresholdSeconds', value)}
      autoAdvanceInboxAfterOrganize={draft.autoAdvanceInboxAfterOrganize}
      setAutoAdvanceInboxAfterOrganize={(value) => updateDraft('autoAdvanceInboxAfterOrganize', value)}
      celebrationsEnabled={draft.celebrationsEnabled}
      setCelebrationsEnabled={(value) => updateDraft('celebrationsEnabled', value)}
      keepInTaskbarOnClose={draft.keepInTaskbarOnClose}
      setKeepInTaskbarOnClose={(value) => updateDraft('keepInTaskbarOnClose', value)}
      agentMaxSteps={draft.agentMaxSteps}
      setAgentMaxSteps={(value) => updateDraft('agentMaxSteps', value)}
      agentProfile={draft.agentProfile}
      setAgentProfile={(value) => updateDraft('agentProfile', value)}
      nativeChatTarget={draft.nativeChatTarget}
      setNativeChatTarget={(value) => updateDraft('nativeChatTarget', value)}
      aiAgentsStatus={aiAgentsStatus}
      aiModelProviders={draft.aiModelProviders}
      setAiModelProviders={onAiModelProvidersChange}
      onCopyMcpConfig={onCopyMcpConfig}
      onAdoptPortentTypes={onAdoptPortentTypes}
      releaseChannel={draft.releaseChannel}
      setReleaseChannel={(value) => updateDraft('releaseChannel', value)}
      automaticUpdateChecksEnabled={draft.automaticUpdateChecksEnabled}
      setAutomaticUpdateChecksEnabled={(value) => updateDraft('automaticUpdateChecksEnabled', value)}
      themeMode={draft.themeMode}
      setThemeMode={setThemeMode}
      colorTheme={draft.colorTheme}
      setColorTheme={setColorTheme}
      accentColor={draft.accentColor}
      setAccentColor={setAccentColor}
      uiLanguage={draft.uiLanguage}
      setUiLanguage={(value) => updateDraft('uiLanguage', value)}
      dateDisplayFormat={draft.dateDisplayFormat}
      setDateDisplayFormat={(value) => updateDraft('dateDisplayFormat', value)}
      displayTimeZone={draft.displayTimeZone}
      setDisplayTimeZone={(value) => updateDraft('displayTimeZone', value)}
      defaultNoteWidth={draft.defaultNoteWidth}
      setDefaultNoteWidth={(value) => updateDraft('defaultNoteWidth', value)}
      sidebarTypePluralizationEnabled={draft.sidebarTypePluralizationEnabled}
      setSidebarTypePluralizationEnabled={(value) => updateDraft('sidebarTypePluralizationEnabled', value)}
      initialH1AutoRename={draft.initialH1AutoRename}
      setInitialH1AutoRename={(value) => updateDraft('initialH1AutoRename', value)}
      hideGitignoredFiles={draft.hideGitignoredFiles}
      setHideGitignoredFiles={setHideGitignoredFiles}
      blockSecretFiles={draft.blockSecretFiles}
      setBlockSecretFiles={(value) => updateDraft('blockSecretFiles', value)}
      allNotesFileVisibility={draft.allNotesFileVisibility}
      setAllNotesFileVisibility={setAllNotesFileVisibility}
      initialSectionId={initialSectionId}
      onClose={onClose}
      multiWorkspaceEnabled={draft.multiWorkspaceEnabled}
      setMultiWorkspaceEnabled={(value) => updateDraft('multiWorkspaceEnabled', value)}
      vaults={vaults}
      activeVaultPath={activeVaultPath}
      defaultWorkspacePath={defaultWorkspacePath}
      {...{ onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity }}
      explicitOrganization={draft.explicitOrganization}
      setExplicitOrganization={(value) => updateDraft('explicitOrganization', value)}
      inboxAutomationEnabled={draft.inboxAutomationEnabled}
      setInboxAutomationEnabled={(value) => updateDraft('inboxAutomationEnabled', value)}
      crashReporting={draft.crashReporting}
      setCrashReporting={(value) => updateDraft('crashReporting', value)}
      analytics={draft.analytics}
      setAnalytics={(value) => updateDraft('analytics', value)}
      onOpenFeedback={onOpenFeedback}
      onOpenDocs={onOpenDocs}
    />
  )
}

function SettingsBody(props: SettingsBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <SettingsBodyNav t={props.t} />
      <div className="min-w-0 flex-1 overflow-auto px-6 py-4">
        <SettingsSyncAndAppearanceSections {...props} />
        <SettingsContentSections {...props} />
        <SettingsAgentWorkflowSections {...props} />
        {/* Lets the last sections scroll their heading to the top when picked
            in the nav (native audit 2026-09-26). Sized to the scroll box. */}
        <div data-testid="settings-scroll-end-spacer" aria-hidden="true" style={{ minHeight: 'calc(100% - 4rem)' }} />
      </div>
    </div>
  )
}

function SettingsSyncAndAppearanceSections({
  t,
  locale,
  systemLocale,
  pullInterval,
  setPullInterval,
  gitFeaturesEnabled,
  setGitFeaturesEnabled,
  isGitVault,
  autoGitEnabled,
  setAutoGitEnabled,
  autoGitIdleThresholdSeconds,
  setAutoGitIdleThresholdSeconds,
  autoGitInactiveThresholdSeconds,
  setAutoGitInactiveThresholdSeconds,
  releaseChannel,
  setReleaseChannel,
  automaticUpdateChecksEnabled,
  setAutomaticUpdateChecksEnabled,
  multiWorkspaceEnabled,
  setMultiWorkspaceEnabled,
  vaults,
  defaultWorkspacePath,
  onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity,
  themeMode,
  setThemeMode,
  colorTheme,
  setColorTheme,
  accentColor,
  setAccentColor,
  uiLanguage,
  setUiLanguage,
  keepInTaskbarOnClose,
  setKeepInTaskbarOnClose,
}: SettingsBodyProps) {
  return (
    <>
      <SettingsSection id={SETTINGS_SECTION_IDS.sync}>
        <SyncAndUpdatesSection
          t={t}
          pullInterval={pullInterval}
          setPullInterval={setPullInterval}
          releaseChannel={releaseChannel}
          setReleaseChannel={setReleaseChannel}
          automaticUpdateChecksEnabled={automaticUpdateChecksEnabled}
          setAutomaticUpdateChecksEnabled={setAutomaticUpdateChecksEnabled}
        />
      </SettingsSection>
      <SettingsSection id={SETTINGS_SECTION_IDS.workspaces}>
        <SectionHeading
          icon={<Cube size={16} aria-hidden="true" />}
          title={t('settings.workspaces.title')}
        />
        <WorkspaceSettingsSection
          defaultWorkspacePath={defaultWorkspacePath}
          enabled={multiWorkspaceEnabled}
          locale={locale}
          onEnabledChange={setMultiWorkspaceEnabled}
          {...{ onRemoveVault, onReorderVaults, onSetDefaultWorkspace, onUpdateWorkspaceIdentity }}
          vaults={vaults}
        />
      </SettingsSection>
      <SettingsSection id={SETTINGS_SECTION_IDS.autogit}>
        <GitSettingsSection
          t={t}
          gitFeaturesEnabled={gitFeaturesEnabled}
          setGitFeaturesEnabled={setGitFeaturesEnabled}
          isGitVault={isGitVault}
          autoGitEnabled={autoGitEnabled}
          setAutoGitEnabled={setAutoGitEnabled}
          autoGitIdleThresholdSeconds={autoGitIdleThresholdSeconds}
          setAutoGitIdleThresholdSeconds={setAutoGitIdleThresholdSeconds}
          autoGitInactiveThresholdSeconds={autoGitInactiveThresholdSeconds}
          setAutoGitInactiveThresholdSeconds={setAutoGitInactiveThresholdSeconds}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.appearance}>
        <SectionHeading
          title={t('settings.appearance.title')}
          description={t('settings.appearance.description')}
        />
        <SettingsGroup>
          <AppearanceSettingsSection
            t={t}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            colorTheme={colorTheme}
            setColorTheme={setColorTheme}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
          />
          <LanguageSettingsSection
            t={t}
            locale={locale}
            systemLocale={systemLocale}
            uiLanguage={uiLanguage}
            setUiLanguage={setUiLanguage}
          />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsSwitchRow
            label="Keep in taskbar"
            description="Leave Rhizome running after the red close button so you can reopen it from the Dock or taskbar. Off by default: close quits the app and stops helpers it started."
            checked={keepInTaskbarOnClose}
            onChange={setKeepInTaskbarOnClose}
            testId="settings-keep-in-taskbar-on-close"
          />
        </SettingsGroup>
      </SettingsSection>
    </>
  )
}

function SettingsContentSections({
  t,
  dateDisplayFormat,
  setDateDisplayFormat,
  displayTimeZone,
  setDisplayTimeZone,
  defaultNoteWidth,
  setDefaultNoteWidth,
  sidebarTypePluralizationEnabled,
  setSidebarTypePluralizationEnabled,
  initialH1AutoRename,
  setInitialH1AutoRename,
  hideGitignoredFiles,
  setHideGitignoredFiles,
  allNotesFileVisibility,
  setAllNotesFileVisibility,
}: SettingsBodyProps) {
  return (
    <SettingsSection id={SETTINGS_SECTION_IDS.content}>
      <VaultContentSettingsSection
        t={t}
        dateDisplayFormat={dateDisplayFormat}
        setDateDisplayFormat={setDateDisplayFormat}
        displayTimeZone={displayTimeZone}
        setDisplayTimeZone={setDisplayTimeZone}
        defaultNoteWidth={defaultNoteWidth}
        setDefaultNoteWidth={setDefaultNoteWidth}
        sidebarTypePluralizationEnabled={sidebarTypePluralizationEnabled}
        setSidebarTypePluralizationEnabled={setSidebarTypePluralizationEnabled}
        initialH1AutoRename={initialH1AutoRename}
        setInitialH1AutoRename={setInitialH1AutoRename}
        hideGitignoredFiles={hideGitignoredFiles}
        setHideGitignoredFiles={setHideGitignoredFiles}
        allNotesFileVisibility={allNotesFileVisibility}
        setAllNotesFileVisibility={setAllNotesFileVisibility}
      />
    </SettingsSection>
  )
}

function SettingsAgentWorkflowSections({
  t,
  locale,
  autoAdvanceInboxAfterOrganize,
  setAutoAdvanceInboxAfterOrganize,
  celebrationsEnabled,
  setCelebrationsEnabled,
  agentProfile,
  agentMaxSteps,
  setAgentMaxSteps,
  setAgentProfile,
  blockSecretFiles,
  setBlockSecretFiles,
  nativeChatTarget,
  setNativeChatTarget,
  aiAgentsStatus,
  aiModelProviders,
  setAiModelProviders,
  onCopyMcpConfig,
  onAdoptPortentTypes,
  explicitOrganization,
  setExplicitOrganization,
  inboxAutomationEnabled,
  setInboxAutomationEnabled,
  crashReporting,
  setCrashReporting,
  analytics,
  setAnalytics,
  onOpenFeedback,
  onOpenDocs,
  activeVaultPath,
}: SettingsBodyProps) {
  return (
    <>
      <SettingsSection id={SETTINGS_SECTION_IDS.ai}>
        <AiAgentSettingsSection
          t={t}
          locale={locale}
          celebrationsEnabled={celebrationsEnabled}
          setCelebrationsEnabled={setCelebrationsEnabled}
          agentMaxSteps={agentMaxSteps}
          setAgentMaxSteps={setAgentMaxSteps}
          agentProfile={agentProfile}
          setAgentProfile={setAgentProfile}
          blockSecretFiles={blockSecretFiles}
          setBlockSecretFiles={setBlockSecretFiles}
          nativeChatTarget={nativeChatTarget}
          setNativeChatTarget={setNativeChatTarget}
          aiAgentsStatus={aiAgentsStatus}
          aiModelProviders={aiModelProviders}
          setAiModelProviders={setAiModelProviders}
          onCopyMcpConfig={onCopyMcpConfig}
          activeVaultPath={activeVaultPath}
        />
        <div className="mt-4">
          <SessionImportSettingsSection vaultPath={activeVaultPath ?? null} />
        </div>
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.workflow}>
        <OrganizationWorkflowSection
          t={t}
          checked={explicitOrganization}
          onChange={setExplicitOrganization}
          autoAdvanceInboxAfterOrganize={autoAdvanceInboxAfterOrganize}
          onChangeAutoAdvanceInboxAfterOrganize={setAutoAdvanceInboxAfterOrganize}
          inboxAutomationEnabled={inboxAutomationEnabled}
          onChangeInboxAutomation={setInboxAutomationEnabled}
          onAdoptPortentTypes={onAdoptPortentTypes}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.privacy}>
        <PrivacySettingsSection
          t={t}
          crashReporting={crashReporting}
          setCrashReporting={setCrashReporting}
          analytics={analytics}
          setAnalytics={setAnalytics}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.about}>
        <AboutSettingsSection
          t={t}
          onOpenFeedback={onOpenFeedback}
          onOpenDocs={onOpenDocs}
        />
      </SettingsSection>
    </>
  )
}

function SyncAndUpdatesSection({
  t,
  pullInterval,
  setPullInterval,
  releaseChannel,
  setReleaseChannel,
  automaticUpdateChecksEnabled,
  setAutomaticUpdateChecksEnabled,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'pullInterval'
  | 'setPullInterval'
  | 'releaseChannel'
  | 'setReleaseChannel'
  | 'automaticUpdateChecksEnabled'
  | 'setAutomaticUpdateChecksEnabled'
>) {
  return (
    <>
      <SectionHeading
        title={t('settings.sync.title')}
        description={t('settings.sync.description')}
      />

      <SettingsGroup>
        <SettingsRow label={t('settings.pullInterval')} description={t('settings.pullIntervalDescription')}>
          <SelectControl
            ariaLabel={t('settings.pullInterval')}
            value={`${pullInterval}`}
            onValueChange={(value) => setPullInterval(Number(value))}
            options={PULL_INTERVAL_OPTIONS.map((value) => ({
              value: `${value}`,
              label: `${value}`,
            }))}
            testId="settings-pull-interval"
            autoFocus={true}
          />
        </SettingsRow>

        <SettingsRow label={t('settings.releaseChannel')} description={t('settings.releaseChannelDescription')}>
          <SelectControl
            ariaLabel={t('settings.releaseChannel')}
            value={releaseChannel}
            onValueChange={(value) => setReleaseChannel(value as ReleaseChannel)}
            options={[
              { value: 'stable', label: t('settings.releaseStable') },
              { value: 'alpha', label: t('settings.releaseAlpha') },
            ]}
            testId="settings-release-channel"
          />
        </SettingsRow>

        <SettingsSwitchRow
          label={t('settings.automaticUpdateChecks')}
          description={t('settings.automaticUpdateChecksDescription')}
          checked={automaticUpdateChecksEnabled}
          onChange={setAutomaticUpdateChecksEnabled}
          testId="settings-automatic-update-checks"
        />
      </SettingsGroup>
    </>
  )
}

function AppearanceSettingsSection({
  t,
  themeMode,
  setThemeMode,
  colorTheme,
  setColorTheme,
  accentColor,
  setAccentColor,
}: Pick<
  SettingsBodyProps,
  't' | 'themeMode' | 'setThemeMode' | 'colorTheme' | 'setColorTheme' | 'accentColor' | 'setAccentColor'
>) {
  const followsMode = colorThemeFollowsMode(colorTheme, themeMode)
  const showAccent = colorTheme === DEFAULT_COLOR_THEME || (!colorTheme && resolveThemeMode(themeMode) === 'dark')
  return (
    <>
      <SettingsRow
        label={t('settings.colorTheme.label')}
        description="Graphite is Dark. Earth light is Light. System follows the OS between those two. Earth dark, Loam, and Mycelium are color skins."
        controlWidth="wide"
      >
        <ColorThemeControl value={colorTheme} themeMode={themeMode} onChange={setColorTheme} t={t} />
      </SettingsRow>
      <SettingsRow
        label={t('settings.theme.label')}
        description={
          followsMode
            ? 'Dark is Graphite. Light is Earth light. System follows the OS.'
            : 'Controlled by the selected color theme.'
        }
      >
        <ThemeModeControl value={themeMode} onChange={setThemeMode} t={t} disabled={!followsMode} />
      </SettingsRow>
      {showAccent && (
        <SettingsRow label={t('settings.accentColor.label')} description={t('settings.accentColor.description')}>
          <AccentColorPicker
            selectedColor={accentColor}
            onSelectColor={(key) => setAccentColor(key as AccentColor)}
            indicator="check"
            getOptionTestId={(key) => `settings-accent-${key}`}
          />
        </SettingsRow>
      )}
    </>
  )
}

function ColorThemeControl({
  value,
  themeMode,
  onChange,
  t,
}: {
  value: string
  themeMode: ThemeMode
  onChange: (value: string, mode?: ThemeMode) => void
  t: Translate
}) {
  const resolvedMode = resolveThemeMode(themeMode)
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.colorTheme.label')}
      data-testid="settings-color-theme"
      className="grid w-full grid-cols-2 gap-2 max-[520px]:grid-cols-1"
    >
      {appearancePickerOptions().map((option) => {
        const selected = isAppearancePickerOptionSelected(option, value, resolvedMode)
        return (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            role="radio"
            aria-checked={selected}
            aria-label={option.name}
            data-testid={`settings-color-theme-${option.id}`}
            onClick={() => onChange(option.colorTheme, option.mode)}
            className={cn(
              'h-auto min-h-8 w-full items-start justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-xs font-medium',
              selected ? 'border-foreground bg-muted hover:bg-muted' : 'hover:bg-muted/50',
            )}
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border/60"
              aria-hidden="true"
            >
              <span className="h-full w-1/2" style={{ backgroundColor: option.swatch[0] }} />
              <span className="h-full w-1/4" style={{ backgroundColor: option.swatch[1] }} />
              <span className="h-full w-1/4" style={{ backgroundColor: option.swatch[2] }} />
            </span>
            <span className="min-w-0 whitespace-normal text-xs font-medium leading-4">{option.name}</span>
          </Button>
        )
      })}
    </div>
  )
}

function ThemeModeControl({
  value,
  onChange,
  t,
  disabled = false,
}: {
  value: ThemeMode
  onChange: (value: ThemeMode) => void
  t: Translate
  disabled?: boolean
}) {
  return (
    <div
      className={cn('inline-flex w-full rounded-md border border-border bg-muted p-1', disabled && 'opacity-50')}
      role="radiogroup"
      aria-label={t('settings.theme.label')}
      aria-disabled={disabled}
      data-testid="settings-theme-mode"
    >
      {THEME_MODE_PICKER_ORDER.map((mode) => (
        <ThemeModeButton
          key={mode}
          label={mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}
          selected={value === mode}
          value={mode}
          onSelect={onChange}
          disabled={disabled}
        >
          {mode === 'system' ? <Monitor size={14} /> : mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
        </ThemeModeButton>
      ))}
    </div>
  )
}

function ThemeModeButton({
  children,
  label,
  selected,
  value,
  onSelect,
  disabled = false,
}: {
  children: ReactNode
  label: string
  selected: boolean
  value: ThemeMode
  onSelect: (value: ThemeMode) => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-testid={`settings-theme-${value}`}
      disabled={disabled}
      className={
        selected
          ? 'h-7 flex-1 border border-border bg-background text-foreground shadow-xs hover:bg-background'
          : 'h-7 flex-1 text-muted-foreground hover:text-foreground'
      }
      onClick={() => onSelect(value)}
    >
      {children}
      {label}
    </Button>
  )
}

function buildLanguageOptions(t: Translate, locale: AppLocale, systemLocale: AppLocale) {
  return [
    {
      value: SYSTEM_UI_LANGUAGE,
      label: t('settings.language.system', {
        language: localeDisplayName(systemLocale, locale),
      }),
    },
    ...APP_LOCALES.map((appLocale) => ({
      value: appLocale,
      label: localeDisplayName(appLocale, locale),
    })),
  ]
}

function LanguageSettingsSection({
  t,
  locale,
  systemLocale,
  uiLanguage,
  setUiLanguage,
}: Pick<SettingsBodyProps, 't' | 'locale' | 'systemLocale' | 'uiLanguage' | 'setUiLanguage'>) {
  return (
    <SettingsRow
      label={t('settings.language.title')}
      description={`${t('settings.language.description')} ${t('settings.language.summary')}`}
    >
      <SelectControl
        ariaLabel={t('settings.language.label')}
        value={uiLanguage}
        onValueChange={(value) => setUiLanguage(value as UiLanguagePreference)}
        options={buildLanguageOptions(t, locale, systemLocale)}
        testId="settings-ui-language"
      />
    </SettingsRow>
  )
}

function AutoSaveSettingRow({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  testId?: string
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const generatedId = useId()
  const switchId = testId ?? generatedId
  const plainDescription = 'After each chat reply, Rhizome saves anything worth keeping as a note in your vault. Sign-in errors and tool failures are skipped.'
  const technicalDescription = 'After each AI chat turn, distill durable decisions into the vault. Off by default — turn on only if you want silent saves. Prefer explicit promote/save for trusted knowledge. Skips error/OAuth/tooling failures and turns that already called distill.'

  return (
    <label
      htmlFor={switchId}
      className="border-b border-border px-4 py-3 last:border-b-0 flex flex-col gap-3 lg:flex-row lg:items-center"
      style={{ cursor: 'pointer', opacity: 1 }}
      data-testid={testId}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs leading-5 text-muted-foreground">{plainDescription}</div>
        {showTechnicalDetails && (
          <div className="mt-2 text-xs leading-5 text-muted-foreground">{technicalDescription}</div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.preventDefault()
            setShowTechnicalDetails(open => !open)
          }}
          aria-expanded={showTechnicalDetails}
        >
          Technical details
        </Button>
      </div>
      <div className="flex justify-start lg:shrink-0 lg:justify-end">
        <SettingsSwitchControl id={switchId} label={label} checked={checked} onChange={onChange} disabled={false} />
      </div>
    </label>
  )
}

function AiAgentSettingsSection({
  t,
  locale,
  celebrationsEnabled,
  setCelebrationsEnabled,
  agentProfile,
  agentMaxSteps,
  setAgentMaxSteps,
  setAgentProfile,
  blockSecretFiles,
  setBlockSecretFiles,
  nativeChatTarget,
  setNativeChatTarget,
  aiAgentsStatus,
  aiModelProviders,
  setAiModelProviders,
  onCopyMcpConfig,
  activeVaultPath,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'locale'
  | 'celebrationsEnabled'
  | 'setCelebrationsEnabled'
  | 'agentProfile'
  | 'agentMaxSteps'
  | 'setAgentMaxSteps'
  | 'setAgentProfile'
  | 'blockSecretFiles'
  | 'setBlockSecretFiles'
  | 'nativeChatTarget'
  | 'setNativeChatTarget'
  | 'aiAgentsStatus'
  | 'aiModelProviders'
  | 'setAiModelProviders'
  | 'onCopyMcpConfig'
  | 'activeVaultPath'
>) {
  const vaultConfig = useSyncExternalStore(subscribeVaultConfig, getVaultConfig, getVaultConfig)
  const sessionAutoDistillEnabled = vaultConfig.session_auto_distill_enabled === true
  const [providerTab, setProviderTab] = useState<ProviderSettingsTab>('agents')
  const [providerFocus, setProviderFocus] = useState<string | null>(null)
  const oauth = useOauthAccounts()

  useEffect(() => {
    const apply = (focus: { tab: ProviderSettingsTab; rowId: string }) => {
      setProviderTab(focus.tab)
      setProviderFocus(focus.rowId)
    }
    const pending = consumeProviderSettingsFocus()
    if (pending) apply(pending)
    return subscribeProviderSettingsFocus(apply)
  }, [])

  const openProviderRow = (row: ConnectedRow) => {
    setProviderTab(row.tab)
    setProviderFocus(row.rowId)
  }
  const clearProviderFocus = useCallback(() => setProviderFocus(null), [])

  return (
    <>
      <SectionHeading
        title={t('settings.aiAgents.title')}
        description={t('settings.aiAgents.description')}
      />

      <SettingsGroup>
        <SettingsRow
          label="Chat model"
          description="New chats start with this model. You can change it per chat in the composer."
          controlWidth="auto"
          testId="settings-chat-model"
        >
          <NativeChatModelPicker
            locale={locale}
            value={nativeChatTarget}
            onChange={setNativeChatTarget}
            providers={aiModelProviders}
            showLabel={false}
            oauth={oauth}
          />
        </SettingsRow>
        <SettingsRow
          label="Agent max steps"
          description="Model rounds per turn. When the limit is reached, Continue adds 50 more rounds."
          controlWidth="compact"
        >
          <Input
            type="number"
            min={1}
            step={1}
            value={agentMaxSteps}
            aria-label="Agent max steps"
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isSafeInteger(value) && value >= 1) setAgentMaxSteps(value)
            }}
          />
        </SettingsRow>
        <AutoSaveSettingRow
          label={t('settings.aiAgents.sessionAutoDistill')}
          checked={sessionAutoDistillEnabled}
          onChange={(value) => updateVaultConfigField('session_auto_distill_enabled', value)}
          testId="settings-session-auto-distill-enabled"
        />
        <SettingsSwitchRow
          label={t('settings.celebrations.enable')}
          description={t('settings.celebrations.enableDescription')}
          checked={celebrationsEnabled}
          onChange={setCelebrationsEnabled}
          testId="settings-celebrations-enabled"
        />
      </SettingsGroup>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-foreground">Safety</div>
        <SettingsGroup>
          <SecretFilesSettingRow checked={blockSecretFiles} onChange={setBlockSecretFiles} />
        </SettingsGroup>
      </div>

      <SettingsGroup>
        <SettingsRow
          label="Instructions"
          description="One profile for this installation. Chat adds it to every turn. It is not saved in the vault."
          controlWidth="wide"
        >
          <Textarea
            value={agentProfile}
            onChange={(event) => setAgentProfile(event.target.value)}
            placeholder="How Chat should respond"
            aria-label="Instructions"
            data-testid="settings-agent-profile"
          />
        </SettingsRow>
      </SettingsGroup>

      <ConnectedProvidersSummary
        t={t}
        agents={aiAgentsStatus}
        providers={aiModelProviders}
        onChange={setAiModelProviders}
        focusRowId={providerFocus}
        onFocusConsumed={clearProviderFocus}
        onOpen={openProviderRow}
        oauth={oauth}
      />

      <AiTargetManagementTabs
        t={t}
        aiAgentsStatus={aiAgentsStatus}
        aiModelProviders={aiModelProviders}
        setAiModelProviders={setAiModelProviders}
        onCopyMcpConfig={onCopyMcpConfig}
        vaultPath={activeVaultPath}
        tab={providerTab}
        onTabChange={setProviderTab}
        focusRowId={providerFocus === CONNECTED_SUMMARY_ROW_ID ? null : providerFocus}
      />
    </>
  )
}

function SecretFilesSettingRow({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const switchId = 'settings-block-secret-files-switch'

  return (
    <div
      className="border-b border-border px-4 py-3 last:border-b-0 flex flex-col gap-3 lg:flex-row lg:items-center"
      data-testid="settings-block-secret-files"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <label htmlFor={switchId} className="text-sm font-medium text-foreground">
            {SECRET_FILES_LABEL}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Which names are hidden"
                data-testid="settings-block-secret-files-patterns"
                onClick={(event) => event.stopPropagation()}
              >
                <Info />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 text-xs leading-5">
              <div className="font-medium text-sm">Hidden names</div>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
                {SECRET_FILE_PATTERN_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
        <div
          className={
            checked
              ? 'text-xs leading-5 text-muted-foreground'
              : 'text-xs leading-5 text-[var(--feedback-warning-text)]'
          }
          data-testid="settings-block-secret-files-help"
        >
          {checked ? SECRET_FILES_HELPER_ON : SECRET_FILES_HELPER_OFF}
        </div>
      </div>
      <div className="flex justify-start lg:shrink-0 lg:justify-end">
        <SettingsSwitchControl
          id={switchId}
          label={SECRET_FILES_LABEL}
          checked={checked}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

function AiTargetManagementTabs({
  t,
  aiAgentsStatus,
  aiModelProviders,
  setAiModelProviders,
  onCopyMcpConfig,
  tab,
  onTabChange,
  focusRowId,
}: {
  t: Translate
  aiAgentsStatus: AiAgentsStatus
  aiModelProviders: AiModelProvider[]
  setAiModelProviders: (value: AiModelProvider[]) => void
  onCopyMcpConfig?: () => void
  vaultPath?: string | null
  tab: ProviderSettingsTab
  onTabChange: (tab: ProviderSettingsTab) => void
  focusRowId?: string | null
}) {
  useEffect(() => {
    if (!focusRowId) return
    document.getElementById(focusRowId)?.scrollIntoView({ block: 'nearest' })
  }, [focusRowId, tab])

  return (
    <Tabs value={tab} onValueChange={(value) => onTabChange(value as ProviderSettingsTab)} className="gap-3">
      <TabsList className="grid h-9 w-full grid-cols-3">
        <TabsTrigger value="agents">{t('settings.aiAgents.agentGroup')}</TabsTrigger>
        <TabsTrigger value="local">{t('settings.aiAgents.localGroup')}</TabsTrigger>
        <TabsTrigger value="api">{t('settings.aiAgents.apiGroup')}</TabsTrigger>
      </TabsList>
      <TabsContent value="agents" className="space-y-3">
        <LocalAgentCards t={t} aiAgentsStatus={aiAgentsStatus} onCopyMcpConfig={onCopyMcpConfig} />
        <BridgeTokenRow t={t} />
      </TabsContent>
      <TabsContent value="local">
        <AiProviderSettings t={t} mode="local" providers={aiModelProviders} onChange={setAiModelProviders} />
      </TabsContent>
      <TabsContent value="api">
        <AiProviderSettings t={t} mode="api" providers={aiModelProviders} onChange={setAiModelProviders} />
      </TabsContent>
    </Tabs>
  )
}

function OrganizationWorkflowSection({
  t,
  checked,
  onChange,
  autoAdvanceInboxAfterOrganize,
  onChangeAutoAdvanceInboxAfterOrganize,
  inboxAutomationEnabled,
  onChangeInboxAutomation,
  onAdoptPortentTypes,
}: {
  t: Translate
  checked: boolean
  onChange: (value: boolean) => void
  autoAdvanceInboxAfterOrganize: boolean
  onChangeAutoAdvanceInboxAfterOrganize: (value: boolean) => void
  inboxAutomationEnabled: boolean
  onChangeInboxAutomation: (value: boolean) => void
  onAdoptPortentTypes?: () => void
}) {
  return (
    <>
      <SectionHeading
        title={t('settings.workflow.title')}
        description={t('settings.workflow.description')}
      />

      <SettingsGroup>
        <SettingsSwitchRow
          label={t('settings.workflow.explicit')}
          description={t('settings.workflow.explicitDescription')}
          checked={checked}
          onChange={onChange}
          testId="settings-explicit-organization"
        />

        <SettingsSwitchRow
          label={t('settings.workflow.autoAdvance')}
          description={t('settings.workflow.autoAdvanceDescription')}
          checked={autoAdvanceInboxAfterOrganize}
          onChange={onChangeAutoAdvanceInboxAfterOrganize}
          testId="settings-auto-advance-inbox-after-organize"
        />

        <SettingsSwitchRow
          label={t('settings.workflow.inboxAutomation')}
          description={t('settings.workflow.inboxAutomationDescription')}
          checked={inboxAutomationEnabled}
          onChange={onChangeInboxAutomation}
          testId="settings-inbox-automation-enabled"
        />

        {onAdoptPortentTypes ? (
          <SettingsGroupItem testId="settings-adopt-portent-types-row">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  {t('settings.workflow.adoptPortentTypes')}
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {t('settings.workflow.adoptPortentTypesDescription')}
                </span>
              </span>
              <AdoptPortentTypesButton t={t} onAdoptPortentTypes={onAdoptPortentTypes} />
            </div>
          </SettingsGroupItem>
        ) : null}
      </SettingsGroup>
    </>
  )
}

function AdoptPortentTypesButton({
  t,
  onAdoptPortentTypes,
}: {
  t: Translate
  onAdoptPortentTypes: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onAdoptPortentTypes}
      className="w-fit gap-2"
      aria-label={t('settings.workflow.adoptPortentTypes')}
      data-testid="settings-adopt-portent-types"
    >
      <Stack size={15} />
      {t('settings.workflow.adoptPortentTypes')}
    </Button>
  )
}
