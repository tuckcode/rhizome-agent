import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import type { VaultOption } from '../StatusBar'

const vaults: VaultOption[] = [
  { label: 'Main Vault', path: '/Users/luca/Laputa', alias: 'main', mounted: true },
  { label: 'Work Vault', path: '/Users/luca/Work', alias: 'work', mounted: false },
]

function renderPillStatusBar(overrides: Record<string, unknown> = {}) {
  return render(
    <StatusBar
      noteCount={100}
      modifiedCount={3}
      vaultPath="/Users/luca/Laputa"
      vaults={vaults}
      onSwitchVault={vi.fn()}
      remoteStatus={{ branch: 'main', ahead: 0, behind: 0, hasRemote: true }}
      onCommitPush={vi.fn()}
      onClickPulse={vi.fn()}
      onClickGraph={vi.fn()}
      onTriggerSync={vi.fn()}
      commandRailActive
      {...overrides}
    />
  )
}

describe('status bar pills (wave 5.4b, gated on the command rail)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
  })

  it('renders the vault·git pill with vault name, branch and change count', () => {
    renderPillStatusBar()

    const pill = screen.getByTestId('status-vault-trigger')
    expect(pill).toHaveAttribute('data-pill', 'vault')
    expect(pill).toHaveTextContent('Main Vault')
    expect(pill).toHaveTextContent('main')
    expect(pill).toHaveTextContent('3')
  })

  it('marks the pill dirty when there are pending changes and clean when there are none', () => {
    const { unmount } = renderPillStatusBar()
    expect(screen.getByTestId('status-vault-trigger')).toHaveAttribute('data-vault-state', 'dirty')
    unmount()

    renderPillStatusBar({ modifiedCount: 0 })
    expect(screen.getByTestId('status-vault-trigger')).toHaveAttribute('data-vault-state', 'clean')
  })

  it('marks the pill dirty when the branch is behind its remote', () => {
    renderPillStatusBar({
      modifiedCount: 0,
      remoteStatus: { branch: 'main', ahead: 0, behind: 2, hasRemote: true },
    })

    expect(screen.getByTestId('status-vault-trigger')).toHaveAttribute('data-vault-state', 'dirty')
  })

  it('absorbs the always-on git badges into the pill dropdown', () => {
    renderPillStatusBar({ conflictCount: 1, onOpenConflictResolver: vi.fn() })

    for (const testId of ['status-modified-count', 'status-commit-push', 'status-sync', 'status-pulse']) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument()
    }

    fireEvent.click(screen.getByTestId('status-vault-trigger'))

    expect(screen.getByTestId('vault-menu-sync-now')).toBeInTheDocument()
    expect(screen.getByTestId('vault-menu-commit')).toBeInTheDocument()
    expect(screen.getByTestId('vault-menu-history')).toBeInTheDocument()
    expect(screen.getByTestId('vault-menu-conflicts')).toBeInTheDocument()
  })

  it('runs the git actions from the pill dropdown', () => {
    const onTriggerSync = vi.fn()
    const onCommitPush = vi.fn()
    const onClickPulse = vi.fn()
    renderPillStatusBar({ onTriggerSync, onCommitPush, onClickPulse })

    fireEvent.click(screen.getByTestId('status-vault-trigger'))
    fireEvent.click(screen.getByTestId('vault-menu-sync-now'))
    expect(onTriggerSync).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByTestId('status-vault-trigger'))
    fireEvent.click(screen.getByTestId('vault-menu-commit'))
    expect(onCommitPush).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByTestId('status-vault-trigger'))
    fireEvent.click(screen.getByTestId('vault-menu-history'))
    expect(onClickPulse).toHaveBeenCalledOnce()
  })

  it('omits the conflicts entry when there are no conflicts', () => {
    renderPillStatusBar({ conflictCount: 0 })

    fireEvent.click(screen.getByTestId('status-vault-trigger'))

    expect(screen.queryByTestId('vault-menu-conflicts')).not.toBeInTheDocument()
  })

  it('hides the graph badge because the rail owns that destination', () => {
    renderPillStatusBar()

    expect(screen.queryByTestId('status-graph')).not.toBeInTheDocument()
  })

  it('does not put the agents pill on the status bar; the composer owns it', () => {
    renderPillStatusBar()

    expect(screen.queryByTestId('status-agents-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-rhizome-jobs')).not.toBeInTheDocument()
  })

  it('leaves the legacy status bar untouched when the rail is off', () => {
    renderPillStatusBar({ commandRailActive: false })

    const trigger = screen.getByTestId('status-vault-trigger')
    expect(trigger).not.toHaveAttribute('data-pill')
    expect(screen.getByTestId('status-modified-count')).toBeInTheDocument()
    expect(screen.getByTestId('status-commit-push')).toBeInTheDocument()
    expect(screen.getByTestId('status-pulse')).toBeInTheDocument()
    expect(screen.getByTestId('status-graph')).toBeInTheDocument()
    expect(screen.queryByTestId('status-agents-pill')).not.toBeInTheDocument()
  })
})
