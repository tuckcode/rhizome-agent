import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterFieldCombobox } from '../FilterFieldCombobox'

describe('FilterFieldCombobox', () => {
  it('renders its option list outside the clipped field container', () => {
    render(
      <div className="h-12 overflow-hidden">
        <FilterFieldCombobox value="status" fields={['status', 'title', 'Owner']} onChange={vi.fn()} />
      </div>,
    )

    const root = screen.getByTestId('filter-field-combobox')
    const input = screen.getByTestId('filter-field-combobox-input')

    fireEvent.focus(input)

    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(root.contains(listbox)).toBe(false)
  })

  it('renders the option list inside a dedicated scroll container', () => {
    render(
      <FilterFieldCombobox
        value="status"
        fields={Array.from({ length: 20 }, (_, index) => `Field ${index + 1}`)}
        onChange={vi.fn()}
      />,
    )

    fireEvent.focus(screen.getByTestId('filter-field-combobox-input'))

    expect(screen.getByTestId('filter-field-combobox-scroll-area')).toHaveClass(
      'max-h-60',
      'overflow-y-auto',
      'overscroll-contain',
    )
  })

  it('stops wheel events from bubbling out of the scroll container', () => {
    const onWheel = vi.fn()

    render(
      <div onWheel={onWheel}>
        <FilterFieldCombobox
          value="status"
          fields={Array.from({ length: 20 }, (_, index) => `Field ${index + 1}`)}
          onChange={vi.fn()}
        />
      </div>,
    )

    fireEvent.focus(screen.getByTestId('filter-field-combobox-input'))
    fireEvent.wheel(screen.getByTestId('filter-field-combobox-scroll-area'))

    expect(onWheel).not.toHaveBeenCalled()
  })
})
