import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VaultPanel, VaultPanelRestoreButton } from './VaultPanel'

vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

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

  it('offers a Hide Chat control next to Browse and Collapse', () => {
    const onFocusToggle = vi.fn()
    render(
      <VaultPanel
        browseOpen={false}
        locale="en"
        navigation={<div />}
        noteList={<div />}
        onBrowseToggle={vi.fn()}
        onCollapse={vi.fn()}
        onFocusToggle={onFocusToggle}
      />,
    )

    const focus = screen.getByTestId('vault-panel-focus')
    expect(focus).toHaveAccessibleName('Hide Chat')
    expect(focus).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(focus)
    expect(onFocusToggle).toHaveBeenCalledOnce()
  })

  it('labels the control Show Chat while Notes already fill the window', () => {
    render(
      <VaultPanel
        browseOpen={false}
        focused
        locale="en"
        navigation={<div />}
        noteList={<div />}
        onBrowseToggle={vi.fn()}
        onCollapse={vi.fn()}
        onFocusToggle={vi.fn()}
      />,
    )

    const focus = screen.getByTestId('vault-panel-focus')
    expect(focus).toHaveAccessibleName('Show Chat')
    expect(focus).toHaveAttribute('aria-pressed', 'true')
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
    expect(screen.queryByTestId('vault-panel-focus')).not.toBeInTheDocument()
    expect(screen.queryByTestId('vault-panel-navigation')).not.toBeInTheDocument()
  })

  it('gives Browse and Hide Chat an overflow menu with the same handlers as the inline buttons', async () => {
    const onBrowseToggle = vi.fn()
    const onFocusToggle = vi.fn()
    render(
      <VaultPanel
        browseOpen={false}
        locale="en"
        navigation={<div />}
        noteList={<div />}
        onBrowseToggle={onBrowseToggle}
        onCollapse={vi.fn()}
        onFocusToggle={onFocusToggle}
      />,
    )

    const trigger = screen.getByTestId('vault-panel-overflow-trigger')
    expect(trigger).toHaveAccessibleName('More Notes actions')

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const menu = await screen.findByRole('menu')

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Show note navigation' }))
    expect(onBrowseToggle).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const reopenedMenu = await screen.findByRole('menu')
    fireEvent.click(within(reopenedMenu).getByRole('menuitem', { name: 'Hide Chat' }))
    expect(onFocusToggle).toHaveBeenCalledTimes(1)
  })

  it('keeps the title, its inline tools, and the collapse control as siblings — never absolutely positioned over each other', () => {
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

    const title = screen.getByText('Notes')
    const inlineTools = screen.getByTestId('vault-panel-inline-tools')
    const collapse = screen.getByTestId('vault-panel-collapse')
    expect(inlineTools.className).not.toMatch(/\babsolute\b/)
    expect(title.compareDocumentPosition(inlineTools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(inlineTools.compareDocumentPosition(collapse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('labels the closed Notes strip as Show Notes', () => {
    render(<VaultPanelRestoreButton locale="en" onClick={vi.fn()} />)
    const restore = screen.getByTestId('vault-panel-restore')
    expect(restore).toHaveAccessibleName('Show Notes')
    expect(restore.closest('.app__notes-rail')).not.toHaveClass('app__notes-rail--restore')
  })

  it('matches the collapsed left command rail at 46px', () => {
    render(<VaultPanelRestoreButton locale="en" onClick={vi.fn()} />)
    const rail = document.querySelector('.app__notes-rail')
    expect(rail).toHaveStyle({
      width: '46px',
      minWidth: '46px',
      maxWidth: '46px',
    })
    expect(screen.getByTestId('vault-panel-restore')).toHaveStyle({
      width: '32px',
      height: '32px',
    })
  })
})
