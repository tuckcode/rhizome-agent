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
  telemetryConsent: boolean | null
  vaultIsLoading: boolean
  vaultSwitcher: StartupVaultSwitcherState
}

interface StartupScreenState {
  isStartupLoading: boolean
  isVaultContentLoading: boolean
  shouldResumeFreshStartOnboarding: boolean
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
  telemetryConsent,
}: ShouldShowStartupScreenArgs): boolean {
  if (isNoteWindow) return false

  const startupReasons = [
    needsTelemetryConsent(isStartupLoading, settingsLoaded, loadError, telemetryConsent),
    Boolean(runtimeMissingVaultPath),
    onboardingState.status === 'welcome',
    onboardingState.status === 'vault-missing',
    shouldResumeFreshStartOnboarding,
  ]
  return startupReasons.some(Boolean)
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
  telemetryConsent,
  vaultIsLoading,
  vaultSwitcher,
}: UseStartupScreenStateArgs): StartupScreenState {
  const shouldResumeFreshStartOnboarding = useMemo(
    () => shouldResumeFreshStart(onboardingState, selectedVaultPath, vaultSwitcher),
    [onboardingState, selectedVaultPath, vaultSwitcher],
  )

  const isStartupLoading = !isNoteWindow && onboardingState.status === 'loading'
  const shouldShowStartupScreen = shouldShowStartupScreenForState({
    isNoteWindow,
    isStartupLoading,
    onboardingState,
    loadError,
    runtimeMissingVaultPath,
    settingsLoaded,
    shouldResumeFreshStartOnboarding,
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
    shouldShowStartupScreen,
  }
}
