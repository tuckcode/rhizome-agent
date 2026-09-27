import { Copy, Cube, Monitor, Moon, Stack, Sun, X } from '@phosphor-icons/react'
import {
  PRODUCT_AI_AGENT_DEFINITIONS,
  DEFAULT_AI_AGENT,
  createMissingAiAgentsStatus,
  getAiAgentAvailability,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  agentTargetId,
  normalizeAiModelProviders,
  type AiModelProvider,
} from '../lib/aiTargets'
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
  COLOR_THEMES,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_THEME,
  DEFAULT_THEME_MODE,
  readStoredAccentColor,
  readStoredColorTheme,
  readStoredThemeMode,
  writeStoredAccentColor,
  writeStoredColorTheme,
  writeStoredThemeMode,
  type AccentColor,
  type ThemeMode,
} from '../lib/themeMode'
import { cn } from '@/lib/utils'
import { AccentColorPicker } from './AccentColorPicker'
import { normalizeReleaseChannel, serializeReleaseChannel, type ReleaseChannel } from '../lib/releaseChannel'
import { shouldHideGitignoredFiles } from '../lib/gitignoredVisibility'
import { areGitFeaturesEnabled } from '../lib/gitSettings'
import { areAutomaticUpdateChecksEnabled } from '../lib/automaticUpdateChecks'
import { trackAllNotesVisibilityChanged } from '../lib/productAnalytics'
import { AiProviderSettings } from './AiProviderSettings'
import { PrimeModelAllowListSection } from './PrimeModelAllowListSection'
import { PrimeProviderStatusSection } from './PrimeProviderStatusSection'
import { PrimeExtensionsSection } from './PrimeExtensionsSection'
import { AiAgentIcon } from './AiAgentIcon'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import type { NoteWidthMode } from '../types'
import type { VaultOption } from './status-bar/types'
import { SETTINGS_SECTION_IDS } from './settingsSectionIds'
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
  setColorTheme: (value: string) => void
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
  loadModelCatalog?: boolean
  loadExtensionCatalog?: boolean
  onClose?: () => void
}

const PULL_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30] as const
const DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS = 90
const DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS = 30
type Translate = ReturnType<typeof createTranslator>

function isSaveShortcut(event: { ctrlKey: boolean; key: string; metaKey: boolean }): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
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

function resolveSettingsDraftColorTheme(colorTheme: Settings['color_theme']): string {
  if (colorTheme) return colorTheme
  if (typeof window === 'undefined') return DEFAULT_COLOR_THEME
  return readStoredColorTheme(window.localStorage) ?? DEFAULT_COLOR_THEME
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
    color_theme: draft.colorTheme,
    accent_color: draft.accentColor,
    ui_language: serializeUiLanguagePreference(draft.uiLanguage),
    date_display_format: draft.dateDisplayFormat,
    timezone: draft.displayTimeZone,
    note_width_mode: draft.defaultNoteWidth,
    sidebar_type_pluralization_enabled: draft.sidebarTypePluralizationEnabled,
    initial_h1_auto_rename_enabled: draft.initialH1AutoRename,
    celebrations_enabled: draft.celebrationsEnabled,
    default_ai_agent: DEFAULT_AI_AGENT,
    default_ai_target: agentTargetId(DEFAULT_AI_AGENT),
    ai_model_providers: draft.aiModelProviders.length > 0 ? draft.aiModelProviders : null,
    hide_gitignored_files: draft.hideGitignoredFiles,
    multi_workspace_enabled: draft.multiWorkspaceEnabled,
  }
  return settingsWithAllNotesFileVisibility(nextSettings, draft.allNotesFileVisibility)
}

function sanitizePositiveInteger(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1) return fallback
  return Math.round(value)
}

function applyAppearanceSelection(mode: ThemeMode, colorTheme: string, accentColor: AccentColor): void {
  const matchMedia = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined
  if (typeof document !== 'undefined') {
    applyAppearanceToDocument(document, { mode, colorTheme, accentColor }, matchMedia)
  }
  if (typeof window !== 'undefined') {
    writeStoredThemeMode(window.localStorage, mode)
    writeStoredColorTheme(window.localStorage, colorTheme)
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
  const [draft, setDraft] = useState(() => createSettingsDraft(settings, explicitOrganizationEnabled, inboxAutomationEnabled))
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

  const settingsSourceChanged =
    adoptedSettings !== settings ||
    adoptedExplicitOrganization !== explicitOrganizationEnabled ||
    adoptedInboxAutomation !== inboxAutomationEnabled

  if (settingsSourceChanged) {
    setAdoptedSettings(settings)
    setAdoptedExplicitOrganization(explicitOrganizationEnabled)
    setAdoptedInboxAutomation(inboxAutomationEnabled)
    if (!draftDirty) {
      setDraft(createSettingsDraft(settings, explicitOrganizationEnabled, inboxAutomationEnabled))
    }
  }

  useSettingsPanelAutofocus(panelRef, open)
  useSettingsPanelFocusTrap(panelRef, open)

  useEffect(() => {
    if (!initialSectionId) return
    const timer = window.setTimeout(() => {
      document.getElementById(initialSectionId)?.scrollIntoView({ block: 'start' })
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

  const handleGitignoredVisibilityChange = useCallback((value: boolean) => {
    updateDraft('hideGitignoredFiles', value)
    onSave({ ...settings, hide_gitignored_files: value })
  }, [onSave, settings, updateDraft])

  const handleAllNotesFileVisibilityChange = useCallback((value: AllNotesFileVisibility) => {
    trackAllNotesVisibilityChanged(draft.allNotesFileVisibility, value)
    updateDraft('allNotesFileVisibility', value)
    onSave(settingsWithAllNotesFileVisibility(settings, value))
  }, [draft.allNotesFileVisibility, onSave, settings, updateDraft])

  const handleThemeModeChange = useCallback((value: ThemeMode) => {
    updateDraft('themeMode', value)
    applyAppearanceSelection(value, draft.colorTheme, draft.accentColor)
    onSave({ ...settings, theme_mode: value })
  }, [draft.accentColor, draft.colorTheme, onSave, settings, updateDraft])

  const handleColorThemeChange = useCallback((value: string) => {
    updateDraft('colorTheme', value)
    applyAppearanceSelection(draft.themeMode, value, draft.accentColor)
    onSave({ ...settings, color_theme: value })
  }, [draft.accentColor, draft.themeMode, onSave, settings, updateDraft])

  const handleAccentColorChange = useCallback((value: AccentColor) => {
    updateDraft('accentColor', value)
    applyAppearanceSelection(draft.themeMode, draft.colorTheme, value)
    onSave({ ...settings, accent_color: value })
  }, [draft.colorTheme, draft.themeMode, onSave, settings, updateDraft])

  const handleSave = useCallback(() => {
    trackTelemetryConsentChange(settings.analytics_enabled === true, draft.analytics)
    trackSettingsPreferenceChanges(settings, draft)
    onSave(buildSettingsFromDraft(settings, draft))
    onSaveExplicitOrganization?.(draft.explicitOrganization)
    onSaveInboxAutomation?.(draft.inboxAutomationEnabled)
    onClose()
  }, [draft, onClose, onSave, onSaveExplicitOrganization, onSaveInboxAutomation, settings])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
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
          initialSectionId={initialSectionId}
          onClose={onClose}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} t={t} />
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
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{t('settings.title')}</span>
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
  setColorTheme: (value: string) => void
  setAccentColor: (value: AccentColor) => void
  setHideGitignoredFiles: (value: boolean) => void
  setAllNotesFileVisibility: (value: AllNotesFileVisibility) => void
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
      aiAgentsStatus={aiAgentsStatus}
      aiModelProviders={draft.aiModelProviders}
      setAiModelProviders={(value) => updateDraft('aiModelProviders', value)}
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
  const [loadModelCatalog, setLoadModelCatalog] = useState(
    props.initialSectionId === SETTINGS_SECTION_IDS.ai,
  )
  const [loadExtensionCatalog, setLoadExtensionCatalog] = useState(
    props.initialSectionId === SETTINGS_SECTION_IDS.extensions,
  )

  useEffect(() => {
    if (loadModelCatalog) return
    const el = document.getElementById(SETTINGS_SECTION_IDS.ai)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const root = el.closest('.overflow-auto')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLoadModelCatalog(true)
      },
      { root: root instanceof Element ? root : null, threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadModelCatalog])

  useEffect(() => {
    if (loadExtensionCatalog) return
    const el = document.getElementById(SETTINGS_SECTION_IDS.extensions)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const root = el.closest('.overflow-auto')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLoadExtensionCatalog(true)
      },
      { root: root instanceof Element ? root : null, threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadExtensionCatalog])

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <SettingsBodyNav
        t={props.t}
        onVisit={(id) => {
          if (id === SETTINGS_SECTION_IDS.ai) setLoadModelCatalog(true)
          if (id === SETTINGS_SECTION_IDS.extensions) setLoadExtensionCatalog(true)
        }}
      />
      <div className="min-w-0 flex-1 overflow-auto px-6 py-4">
        <SettingsSyncAndAppearanceSections {...props} />
        <SettingsContentSections {...props} />
        <SettingsAgentWorkflowSections
          {...props}
          loadModelCatalog={loadModelCatalog}
          loadExtensionCatalog={loadExtensionCatalog}
        />
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
  autoAdvanceInboxAfterOrganize,
  setAutoAdvanceInboxAfterOrganize,
  celebrationsEnabled,
  setCelebrationsEnabled,
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
  loadModelCatalog = false,
  loadExtensionCatalog = false,
  onClose,
}: SettingsBodyProps) {
  return (
    <>
      <SettingsSection id={SETTINGS_SECTION_IDS.ai}>
        <AiAgentSettingsSection
          t={t}
          celebrationsEnabled={celebrationsEnabled}
          setCelebrationsEnabled={setCelebrationsEnabled}
          aiAgentsStatus={aiAgentsStatus}
          aiModelProviders={aiModelProviders}
          setAiModelProviders={setAiModelProviders}
          onCopyMcpConfig={onCopyMcpConfig}
          loadModelCatalog={loadModelCatalog}
        />
        <div className="mt-4">
          <SessionImportSettingsSection vaultPath={activeVaultPath ?? null} />
        </div>
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.extensions}>
        <PrimeExtensionsSection active={loadExtensionCatalog} onClose={onClose} />
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
  const isRhizomeTheme = colorTheme === DEFAULT_COLOR_THEME
  return (
    <>
      <SettingsRow label={t('settings.colorTheme.label')} description={t('settings.colorTheme.description')}>
        <ColorThemeControl value={colorTheme} onChange={setColorTheme} t={t} />
      </SettingsRow>
      <SettingsRow
        label={t('settings.theme.label')}
        description={
          isRhizomeTheme
            ? t('settings.appearance.description')
            : t('settings.theme.controlledByColorTheme')
        }
      >
        <ThemeModeControl value={themeMode} onChange={setThemeMode} t={t} disabled={!isRhizomeTheme} />
      </SettingsRow>
      {isRhizomeTheme && (
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
  onChange,
  t,
}: {
  value: string
  onChange: (value: string) => void
  t: Translate
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.colorTheme.label')}
      data-testid="settings-color-theme"
      className="grid grid-cols-3 gap-2"
    >
      {COLOR_THEMES.map((theme) => {
        const selected = value === theme.slug
        return (
          <button
            key={theme.slug}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={theme.name}
            data-testid={`settings-color-theme-${theme.slug}`}
            onClick={() => onChange(theme.slug)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
              selected ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50',
            )}
          >
            <span
              className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-border/60"
              aria-hidden="true"
            >
              <span className="h-full w-1/2" style={{ backgroundColor: theme.swatch[0] }} />
              <span className="h-full w-1/4" style={{ backgroundColor: theme.swatch[1] }} />
              <span className="h-full w-1/4" style={{ backgroundColor: theme.swatch[2] }} />
            </span>
            <span className="truncate text-xs font-medium text-foreground">{theme.name}</span>
          </button>
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
      <ThemeModeButton label={t('settings.theme.light')} selected={value === 'light'} value="light" onSelect={onChange} disabled={disabled}>
        <Sun size={14} />
      </ThemeModeButton>
      <ThemeModeButton label={t('settings.theme.dark')} selected={value === 'dark'} value="dark" onSelect={onChange} disabled={disabled}>
        <Moon size={14} />
      </ThemeModeButton>
      <ThemeModeButton label={t('settings.theme.system')} selected={value === 'system'} value="system" onSelect={onChange} disabled={disabled}>
        <Monitor size={14} />
      </ThemeModeButton>
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
  celebrationsEnabled,
  setCelebrationsEnabled,
  aiAgentsStatus,
  aiModelProviders,
  setAiModelProviders,
  onCopyMcpConfig,
  loadModelCatalog,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'celebrationsEnabled'
  | 'setCelebrationsEnabled'
  | 'aiAgentsStatus'
  | 'aiModelProviders'
  | 'setAiModelProviders'
  | 'onCopyMcpConfig'
  | 'loadModelCatalog'
>) {
  const primeStatus = getAiAgentAvailability(aiAgentsStatus, DEFAULT_AI_AGENT)
  const vaultConfig = useSyncExternalStore(subscribeVaultConfig, getVaultConfig, getVaultConfig)
  const sessionAutoDistillEnabled = vaultConfig.session_auto_distill_enabled === true

  return (
    <>
      <SectionHeading
        title={t('settings.aiAgents.title')}
        description={t('settings.aiAgents.description')}
      />

      <SettingsGroup>
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

      <SettingsGroup>
        <SettingsRow
          label="Chat engine"
          description="Prime Agent runs Chat with vault tools. Choose Claude, Grok, DeepSeek, and Nous in Chat's model menu."
          controlWidth="wide"
        >
          <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm text-foreground" data-testid="settings-prime-chat-engine">
            <AiAgentIcon agent={DEFAULT_AI_AGENT} size={18} />
            <span className="font-medium">Prime Agent</span>
            <span className="text-muted-foreground">
              {primeStatus.status === 'installed'
                ? `(${t('settings.aiAgents.installed')}${primeStatus.version ? ` ${primeStatus.version}` : ''})`
                : `(${t('settings.aiAgents.missing')})`}
            </span>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <AiTargetManagementTabs
        t={t}
        aiAgentsStatus={aiAgentsStatus}
        aiModelProviders={aiModelProviders}
        setAiModelProviders={setAiModelProviders}
        onCopyMcpConfig={onCopyMcpConfig}
        loadModelCatalog={loadModelCatalog}
      />
    </>
  )
}

function AiTargetManagementTabs({
  t,
  aiAgentsStatus,
  aiModelProviders,
  setAiModelProviders,
  onCopyMcpConfig,
  loadModelCatalog,
}: {
  t: Translate
  aiAgentsStatus: AiAgentsStatus
  aiModelProviders: AiModelProvider[]
  setAiModelProviders: (value: AiModelProvider[]) => void
  onCopyMcpConfig?: () => void
  loadModelCatalog?: boolean
}) {
  return (
    <Tabs defaultValue="agents" className="gap-3">
      <TabsList className="grid h-9 w-full grid-cols-3">
        <TabsTrigger value="agents">{t('settings.aiAgents.agentGroup')}</TabsTrigger>
        <TabsTrigger value="local">{t('settings.aiAgents.localGroup')}</TabsTrigger>
        <TabsTrigger value="api">{t('settings.aiAgents.apiGroup')}</TabsTrigger>
      </TabsList>
      <TabsContent value="agents" className="space-y-3">
        <AiAgentsInstalledSection t={t} aiAgentsStatus={aiAgentsStatus} />
        {/* Same Agents-visible gate as the model list: skip provider IPC until then. */}
        {loadModelCatalog ? <PrimeProviderStatusSection t={t} /> : null}
        {loadModelCatalog ? <PrimeModelAllowListSection t={t} /> : null}
        {onCopyMcpConfig ? <CopyMcpConfigButton t={t} onCopyMcpConfig={onCopyMcpConfig} /> : null}
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

function CopyMcpConfigButton({
  t,
  onCopyMcpConfig,
}: {
  t: Translate
  onCopyMcpConfig: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopyMcpConfig}
      className="w-fit gap-2"
      aria-label={t('ai.panel.copyMcpConfig')}
      data-testid="settings-copy-mcp-config"
    >
      <Copy size={15} />
      {t('ai.panel.copyMcpConfig')}
    </Button>
  )
}

function AiAgentsInstalledSection({
  t,
  aiAgentsStatus,
}: {
  t: Translate
  aiAgentsStatus: AiAgentsStatus
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-sm font-medium text-foreground">{t('settings.aiAgents.installedTitle')}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.aiAgents.installedDescription')}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {PRODUCT_AI_AGENT_DEFINITIONS.map((definition) => {
          const status = getAiAgentAvailability(aiAgentsStatus, definition.id)
          const installed = status.status === 'installed'
          return (
            <div key={definition.id} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <AiAgentIcon agent={definition.id} size={16} />
                  <div className="truncate text-sm font-medium text-foreground">{definition.label}</div>
                </div>
                <div className={installed ? 'text-xs text-feedback-success-text' : 'text-xs text-muted-foreground'}>
                  {installed ? t('settings.aiAgents.installed') : t('settings.aiAgents.missing')}
                </div>
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {status.version || t('settings.aiAgents.noVersion')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
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
