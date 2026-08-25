import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrimeScheduleDialog } from './PrimeScheduleDialog'

describe('PrimeScheduleDialog', () => {
  it('does not render when closed', () => {
    render(<PrimeScheduleDialog open={false} onOpenChange={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryByTestId('prime-schedule-dialog')).not.toBeInTheDocument()
  })

  it('refuses to submit without a cadence and a prompt', () => {
    const onCreate = vi.fn()
    render(<PrimeScheduleDialog open onOpenChange={vi.fn()} onCreate={onCreate} />)
    expect(screen.getByTestId('prime-schedule-submit')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: 'every 30 minutes' } })
    expect(screen.getByTestId('prime-schedule-submit')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'check open work' } })
    expect(screen.getByTestId('prime-schedule-submit')).not.toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates a heartbeat with steer delivery by default', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    render(<PrimeScheduleDialog open onOpenChange={onOpenChange} onCreate={onCreate} />)

    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: '30m' } })
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'check open work' } })
    fireEvent.click(screen.getByTestId('prime-schedule-submit'))

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('heartbeat', '30m', 'check open work', 'steer')
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('creates a cron schedule without offering heartbeat delivery', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<PrimeScheduleDialog open onOpenChange={vi.fn()} onCreate={onCreate} />)

    fireEvent.click(screen.getByTestId('prime-schedule-kind-cron'))
    expect(screen.queryByTestId('prime-schedule-delivery-steer')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: '0 9 * * 1-5' } })
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'weekday review' } })
    fireEvent.click(screen.getByTestId('prime-schedule-submit'))

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('cron', '0 9 * * 1-5', 'weekday review', 'steer')
    })
  })
})
