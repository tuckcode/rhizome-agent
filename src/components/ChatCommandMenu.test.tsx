import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatCommandMenu } from './ChatCommandMenu'
import type { CommandMenuEntry } from '../lib/primeCommandMenu'

const entries: CommandMenuEntry[] = [
  { name: 'fork', slash: 'fork', description: 'Branch from a past message', kind: 'instant' },
  { name: 'compact', slash: 'compact', description: 'Compact this conversation', kind: 'instant' },
  { name: 'skill:goal', slash: 'goal', description: 'Set a persistent objective', kind: 'skill' },
]

function renderMenu(overrides: Partial<React.ComponentProps<typeof ChatCommandMenu>> = {}) {
  return render(
    <ChatCommandMenu
      entries={entries}
      selectedIndex={0}
      onHover={vi.fn()}
      onSelect={vi.fn()}
      onDismiss={vi.fn()}
      skillLabel="Skill"
      instantLabel="Command"
      {...overrides}
    />,
  )
}

describe('ChatCommandMenu', () => {
  it('lists each command with what it does', () => {
    renderMenu()

    const menu = screen.getByTestId('command-menu')
    expect(menu).toHaveTextContent('fork')
    expect(menu).toHaveTextContent('Branch from a past message')
    expect(menu).toHaveTextContent('goal')
    expect(menu).toHaveTextContent('Set a persistent objective')
  })

  it('marks skills as distinct from instant commands', () => {
    renderMenu()

    expect(screen.getByTestId('command-menu-item-goal')).toHaveTextContent('Skill')
    expect(screen.getByTestId('command-menu-item-fork')).toHaveTextContent('Command')
  })

  it('does not run a disabled command', () => {
    const onSelect = vi.fn()
    renderMenu({
      onSelect,
      disabled: { fork: 'Needs a past message to branch from' },
    })

    fireEvent.click(screen.getByTestId('command-menu-item-fork'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByTestId('command-menu-item-fork')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('command-menu-item-fork')).toHaveTextContent(
      'Needs a past message to branch from',
    )
  })

  it('selects with the mouse and with Enter', () => {
    const onSelect = vi.fn()
    renderMenu({ onSelect, selectedIndex: 1 })

    fireEvent.click(screen.getByTestId('command-menu-item-compact'))
    expect(onSelect).toHaveBeenCalledWith(1)

    fireEvent.keyDown(screen.getByTestId('command-menu'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
