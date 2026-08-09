import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGitSetupState, type GitSetupPreference } from './useGitSetupState'

const mockInvokeFn = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

function renderGitSetupState(
  preference: GitSetupPreference = 'prompt',
  onGitSetupPreferenceChange = vi.fn(),
) {
  return renderHook(() => useGitSetupState({
    gitSetupPreference: preference,
    onGitSetupPreferenceChange,
    onToast: vi.fn(),
    resolvedPath: '/vault',
    windowMode: false,
  }))
}

describe('useGitSetupState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'is_git_repo') return Promise.resolve(false)
      if (cmd === 'init_git_repo') return Promise.resolve(null)
      return Promise.resolve(null)
    })
  })

  it('does not auto-open the Git setup dialog after never is saved for the vault', async () => {
    const { result } = renderGitSetupState('never')

    await waitFor(() => {
      expect(result.current.gitRepoState).toBe('missing')
    })

    expect(result.current.shouldShowGitSetupDialog).toBe(false)
  })

  it('still allows the Git setup dialog to be opened manually after never is saved', async () => {
    const { result } = renderGitSetupState('never')

    await waitFor(() => {
      expect(result.current.gitRepoState).toBe('missing')
    })

    act(() => result.current.openGitSetupDialog())

    expect(result.current.shouldShowGitSetupDialog).toBe(true)
  })

  it('persists never for this vault and closes the dialog', async () => {
    const onGitSetupPreferenceChange = vi.fn()
    const { result } = renderGitSetupState('prompt', onGitSetupPreferenceChange)

    await waitFor(() => {
      expect(result.current.shouldShowGitSetupDialog).toBe(true)
    })

    act(() => result.current.neverForVaultGitSetupDialog())

    expect(onGitSetupPreferenceChange).toHaveBeenCalledWith('never')
    expect(result.current.shouldShowGitSetupDialog).toBe(false)
  })
})
