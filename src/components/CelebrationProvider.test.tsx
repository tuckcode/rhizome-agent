import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CelebrationProvider } from './CelebrationProvider'
import { useCelebration } from './celebrationContext'
import { CELEBRATION_COOLDOWN_MS } from '../lib/celebration'

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

  it('is a no-op outside a provider rather than a crash', () => {
    const results: boolean[] = []
    render(<Trigger onResult={(fired) => results.push(fired)} />)

    screen.getByRole('button', { name: 'celebrate' }).click()

    expect(results).toEqual([false])
  })
})
