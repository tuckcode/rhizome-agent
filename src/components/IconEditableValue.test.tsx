import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IconEditableValue } from './IconEditableValue'

function renderIconValue(overrides: Partial<React.ComponentProps<typeof IconEditableValue>> = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const onStartEdit = vi.fn()

  render(
    <IconEditableValue
      value=""
      onSave={onSave}
      onCancel={onCancel}
      isEditing
      onStartEdit={onStartEdit}
      {...overrides}
    />,
  )

  return { onSave, onCancel, onStartEdit }
}

describe('IconEditableValue', () => {
  it('left-aligns the icon display in view mode', () => {
    render(
      <IconEditableValue
        value="rocket"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        isEditing={false}
        onStartEdit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('icon-editable-display')).toHaveClass('text-left')
  })

  it('shows searchable icon results with previews while editing', () => {
    renderIconValue()

    expect(screen.getByTestId('icon-editable-input')).toHaveAttribute('role', 'combobox')
    expect(screen.getByTestId('icon-picker-results')).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })

  it('selects the first matching icon on Enter for icon-name queries', () => {
    const { onSave } = renderIconValue()
    const input = screen.getByTestId('icon-editable-input')

    fireEvent.change(input, { target: { value: 'rocket' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('rocket')
  })

  it('supports keyboard navigation before selecting an icon', () => {
    const { onSave } = renderIconValue()
    const input = screen.getByTestId('icon-editable-input')

    fireEvent.change(input, { target: { value: 'file' } })
    const options = screen.getAllByRole('option')

    expect(options.length).toBeGreaterThan(1)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith(options[1].textContent ?? '')
  })

  it('keeps manual URL values instead of forcing an icon suggestion', () => {
    const { onSave } = renderIconValue()
    const input = screen.getByTestId('icon-editable-input')

    fireEvent.change(input, { target: { value: 'https://example.com/icon.png' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('https://example.com/icon.png')
  })

  it('shows an empty state when no icon matches the query', () => {
    renderIconValue()
    const input = screen.getByTestId('icon-editable-input')

    fireEvent.change(input, { target: { value: 'totally-not-a-real-icon' } })

    expect(screen.getByTestId('icon-picker-empty')).toHaveTextContent('No icons found')
  })
})
