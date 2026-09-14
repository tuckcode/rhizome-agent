import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrimeActiveCloseDialog } from './PrimeActiveCloseDialog'

describe('PrimeActiveCloseDialog', () => {
  it('makes Stop and close the primary action', () => {
    const onStopAndClose = vi.fn()
    const onKeepWorking = vi.fn()
    const onCancel = vi.fn()

    render(
      <PrimeActiveCloseDialog
        open={true}
        onStopAndClose={onStopAndClose}
        onKeepWorking={onKeepWorking}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByTestId('prime-active-close-stop')).toHaveTextContent('Stop and close')
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }))
    expect(onKeepWorking).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('prime-active-close-stop'))
    expect(onStopAndClose).toHaveBeenCalled()
  })

  it('lets Cancel leave without stopping or promoting', () => {
    const onStopAndClose = vi.fn()
    const onKeepWorking = vi.fn()
    const onCancel = vi.fn()

    render(
      <PrimeActiveCloseDialog
        open={true}
        onStopAndClose={onStopAndClose}
        onKeepWorking={onKeepWorking}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onStopAndClose).not.toHaveBeenCalled()
    expect(onKeepWorking).not.toHaveBeenCalled()
  })
})
