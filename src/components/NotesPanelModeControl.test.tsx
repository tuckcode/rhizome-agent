import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotesPanelModeControl } from './NotesPanelModeControl'

describe('NotesPanelModeControl', () => {
  it('shows three direct choices and marks the selected mode', () => {
    const onModeChange = vi.fn()
    render(<NotesPanelModeControl mode="auto" onModeChange={onModeChange} />)

    const group = screen.getByRole('group', { name: 'Notes panel mode' })
    const auto = within(group).getByRole('button', { name: 'Auto' })
    const rail = within(group).getByRole('button', { name: 'Rail' })
    expect(auto).toHaveAttribute('aria-pressed', 'true')
    expect(rail).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByRole('button', { name: 'Open' })).toBeVisible()

    fireEvent.click(rail)
    expect(onModeChange).toHaveBeenCalledWith('rail')
  })

  it('explains when the window folds the saved Open mode', () => {
    render(<NotesPanelModeControl mode="open" onModeChange={vi.fn()} windowTooNarrow />)
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAccessibleDescription('Window too narrow to keep Notes open.')
  })

  it('explains temporary expansion without changing the saved mode', () => {
    render(<NotesPanelModeControl mode="rail" onModeChange={vi.fn()} openForNow />)
    const rail = screen.getByRole('button', { name: 'Rail' })
    expect(rail).toHaveAttribute('aria-pressed', 'true')
    expect(rail).toHaveAccessibleDescription('Notes is open for now.')
  })
})
