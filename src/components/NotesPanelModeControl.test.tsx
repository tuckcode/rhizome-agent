import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotesPanelModeControl } from './NotesPanelModeControl'

vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('NotesPanelModeControl', () => {
  it('shows the current mode and a menu with icon, sentence-case label, and check', async () => {
    const onModeChange = vi.fn()
    render(<NotesPanelModeControl mode="auto" onModeChange={onModeChange} />)

    const trigger = screen.getByTestId('notes-panel-mode-trigger')
    expect(trigger).toHaveAttribute('data-mode', 'auto')
    expect(trigger).toHaveAccessibleName('Panel: auto')
    expect(trigger).toHaveClass('h-6')
    expect(trigger).toHaveStyle({ width: '24px', height: '24px', borderRadius: '8px' })

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    const menu = await screen.findByTestId('notes-panel-mode-menu')
    expect(within(menu).getByTestId('notes-panel-mode-auto')).toHaveTextContent('Auto')
    expect(within(menu).getByTestId('notes-panel-mode-rail')).toHaveTextContent('Rail')
    expect(within(menu).getByTestId('notes-panel-mode-open')).toHaveTextContent('Open')
    expect(within(menu).getByTestId('notes-panel-mode-auto')).toHaveAttribute('data-checked', 'true')
    expect(within(menu).getByTestId('notes-panel-mode-rail')).toHaveAttribute('data-checked', 'false')

    fireEvent.click(within(menu).getByTestId('notes-panel-mode-rail'))
    expect(onModeChange).toHaveBeenCalledWith('rail')
  })
})
