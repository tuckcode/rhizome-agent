import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { StartupScreen } from './StartupScreen'

describe('StartupScreen telemetry consent', () => {
  it('saves No thanks as a settings patch', () => {
    const saveSettings = vi.fn()
    const saveSettingsPatch = vi.fn()

    render(
      <StartupScreen
        aiAgentsOnboarding={{ showPrompt: false, dismissPrompt: () => {} } as never}
        aiAgentsStatus={{} as never}
        isOffline={false}
        isStartupLoading={false}
        loadError={null}
        noteWindowParams={null}
        onboarding={{ state: { status: 'ready' } } as never}
        runtimeMissingVaultPath={null}
        saveSettings={saveSettings}
        saveSettingsPatch={saveSettingsPatch}
        settings={{ telemetry_consent: null } as Settings}
        settingsLoaded
        shouldResumeFreshStartOnboarding={false}
        showMcpSetupDialog={false}
        setToastMessage={() => {}}
        toastMessage={null}
        vaultSwitcher={{ allVaults: [], loaded: true, vaultPath: '/vault' } as never}
      />,
    )

    fireEvent.click(screen.getByTestId('telemetry-decline'))

    expect(saveSettings).not.toHaveBeenCalled()
    expect(saveSettingsPatch).toHaveBeenCalledWith({
      telemetry_consent: false,
      crash_reporting_enabled: false,
      analytics_enabled: false,
      anonymous_id: null,
    })
  })
})
