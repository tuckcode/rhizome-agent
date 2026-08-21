import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CELEBRATION_TOAST_MS, CelebrationProvider } from './CelebrationProvider'
import { useCelebration } from './celebrationContext'
import { CELEBRATION_COOLDOWN_MS } from '../lib/celebration'
import { requestCelebration } from '../lib/celebrationEvents'

const tracked = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackCelebration: (payload: unknown) => tracked.calls.push(payload),
}))

/** Exposes the hook to the test without a real feature using it yet. */
function Trigger({ onResult }: { onResult: (fired: boolean) => void }) {
  const { celebrate } = useCelebration()
  return (
    <button type="button" onClick={() => onResult(celebrate('goal-completed'))}>
      celebrate
    </button>
  )
}

describe('CelebrationProvider', () => {
  beforeEach(() => {
    tracked.calls = []
    vi.useRealTimers()
  })

  it('mounts exactly one cannon for the whole app', () => {
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    expect(screen.getAllByTestId('confetti-cannon')).toHaveLength(1)
  })

  it('fires the first request and refuses the next inside the cooldown', () => {
    const results: boolean[] = []
    render(
      <CelebrationProvider>
        <Trigger onResult={(fired) => results.push(fired)} />
      </CelebrationProvider>,
    )

    const button = screen.getByRole('button', { name: 'celebrate' })
    button.click()
    button.click()

    expect(results).toEqual([true, false])
  })

  it('opens again once the cooldown has elapsed', () => {
    vi.useFakeTimers()
    const results: boolean[] = []
    render(
      <CelebrationProvider>
        <Trigger onResult={(fired) => results.push(fired)} />
      </CelebrationProvider>,
    )

    const button = screen.getByRole('button', { name: 'celebrate' })
    button.click()
    vi.advanceTimersByTime(CELEBRATION_COOLDOWN_MS + 1)
    button.click()

    expect(results).toEqual([true, true])
    vi.useRealTimers()
  })

  it('refuses everything when the setting is off', () => {
    const results: boolean[] = []
    render(
      <CelebrationProvider enabled={false}>
        <Trigger onResult={(fired) => results.push(fired)} />
      </CelebrationProvider>,
    )

    screen.getByRole('button', { name: 'celebrate' }).click()

    expect(results).toEqual([false])
  })

  /** Every request is reported, refusals included — that is the useful half. */
  it('reports the refusal, not just the celebration', () => {
    render(
      <CelebrationProvider enabled={false}>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    screen.getByRole('button', { name: 'celebrate' }).click()

    expect(tracked.calls).toEqual([
      { reason: 'goal-completed', shown: false, refusal: 'disabled' },
    ])
  })

  /**
   * The agent's `show_confetti` arrives over the WebSocket, is dispatched as a
   * browser event by `App`, and lands here. It goes through the same gate as
   * the goal trigger — the whole point of ADR-0164 is that the agent cannot
   * bypass the cooldown or the setting by asking loudly.
   */
  it('celebrates when the agent asks', () => {
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({ message: 'Migration landed', from: 'Prime' })
    })

    expect(tracked.calls).toEqual([{ reason: 'agent', shown: true, refusal: undefined }])
  })

  it('refuses the agent inside the cooldown, exactly as it refuses anything else', () => {
    const results: boolean[] = []
    render(
      <CelebrationProvider>
        <Trigger onResult={(fired) => results.push(fired)} />
      </CelebrationProvider>,
    )

    screen.getByRole('button', { name: 'celebrate' }).click()
    act(() => {
      requestCelebration({ message: 'And again' })
    })

    expect(results).toEqual([true])
    expect(tracked.calls).toEqual([
      { reason: 'goal-completed', shown: true, refusal: undefined },
      { reason: 'agent', shown: false, refusal: 'cooldown' },
    ])
  })

  it('ignores the agent entirely when celebrations are off', () => {
    render(
      <CelebrationProvider enabled={false}>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({})
    })

    expect(tracked.calls).toEqual([{ reason: 'agent', shown: false, refusal: 'disabled' }])
  })

  it('shows the agent’s words alongside the confetti', () => {
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({ message: 'Migration landed', from: 'Prime' })
    })

    expect(screen.getByTestId('celebration-toast')).toBeInTheDocument()
    expect(screen.getByText('Migration landed')).toBeInTheDocument()
    expect(screen.getByText('From Prime')).toBeInTheDocument()
  })

  it('says nothing when the agent sent no words', () => {
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({})
    })

    expect(screen.queryByTestId('celebration-toast')).not.toBeInTheDocument()
  })

  /**
   * A refusal is silent in both halves. Showing the words while suppressing
   * the confetti would turn the cooldown into a second, quieter celebration —
   * which is the thing the cooldown exists to prevent.
   */
  it('stays silent when the celebration was refused', () => {
    render(
      <CelebrationProvider enabled={false}>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({ message: 'Migration landed' })
    })

    expect(screen.queryByTestId('celebration-toast')).not.toBeInTheDocument()
  })

  it('clears the words after a few seconds', () => {
    vi.useFakeTimers()
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({ message: 'Migration landed' })
    })
    expect(screen.getByTestId('celebration-toast')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(CELEBRATION_TOAST_MS + 1)
    })

    expect(screen.queryByTestId('celebration-toast')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('can be dismissed before it expires', () => {
    render(
      <CelebrationProvider>
        <Trigger onResult={vi.fn()} />
      </CelebrationProvider>,
    )

    act(() => {
      requestCelebration({ message: 'Migration landed' })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    })

    expect(screen.queryByTestId('celebration-toast')).not.toBeInTheDocument()
  })

  it('is a no-op outside a provider rather than a crash', () => {
    const results: boolean[] = []
    render(<Trigger onResult={(fired) => results.push(fired)} />)

    screen.getByRole('button', { name: 'celebrate' }).click()

    expect(results).toEqual([false])
  })
})
