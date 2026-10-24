import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VersionUpdateIndicator } from './VersionUpdateIndicator'
import { TooltipProvider } from './ui/tooltip'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'

function makeRhizomeActions(overrides?: Partial<UpdateActions>): UpdateActions {
  return {
    startDownload: vi.fn(),
    openReleaseNotes: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  }
}

const idleRhizome: UpdateStatus = { state: 'idle' }

function rhizomeAvailable(overrides?: Partial<Extract<UpdateStatus, { state: 'available' }>>): UpdateStatus {
  return {
    state: 'available',
    version: '2026.4.16',
    displayVersion: '2026.4.16',
    notes: 'Bug fixes and improvements',
    ...overrides,
  }
}

function renderIndicator({
  rhizomeStatus = idleRhizome,
  rhizomeActions = makeRhizomeActions(),
}: {
  rhizomeStatus?: UpdateStatus
  rhizomeActions?: UpdateActions
} = {}) {
  const view = render(
    <TooltipProvider>
      <VersionUpdateIndicator rhizomeStatus={rhizomeStatus} rhizomeActions={rhizomeActions} />
    </TooltipProvider>,
  )
  return { ...view, rhizomeActions }
}

describe('VersionUpdateIndicator', () => {
  it('renders nothing when Rhizome has no update', () => {
    renderIndicator()
    expect(screen.queryByTestId('status-version-update')).not.toBeInTheDocument()
  })

  it('renders nothing while Rhizome is only checking, downloading, or ready (not "available")', () => {
    renderIndicator({ rhizomeStatus: { state: 'checking' } })
    expect(screen.queryByTestId('status-version-update')).not.toBeInTheDocument()
  })

  it('shows a single badge with a green dot when Rhizome has an update', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable() })
    expect(screen.getByTestId('status-version-update')).toHaveTextContent('Update')
    expect(screen.getByTestId('status-version-update-dot')).toBeInTheDocument()
  })

  it('clicking the badge opens a modal naming Rhizome, with its notes', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable({ displayVersion: '2026.4.16' }) })

    fireEvent.click(screen.getByTestId('status-version-update'))

    expect(screen.getByTestId('version-update-modal')).toBeInTheDocument()
    expect(screen.getByText('Rhizome 2026.4.16')).toBeInTheDocument()
    expect(screen.getByTestId('version-update-rhizome-notes')).toHaveTextContent('Bug fixes and improvements')
    expect(screen.queryByText(/Chat engine/)).not.toBeInTheDocument()
  })

  it('Rhizome "Update now" starts the real download flow and closes the modal', () => {
    const { rhizomeActions } = renderIndicator({ rhizomeStatus: rhizomeAvailable() })

    fireEvent.click(screen.getByTestId('status-version-update'))
    fireEvent.click(screen.getByTestId('version-update-rhizome-update-now'))

    expect(rhizomeActions.startDownload).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('version-update-modal')).not.toBeInTheDocument()
  })

  it('Maybe later closes the modal without starting the download', () => {
    const { rhizomeActions } = renderIndicator({ rhizomeStatus: rhizomeAvailable() })

    fireEvent.click(screen.getByTestId('status-version-update'))
    fireEvent.click(screen.getByTestId('version-update-maybe-later'))

    expect(screen.queryByTestId('version-update-modal')).not.toBeInTheDocument()
    expect(rhizomeActions.startDownload).not.toHaveBeenCalled()
  })
})
