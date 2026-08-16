import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PrimeGoalDialog } from './PrimeGoalDialog'

describe('PrimeGoalDialog', () => {
  it('does not render when closed', () => {
    render(
      <PrimeGoalDialog
        open={false}
        onOpenChange={vi.fn()}
        currentGoal={null}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('prime-goal-dialog')).not.toBeInTheDocument()
  })

  it('offers "Set goal" with no active goal, and reports none is active', () => {
    render(
      <PrimeGoalDialog
        open
        onOpenChange={vi.fn()}
        currentGoal={null}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Set goal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear goal' })).not.toBeInTheDocument()
    expect(screen.getByTestId('prime-goal-current')).toHaveTextContent('No active goal.')
  })

  it('offers "Replace goal" and "Clear goal" when a goal is already active', () => {
    render(
      <PrimeGoalDialog
        open
        onOpenChange={vi.fn()}
        currentGoal={{ active: true, objective: 'ship the release notes' }}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Replace goal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear goal' })).toBeInTheDocument()
    expect(screen.getByTestId('prime-goal-current')).toHaveTextContent(
      'Active: ship the release notes',
    )
  })

  it('disables Set until an objective is typed', () => {
    render(
      <PrimeGoalDialog
        open
        onOpenChange={vi.fn()}
        currentGoal={null}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Set goal' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'write the report' } })
    expect(screen.getByRole('button', { name: 'Set goal' })).not.toBeDisabled()
  })

  it('rejects a non-numeric budget without calling onSetGoal', () => {
    const onSetGoal = vi.fn()
    render(
      <PrimeGoalDialog
        open
        onOpenChange={vi.fn()}
        currentGoal={null}
        onSetGoal={onSetGoal}
        onClearGoal={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'write the report' } })
    fireEvent.change(screen.getByLabelText('Token budget (optional)'), {
      target: { value: 'lots' },
    })
    expect(screen.getByText('Token budget must be a positive whole number.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set goal' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Set goal' }))
    expect(onSetGoal).not.toHaveBeenCalled()
  })

  it('shows the exact /goal text that will be sent', () => {
    render(
      <PrimeGoalDialog
        open
        onOpenChange={vi.fn()}
        currentGoal={null}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'ship it' } })
    fireEvent.change(screen.getByLabelText('Token budget (optional)'), {
      target: { value: '5000' },
    })
    expect(screen.getByTestId('prime-goal-preview')).toHaveTextContent(
      'Runs: /goal --budget 5000 ship it',
    )
  })

  it('calls onSetGoal with the trimmed objective and parsed budget, and closes on success', async () => {
    const onSetGoal = vi.fn().mockResolvedValue({ objective: 'ship it' })
    const onOpenChange = vi.fn()
    render(
      <PrimeGoalDialog
        open
        onOpenChange={onOpenChange}
        currentGoal={null}
        onSetGoal={onSetGoal}
        onClearGoal={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: '  ship it  ' } })
    fireEvent.change(screen.getByLabelText('Token budget (optional)'), {
      target: { value: '5000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set goal' }))

    await waitFor(() => expect(onSetGoal).toHaveBeenCalledWith('ship it', 5000))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  /**
   * The dialog must never report success on its own — only on whatever
   * `onSetGoal` resolves with. A rejection (the backend re-read did not
   * confirm the goal, #20) has to surface as an error, not a silent close.
   */
  it('shows an error and stays open when onSetGoal rejects', async () => {
    const onSetGoal = vi.fn().mockRejectedValue(new Error('Prime did not confirm the goal was set'))
    const onOpenChange = vi.fn()
    render(
      <PrimeGoalDialog
        open
        onOpenChange={onOpenChange}
        currentGoal={null}
        onSetGoal={onSetGoal}
        onClearGoal={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'ship it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set goal' }))

    await waitFor(() =>
      expect(screen.getByTestId('prime-goal-error')).toHaveTextContent(
        'Prime did not confirm the goal was set',
      ),
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('calls onClearGoal and closes on success', async () => {
    const onClearGoal = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    render(
      <PrimeGoalDialog
        open
        onOpenChange={onOpenChange}
        currentGoal={{ active: true, objective: 'ship the release notes' }}
        onSetGoal={vi.fn()}
        onClearGoal={onClearGoal}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear goal' }))

    await waitFor(() => expect(onClearGoal).toHaveBeenCalled())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('shows an error and stays open when onClearGoal rejects', async () => {
    const onClearGoal = vi.fn().mockRejectedValue(new Error('Prime did not confirm the goal was cleared'))
    const onOpenChange = vi.fn()
    render(
      <PrimeGoalDialog
        open
        onOpenChange={onOpenChange}
        currentGoal={{ active: true, objective: 'ship the release notes' }}
        onSetGoal={vi.fn()}
        onClearGoal={onClearGoal}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear goal' }))

    await waitFor(() =>
      expect(screen.getByTestId('prime-goal-error')).toHaveTextContent(
        'Prime did not confirm the goal was cleared',
      ),
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
