import {
  ArrowsClockwise,
  GearSix as Settings,
  GitCommit,
  Moon,
  Package,
  Pulse,
  Sparkle,
  Sun,
  Warning as AlertTriangle,
  type IconProps,
} from '@phosphor-icons/react'
import type { ComponentType, MouseEventHandler, ReactNode } from 'react'
import type { McpStatus } from '../../hooks/useMcpStatus'
import type { ThemeMode } from '../../lib/themeMode'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import { useStatusBarAddRemote } from '../../hooks/useStatusBarAddRemote'
import type { GitRemoteStatus, SyncStatus } from '../../types'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { AddRemoteModal } from '../AddRemoteModal'
import { Button } from '@/components/ui/button'
import {
  CommitButton,
  ConflictBadge,
  ChangesBadge,
  GraphBadge,
  McpBadge,
  MissingGitBadge,
  NoRemoteBadge,
  OfflineBadge,
  PulseBadge,
  RhizomeJobsBadge,
  SyncBadge,
  VaultReloadingBadge,
} from './StatusBarBadges'
import { useRhizomeJobs } from '../../hooks/useRhizomeJobs'
import { ICON_STYLE, SEP_STYLE } from './styles'
import type { VaultOption } from './types'
import { VaultMenu, type VaultAction, type VaultPillSummary } from './VaultMenu'
import { formatShortcutDisplay } from '../../hooks/appCommandCatalog'
import type { GitRepositoryOption } from '../../utils/gitRepositories'

const SETTINGS_SHORTCUT = {
  shortcut: formatShortcutDisplay({ display: '⌘,' }),
} as const
const ZOOM_RESET_SHORTCUT = {
  shortcut: formatShortcutDisplay({ display: '⌘0' }),
} as const

interface StatusBarPrimarySectionProps {
  modifiedCount: number
  vaultPath: string
  defaultWorkspacePath?: string | null
  vaults: VaultOption[]
  multiWorkspaceEnabled?: boolean
  onSwitchVault: (path: string) => void
  onSetDefaultWorkspace?: (path: string) => void
  onOpenVaultSettings?: () => void
  onOpenLocalFolder?: () => void
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onAddRemote?: () => void
  onClickPending?: () => void
  onClickPulse?: () => void
  onClickGraph?: () => void
  onCommitPush?: () => void
  commitActionPending?: boolean
  gitFeaturesEnabled?: boolean
  onInitializeGit?: () => void
  isOffline?: boolean
  isVaultReloading?: boolean
  isGitVault?: boolean
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictCount: number
  remoteStatus?: GitRemoteStatus | null
  repositories?: GitRepositoryOption[]
  selectedRepositoryPath?: string
  onRepositoryChange?: (path: string) => void
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  onRemoveVault?: (path: string) => void
  onReorderVaults?: (orderedPaths: string[]) => void
  onUpdateWorkspaceIdentity?: (path: string, patch: Partial<VaultOption>) => void
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  /** Wave 5.4b §2.6: the rail shell renders the three-pill status bar; the
   *  legacy shell keeps today's badge strip untouched. */
  commandRailActive?: boolean
  stacked?: boolean
  compact?: boolean
  locale?: AppLocale
}

interface StatusBarSecondarySectionProps {
  noteCount: number
  zoomLevel: number
  themeMode?: ThemeMode
  onZoomReset?: () => void
  onToggleThemeMode?: () => void
  buildNumber?: string
  onCheckForUpdates?: () => void
  /** Single Rhizome+Prime update indicator (issue #19). */
  versionUpdateIndicator?: ReactNode
  onOpenResearch?: () => void
  onOpenSettings?: () => void
  /** When the command rail is active it owns Settings, so the duplicate
   *  status-bar Settings entry is hidden. Research stays on the status bar
   *  because the rail is sessions-only. */
  commandRailActive?: boolean
  stacked?: boolean
  compact?: boolean
  locale?: AppLocale
}

function BuildNumberButton({
  buildNumber,
  onCheckForUpdates,
  compact,
  locale,
}: {
  buildNumber?: string
  onCheckForUpdates?: () => void
  compact: boolean
  locale: AppLocale
}) {
  const className = compact
    ? 'h-6 min-w-0 gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'

  return (
    <ActionTooltip copy={{ label: translate(locale, 'status.update.check') }} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={className}
        onClick={onCheckForUpdates}
        aria-label={translate(locale, 'status.update.check')}
        aria-disabled={onCheckForUpdates ? undefined : true}
        data-testid="status-build-number"
      >
        <span style={ICON_STYLE}>
          <Package size={13} weight="regular" />
          {compact ? null : buildNumber ?? translate(locale, 'status.build.unknown')}
        </span>
      </Button>
    </ActionTooltip>
  )
}

function StatusBarPrimaryBadges({
  modifiedCount,
  visibleRemoteStatus,
  repositories,
  selectedRepositoryPath,
  onRepositoryChange,
  onAddRemote,
  onClickPending,
  onCommitPush,
  commitActionPending,
  gitFeaturesEnabled,
  onInitializeGit,
  syncStatus,
  lastSyncTime,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  conflictCount,
  onClickPulse,
  onClickGraph,
  isGitVault,
  mcpStatus,
  onInstallMcp,
  isOffline,
  isVaultReloading,
  pillMode,
  compact,
  locale,
}: {
  modifiedCount: number
  visibleRemoteStatus: GitRemoteStatus | null
  repositories?: GitRepositoryOption[]
  selectedRepositoryPath?: string
  onRepositoryChange?: (path: string) => void
  onAddRemote: () => void
  onClickPending?: () => void
  onCommitPush?: () => void
  commitActionPending?: boolean
  gitFeaturesEnabled: boolean
  onInitializeGit?: () => void
  syncStatus: SyncStatus
  lastSyncTime: number | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  conflictCount: number
  onClickPulse?: () => void
  onClickGraph?: () => void
  isGitVault: boolean
  mcpStatus?: McpStatus
  onInstallMcp?: () => void
  isOffline: boolean
  isVaultReloading: boolean
  pillMode: boolean
  compact: boolean
  locale: AppLocale
}) {
  const rhizomeJobs = useRhizomeJobs()
  return (
    <>
      <OfflineBadge isOffline={isOffline} showSeparator={!compact} compact={compact} locale={locale} />
      <VaultReloadingBadge isReloading={isVaultReloading} showSeparator={!compact} compact={compact} locale={locale} />
      {gitFeaturesEnabled && isGitVault ? (
        <>
          <NoRemoteBadge remoteStatus={visibleRemoteStatus} onAddRemote={onAddRemote} showSeparator={!compact} compact={compact} locale={locale} />
          {/* Pill mode folds these five into the vault·git pill dropdown (§2.6). */}
          {pillMode ? null : (
            <>
              <ChangesBadge count={modifiedCount} onClick={onClickPending} showSeparator={!compact} compact={compact} locale={locale} />
              <CommitButton onClick={onCommitPush} remoteStatus={visibleRemoteStatus} pending={commitActionPending} showSeparator={!compact} compact={compact} locale={locale} />
              <SyncBadge
                status={syncStatus}
                lastSyncTime={lastSyncTime}
                remoteStatus={visibleRemoteStatus}
                repositories={repositories}
                selectedRepositoryPath={selectedRepositoryPath}
                onRepositoryChange={onRepositoryChange}
                onTriggerSync={onTriggerSync}
                onPullAndPush={onPullAndPush}
                onOpenConflictResolver={onOpenConflictResolver}
                compact={compact}
                locale={locale}
              />
              <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} showSeparator={!compact} compact={compact} locale={locale} />
              <PulseBadge onClick={onClickPulse} showSeparator={!compact} compact={compact} locale={locale} />
            </>
          )}
        </>
      ) : gitFeaturesEnabled ? (
        <MissingGitBadge onClick={onInitializeGit} showSeparator={!compact} compact={compact} locale={locale} />
      ) : null}
      {mcpStatus && <McpBadge status={mcpStatus} onInstall={onInstallMcp} showSeparator={!compact} compact={compact} locale={locale} />}
      {/* The rail owns the Graph destination (§2.6.3). */}
      {pillMode ? null : <GraphBadge onClick={onClickGraph} showSeparator={!compact} compact={compact} locale={locale} />}
      {pillMode ? null : (
        <RhizomeJobsBadge jobs={rhizomeJobs.activeJobs} onCancelJob={rhizomeJobs.cancelJob} showSeparator={!compact} compact={compact} locale={locale} />
      )}
    </>
  )
}

type StatusLinkButtonProps = {
  compact: boolean
  icon: ComponentType<IconProps>
  labelKey: TranslationKey
  locale: AppLocale
  onClick: MouseEventHandler<HTMLButtonElement>
  testId: string
  tooltipKey: TranslationKey
}

function StatusLinkButton({
  compact,
  icon: Icon,
  labelKey,
  locale,
  onClick,
  testId,
  tooltipKey,
}: StatusLinkButtonProps) {
  const className = compact
    ? 'h-7 w-7 rounded-sm p-0 text-muted-foreground hover:text-foreground'
    : 'h-6 px-2 text-[12px] font-medium text-muted-foreground hover:text-foreground'

  return (
    <ActionTooltip copy={{ label: translate(locale, tooltipKey) }} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={className}
        onClick={onClick}
        aria-label={translate(locale, tooltipKey)}
        data-testid={testId}
      >
        <Icon size={14} weight="regular" />
        {compact ? null : translate(locale, labelKey)}
      </Button>
    </ActionTooltip>
  )
}

function ResearchButton({
  compact,
  locale,
  onOpenResearch,
}: {
  compact: boolean
  locale: AppLocale
  onOpenResearch: () => void
}) {
  return (
    <StatusLinkButton
      compact={compact}
      icon={Sparkle}
      labelKey="status.research.label"
      locale={locale}
      onClick={onOpenResearch}
      testId="status-research"
      tooltipKey="status.research.open"
    />
  )
}

/**
 * Wave 5.4b §2.6: the controls the vault·git pill absorbs — sync now, commit,
 * history, conflicts — rendered as dropdown entries instead of strip buttons.
 */
function buildGitPillActions({
  conflictCount,
  onCommitPush,
  onClickPulse,
  onOpenConflictResolver,
  onTriggerSync,
}: Pick<
  StatusBarPrimarySectionProps,
  'conflictCount' | 'onCommitPush' | 'onClickPulse' | 'onOpenConflictResolver' | 'onTriggerSync'
>): VaultAction[] {
  const actions: VaultAction[] = []

  if (onTriggerSync) {
    actions.push({
      key: 'sync-now',
      icon: <ArrowsClockwise size={12} />,
      labelKey: 'status.sync.now',
      testId: 'vault-menu-sync-now',
      onClick: onTriggerSync,
    })
  }

  if (onCommitPush) {
    actions.push({
      key: 'commit',
      icon: <GitCommit size={12} />,
      labelKey: 'status.commit.label',
      testId: 'vault-menu-commit',
      onClick: onCommitPush,
    })
  }

  if (onClickPulse) {
    actions.push({
      key: 'history',
      icon: <Pulse size={12} />,
      labelKey: 'status.history.label',
      testId: 'vault-menu-history',
      onClick: onClickPulse,
    })
  }

  if (onOpenConflictResolver && conflictCount > 0) {
    actions.push({
      key: 'conflicts',
      icon: <AlertTriangle size={12} />,
      labelKey: 'status.sync.conflicts',
      testId: 'vault-menu-conflicts',
      accent: true,
      onClick: onOpenConflictResolver,
    })
  }

  return actions
}

function vaultPillSummary({
  modifiedCount,
  remoteStatus,
  conflictCount,
}: Pick<StatusBarPrimarySectionProps, 'modifiedCount' | 'remoteStatus' | 'conflictCount'>): VaultPillSummary {
  return {
    branch: remoteStatus?.branch,
    changeCount: modifiedCount,
    dirty: modifiedCount > 0 || conflictCount > 0 || (remoteStatus?.behind ?? 0) > 0,
  }
}

function primarySectionStyle(stacked: boolean, compact: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 8 : 12,
    rowGap: stacked ? 4 : 0,
    flex: 1,
    minWidth: 0,
    width: stacked ? '100%' : 'auto',
    flexBasis: stacked ? '100%' : 'auto',
    flexWrap: stacked ? 'wrap' : 'nowrap',
  } as const
}

function PrimarySeparator({ compact }: { compact: boolean }) {
  return compact ? null : <span style={SEP_STYLE}>|</span>
}

function StatusBarGitControls({
  modifiedCount,
  vaultPath,
  onAddRemote,
  onClickPending,
  onCommitPush,
  commitActionPending,
  gitFeaturesEnabled,
  onInitializeGit,
  isOffline,
  isVaultReloading,
  isGitVault,
  syncStatus,
  lastSyncTime,
  conflictCount,
  remoteStatus,
  repositories,
  selectedRepositoryPath,
  onRepositoryChange,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  onClickPulse,
  onClickGraph,
  mcpStatus,
  onInstallMcp,
  commandRailActive = false,
  compact,
  locale,
}: StatusBarPrimarySectionProps & { compact: boolean; locale: AppLocale }) {
  const gitVaultPath = selectedRepositoryPath || vaultPath
  const { openAddRemote, closeAddRemote, showAddRemote, visibleRemoteStatus, handleRemoteConnected } = useStatusBarAddRemote({
    vaultPath: gitVaultPath,
    isGitVault: gitFeaturesEnabled !== false && isGitVault !== false,
    remoteStatus,
    onAddRemote,
  })

  return (
    <>
      <StatusBarPrimaryBadges
        modifiedCount={modifiedCount}
        visibleRemoteStatus={visibleRemoteStatus}
        repositories={repositories}
        selectedRepositoryPath={gitVaultPath}
        onRepositoryChange={onRepositoryChange}
        onAddRemote={() => {
          void openAddRemote()
        }}
        onClickPending={onClickPending}
        onCommitPush={onCommitPush}
        commitActionPending={commitActionPending}
        gitFeaturesEnabled={gitFeaturesEnabled !== false}
        onInitializeGit={onInitializeGit}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        conflictCount={conflictCount}
        onClickPulse={onClickPulse}
        onClickGraph={onClickGraph}
        isGitVault={isGitVault !== false}
        mcpStatus={mcpStatus}
        onInstallMcp={onInstallMcp}
        isOffline={isOffline === true}
        isVaultReloading={isVaultReloading === true}
        pillMode={commandRailActive}
        compact={compact}
        locale={locale}
      />
      <AddRemoteModal
        open={showAddRemote}
        vaultPath={gitVaultPath}
        onClose={closeAddRemote}
        onRemoteConnected={handleRemoteConnected}
      />
    </>
  )
}

export function StatusBarPrimarySection({
  modifiedCount,
  vaultPath,
  defaultWorkspacePath,
  vaults, multiWorkspaceEnabled,
  onSwitchVault,
  onSetDefaultWorkspace,
  onOpenVaultSettings,
  onOpenLocalFolder,
  onCreateEmptyVault,
  onCloneVault,
  onCloneGettingStarted,
  onAddRemote,
  onClickPending, onClickPulse, onClickGraph,
  onCommitPush, commitActionPending = false,
  gitFeaturesEnabled = true,
  onInitializeGit,
  isOffline = false, isVaultReloading = false, isGitVault = true,
  syncStatus,
  lastSyncTime,
  conflictCount,
  remoteStatus,
  repositories,
  selectedRepositoryPath,
  onRepositoryChange,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  onRemoveVault,
  onReorderVaults,
  onUpdateWorkspaceIdentity,
  mcpStatus,
  onInstallMcp,
  commandRailActive = false,
  locale = 'en',
  stacked = false,
  compact = false,
}: StatusBarPrimarySectionProps) {
  const pillMode = commandRailActive
  const gitPillActions = pillMode
    ? buildGitPillActions({ conflictCount, onCommitPush, onClickPulse, onOpenConflictResolver, onTriggerSync })
    : undefined

  return (
    <div style={primarySectionStyle(stacked, compact)}>
      <VaultMenu
        vaults={vaults}
        vaultPath={vaultPath}
        pillSummary={pillMode ? vaultPillSummary({ modifiedCount, remoteStatus, conflictCount }) : undefined}
        extraActions={gitPillActions}
        defaultWorkspacePath={defaultWorkspacePath}
        multiWorkspaceEnabled={multiWorkspaceEnabled}
        onSwitchVault={onSwitchVault}
        onSetDefaultWorkspace={onSetDefaultWorkspace}
        onOpenVaultSettings={onOpenVaultSettings}
        onOpenLocalFolder={onOpenLocalFolder}
        onCreateEmptyVault={onCreateEmptyVault}
        onCloneVault={onCloneVault}
        onCloneGettingStarted={onCloneGettingStarted}
        {...{ onRemoveVault, onReorderVaults, onUpdateWorkspaceIdentity }}
        compact={compact}
        locale={locale}
      />
      {pillMode ? null : <PrimarySeparator compact={compact} />}
      <StatusBarGitControls
        commandRailActive={commandRailActive}
        modifiedCount={modifiedCount}
        vaultPath={vaultPath}
        vaults={vaults}
        onSwitchVault={onSwitchVault}
        remoteStatus={remoteStatus}
        repositories={repositories}
        selectedRepositoryPath={selectedRepositoryPath}
        onRepositoryChange={onRepositoryChange}
        onAddRemote={onAddRemote}
        onClickPending={onClickPending}
        onCommitPush={onCommitPush}
        commitActionPending={commitActionPending}
        gitFeaturesEnabled={gitFeaturesEnabled}
        onInitializeGit={onInitializeGit}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        conflictCount={conflictCount}
        onClickPulse={onClickPulse}
        onClickGraph={onClickGraph}
        isGitVault={isGitVault}
        mcpStatus={mcpStatus}
        onInstallMcp={onInstallMcp}
        isOffline={isOffline} isVaultReloading={isVaultReloading}
        compact={compact}
        locale={locale}
      />
    </div>
  )
}

export function StatusBarSecondarySection({
  noteCount,
  zoomLevel,
  themeMode = 'light',
  onZoomReset,
  onToggleThemeMode,
  buildNumber,
  onCheckForUpdates,
  versionUpdateIndicator,
  onOpenResearch,
  onOpenSettings,
  commandRailActive = false,
  locale = 'en',
  stacked = false,
  compact = false,
}: StatusBarSecondarySectionProps) {
  void noteCount
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon
  const themeTooltip = {
    label: translate(locale, themeMode === 'dark' ? 'status.theme.light' : 'status.theme.dark'),
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: stacked ? 'flex-end' : 'flex-start',
        gap: compact ? 8 : 12,
        flexShrink: 0,
        width: stacked ? '100%' : 'auto',
      }}
    >
      {zoomLevel === 100 ? null : (
        <ActionTooltip copy={{ label: translate(locale, 'status.zoom.reset'), ...ZOOM_RESET_SHORTCUT }} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
            onClick={onZoomReset}
            aria-label={translate(locale, 'status.zoom.reset')}
            data-testid="status-zoom"
          >
            <span style={ICON_STYLE}>{zoomLevel}%</span>
          </Button>
        </ActionTooltip>
      )}
      {onOpenResearch ? <ResearchButton compact={compact} locale={locale} onOpenResearch={onOpenResearch} /> : null}
      <BuildNumberButton buildNumber={buildNumber} onCheckForUpdates={onCheckForUpdates} compact={compact} locale={locale} />
      {versionUpdateIndicator}
      <ActionTooltip copy={themeTooltip} side="top" align="end" contentTestId="status-theme-mode-tooltip">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onToggleThemeMode}
          disabled={!onToggleThemeMode}
          aria-label={themeTooltip.label}
          data-testid="status-theme-mode"
        >
          <ThemeIcon size={14} weight="regular" />
        </Button>
      </ActionTooltip>
      {!commandRailActive && (
        <ActionTooltip copy={{ label: translate(locale, 'status.settings.open'), ...SETTINGS_SHORTCUT }} side="top" align="end">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
            onClick={onOpenSettings}
            aria-label={translate(locale, 'status.settings.open')}
            data-testid="status-settings"
          >
            <Settings size={14} weight="regular" />
          </Button>
        </ActionTooltip>
      )}
    </div>
  )
}
