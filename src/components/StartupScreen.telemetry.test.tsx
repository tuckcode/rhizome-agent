import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { StartupScreen } from './StartupScreen'

describe('StartupScreen telemetry consent', () => {
  it('saves No thanks as a settings patch', () => {
    const saveSettingsPatch = vi.fn()

    render(
      <StartupScreen
        isOffline={false}
        isStartupLoading={false}
        loadError={null}
        noteWindowParams={null}
        onboarding={{ state: { status: 'ready' } } as never}
        runtimeMissingVaultPath={null}
        saveSettingsPatch={saveSettingsPatch}
        settings={{ telemetry_consent: null } as Settings}
        settingsLoaded
        shouldResumeFreshStartOnboarding={false}
        vaultSwitcher={{ allVaults: [], loaded: true, vaultPath: '/vault' } as never}
      />,
    )

    fireEvent.click(screen.getByTestId('telemetry-decline'))

    expect(saveSettingsPatch).toHaveBeenCalledWith({
      telemetry_consent: false,
      crash_reporting_enabled: false,
      analytics_enabled: false,
      anonymous_id: null,
    })
  })
})

describe('StartupScreen model step', () => {
  function renderModelStep(saveSettingsPatch = vi.fn().mockResolvedValue(undefined)) {
    render(
      <StartupScreen
        isOffline={false}
        isStartupLoading={false}
        loadError={null}
        noteWindowParams={null}
        onboarding={{ state: { status: 'ready', vaultPath: '/vault' } } as never}
        runtimeMissingVaultPath={null}
        saveSettingsPatch={saveSettingsPatch}
        settings={{ telemetry_consent: true, ai_model_providers: null } as Settings}
        settingsLoaded
        shouldResumeFreshStartOnboarding={false}
        shouldShowModelStep
        vaultSwitcher={{ allVaults: [], loaded: true, vaultPath: '/vault' } as never}
      />,
    )
    return saveSettingsPatch
  }

  it('shows the model step after the vault step, behind consent', () => {
    renderModelStep()
    expect(screen.getByTestId('first-run-model-step')).toBeInTheDocument()
  })

  it('ends the step on Set up later without saving settings', () => {
    localStorage.setItem('rhizome:first-run-model-step', 'pending')
    const saveSettingsPatch = renderModelStep()
    fireEvent.click(screen.getByTestId('first-run-model-skip'))
    expect(localStorage.getItem('rhizome:first-run-model-step')).toBe('done')
    expect(saveSettingsPatch).not.toHaveBeenCalled()
  })
})
