import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as statusStyles from '../utils/statusStyles'
import { StatusDropdown } from './StatusDropdown'

describe('StatusDropdown extra coverage', () => {
  const onSave = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps keyboard navigation to the create option and scrolls highlighted items into view', () => {
    const scrollSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})

    render(
      <StatusDropdown
        value="Active"
        vaultStatuses={['Doing']}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    const input = screen.getByTestId('status-search-input')
    fireEvent.change(input, { target: { value: 'Needs Review' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(scrollSpy).toHaveBeenCalled()
    expect(onSave).toHaveBeenCalledWith('Needs Review')

    scrollSpy.mockRestore()
  })

  it('opens color pickers and persists the selected accent color', () => {
    const setStatusColorSpy = vi.spyOn(statusStyles, 'setStatusColor')

    render(
      <StatusDropdown
        value="Active"
        vaultStatuses={['Active']}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByTestId('status-color-swatch-Active'))
    expect(screen.getByTestId('color-picker-Active')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('color-option-green'))

    expect(setStatusColorSpy).toHaveBeenCalledWith('Active', 'green')
    expect(screen.queryByTestId('color-picker-Active')).not.toBeInTheDocument()
  })
})
