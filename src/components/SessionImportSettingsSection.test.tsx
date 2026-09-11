import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionImportSettingsSection } from './SessionImportSettingsSection'

const mockInvoke = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

describe('SessionImportSettingsSection', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('asks for a vault when none is open', () => {
    render(<SessionImportSettingsSection vaultPath={null} />)
    expect(screen.getByText(/Open a vault first/i)).toBeInTheDocument()
    expect(screen.getByTestId('session-import-preview')).toBeDisabled()
  })

  it('previews and imports Claude Code sessions into the vault', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'preview_claude_code_session_import') {
        return Promise.resolve({
          source: 'claude_code',
          found: 3,
          willImport: 2,
          vaultOnly: 1,
          withSessionRowPlanned: 1,
          skippedDuplicate: 1,
          needsConfirmation: 0,
          sessionListNotYetWired: true,
        })
      }
      if (cmd === 'run_claude_code_session_import') {
        return Promise.resolve({
          writtenNotes: ['Imports/claude-code/2026-09-06-hello.md'],
          imported: 2,
          skipped: 1,
          failed: 0,
          sessionListNotYetWired: true,
        })
      }
      return Promise.reject(new Error(`unexpected ${cmd}`))
    })

    render(<SessionImportSettingsSection vaultPath="/Users/mock/vault" />)

    fireEvent.click(screen.getByTestId('session-import-preview'))
    await waitFor(() => {
      expect(screen.getByText(/3 found/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('session-import-run'))
    await waitFor(() => {
      expect(screen.getByText(/2 notes written/i)).toBeInTheDocument()
    })

    expect(mockInvoke).toHaveBeenCalledWith('preview_claude_code_session_import', {
      vaultPath: '/Users/mock/vault',
    })
    expect(mockInvoke).toHaveBeenCalledWith('run_claude_code_session_import', {
      vaultPath: '/Users/mock/vault',
    })
  })
})
