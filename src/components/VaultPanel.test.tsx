import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VaultPanel, VaultPanelRestoreButton } from './VaultPanel'

describe('VaultPanel', () => {
  it('keeps navigation above the note list and collapses from one stable header', () => {
    const onBrowseToggle = vi.fn()
    const onCollapse = vi.fn()

    render(
      <VaultPanel
        browseOpen
        locale="en"
        navigation={<div>Inbox, Archive, Projects, Folders</div>}
        noteList={<div>Selected notes</div>}
        onBrowseToggle={onBrowseToggle}
        onCollapse={onCollapse}
      />,
    )

    expect(screen.getByTestId('vault-panel-navigation')).toHaveTextContent('Inbox, Archive, Projects, Folders')
    expect(screen.getByTestId('vault-panel-note-list')).toHaveTextContent('Selected notes')

    fireEvent.click(screen.getByTestId('vault-panel-browse-toggle'))
    fireEvent.click(screen.getByTestId('vault-panel-collapse'))

    expect(onBrowseToggle).toHaveBeenCalledTimes(1)
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('keeps every shell control at least 32px high', () => {
    render(
      <VaultPanel
        browseOpen={false}
        locale="en"
        navigation={<div />}
        noteList={<div />}
        onBrowseToggle={vi.fn()}
        onCollapse={vi.fn()}
      />,
    )

    expect(screen.getByTestId('vault-panel-browse-toggle')).toHaveClass('vault-panel__browse-toggle')
    expect(screen.getByTestId('vault-panel-collapse')).toHaveClass('vault-panel__collapse')
    expect(screen.queryByTestId('vault-panel-navigation')).not.toBeInTheDocument()
  })

  it('labels the closed Notes strip as Show Notes', () => {
    render(<VaultPanelRestoreButton locale="en" onClick={vi.fn()} />)
    const restore = screen.getByTestId('vault-panel-restore')
    expect(restore).toHaveAccessibleName('Show Notes')
    expect(restore).toHaveClass('app__notes-rail--restore')
  })
})
