import { useMemo } from 'react'

interface StartupOnboardingState {
  status: string
  vaultPath?: string
}

interface StartupVaultSwitcherState {
  allVaults: Array<{ path: string }>
  loaded: boolean
  vaultPath: string
}

interface UseStartupScreenStateArgs {
  isNoteWindow: boolean
  onboardingState: StartupOnboardingState
  runtimeMissingVaultPath: string | null
  loadError: string | null
  selectedVaultPath: string | null
  settingsLoaded: boolean
  /** First-run model step is pending and no model provider is saved. */
  modelStepPending?: boolean
  telemetryConsent: boolean | null
  vaultIsLoading: boolean
  vaultSwitcher: StartupVaultSwitcherState
}

interface StartupScreenState {
  isStartupLoading: boolean
  isVaultContentLoading: boolean
  shouldResumeFreshStartOnboarding: boolean
  shouldShowModelStep: boolean
  shouldShowStartupScreen: boolean
}

interface ShouldShowStartupScreenArgs {
  isNoteWindow: boolean
  isStartupLoading: boolean
  onboardingState: StartupOnboardingState
  loadError: string | null
  runtimeMissingVaultPath: string | null
  settingsLoaded: boolean
  shouldResumeFreshStartOnboarding: boolean
  shouldShowModelStep: boolean
  telemetryConsent: boolean | null
}

function shouldResumeFreshStart(
  onboardingState: StartupOnboardingState,
  selectedVaultPath: string | null,
  vaultSwitcher: StartupVaultSwitcherState,
): boolean {
  if (onboardingState.status !== 'ready' || !vaultSwitcher.loaded) return false

  const remembersOnlyImplicitDefaultVault = selectedVaultPath === null
  const hasOneRegisteredVault = vaultSwitcher.allVaults.length === 1
  const registeredVaultPath = vaultSwitcher.allVaults[0]?.path
  const switcherOwnsOnboardingVault = onboardingState.vaultPath === vaultSwitcher.vaultPath

  return remembersOnlyImplicitDefaultVault
    && hasOneRegisteredVault
    && registeredVaultPath === vaultSwitcher.vaultPath
    && switcherOwnsOnboardingVault
}

function needsTelemetryConsent(
  isStartupLoading: boolean,
  settingsLoaded: boolean,
  loadError: string | null,
  telemetryConsent: boolean | null,
): boolean {
  return !isStartupLoading && settingsLoaded && loadError == null && telemetryConsent === null
}

function shouldShowStartupScreenForState({
  isNoteWindow,
  isStartupLoading,
  onboardingState,
  loadError,
  runtimeMissingVaultPath,
  settingsLoaded,
  shouldResumeFreshStartOnboarding,
  shouldShowModelStep,
  telemetryConsent,
}: ShouldShowStartupScreenArgs): boolean {
  if (isNoteWindow) return false

  const startupReasons = [
    needsTelemetryConsent(isStartupLoading, settingsLoaded, loadError, telemetryConsent),
    Boolean(runtimeMissingVaultPath),
    onboardingState.status === 'welcome',
    onboardingState.status === 'vault-missing',
    shouldResumeFreshStartOnboarding,
    shouldShowModelStep,
  ]
  return startupReasons.some(Boolean)
}

/**
 * The model step follows the vault step (run plan 3.4). It waits for a ready
 * vault and loaded settings, and never shows in a note window.
 */
function modelStepIsDue({
  isNoteWindow,
  loadError,
  modelStepPending,
  onboardingState,
  runtimeMissingVaultPath,
  settingsLoaded,
}: {
  isNoteWindow: boolean
  loadError: string | null
  modelStepPending: boolean
  onboardingState: StartupOnboardingState
  runtimeMissingVaultPath: string | null
  settingsLoaded: boolean
}): boolean {
  return !isNoteWindow
    && modelStepPending
    && settingsLoaded
    && loadError == null
    && !runtimeMissingVaultPath
    && onboardingState.status === 'ready'
}

function isVaultContentLoading(
  isNoteWindow: boolean,
  isStartupLoading: boolean,
  onboardingState: StartupOnboardingState,
  vaultIsLoading: boolean,
): boolean {
  const readyVaultIsLoading = onboardingState.status === 'ready' && vaultIsLoading
  return !isNoteWindow && (isStartupLoading || readyVaultIsLoading)
}

export function useStartupScreenState({
  isNoteWindow,
  onboardingState,
  loadError,
  runtimeMissingVaultPath,
  selectedVaultPath,
  settingsLoaded,
  modelStepPending = false,
  telemetryConsent,
  vaultIsLoading,
  vaultSwitcher,
}: UseStartupScreenStateArgs): StartupScreenState {
  const shouldResumeFreshStartOnboarding = useMemo(
    () => shouldResumeFreshStart(onboardingState, selectedVaultPath, vaultSwitcher),
    [onboardingState, selectedVaultPath, vaultSwitcher],
  )

  const isStartupLoading = !isNoteWindow && onboardingState.status === 'loading'
  const shouldShowModelStep = modelStepIsDue({
    isNoteWindow,
    loadError,
    modelStepPending,
    onboardingState,
    runtimeMissingVaultPath,
    settingsLoaded,
  })
  const shouldShowStartupScreen = shouldShowStartupScreenForState({
    isNoteWindow,
    isStartupLoading,
    onboardingState,
    loadError,
    runtimeMissingVaultPath,
    settingsLoaded,
    shouldResumeFreshStartOnboarding,
    shouldShowModelStep,
    telemetryConsent,
  })
  const vaultContentLoading = isVaultContentLoading(
    isNoteWindow,
    isStartupLoading,
    onboardingState,
    vaultIsLoading,
  )

  return {
    isStartupLoading,
    isVaultContentLoading: vaultContentLoading,
    shouldResumeFreshStartOnboarding,
    shouldShowModelStep,
    shouldShowStartupScreen,
  }
}
