import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeThinkingToggle } from './PrimeThinkingToggle'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  levels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as string[],
  supported: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as string[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_prime_thinking_levels') return Promise.resolve(invoked.levels)
    if (cmd === 'get_prime_supported_thinking_levels') return Promise.resolve(invoked.supported)
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ levels: [] as Array<{ level: string; source?: string }> }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeThinkingLevelChanged: (level: string, source?: string) => {
    tracked.levels.push({ level, source })
  },
}))

beforeEach(() => {
  invoked.calls = []
  invoked.levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
  invoked.supported = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
  tracked.levels = []
})

describe('PrimeThinkingToggle', () => {
  it('shows the current level without hovering', () => {
    render(<PrimeThinkingToggle thinkingLevel="off" />)
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveTextContent('Off')
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks a loud level as pressed so the next turn is obviously different', () => {
    render(<PrimeThinkingToggle thinkingLevel="high" />)
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  function openPill() {
    // Radix opens on pointerdown, not click.
    fireEvent.pointerDown(
      screen.getByTestId('prime-thinking-toggle'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
  }

  it('opens a menu of every host thinking level', async () => {
    render(<PrimeThinkingToggle thinkingLevel="off" vaultPath="/vault" />)
    openPill()

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-pill-menu')).toBeInTheDocument()
    })
    for (const level of invoked.levels) {
      expect(screen.getByTestId(`prime-thinking-pill-${level}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('prime-thinking-pill-xhigh')).toHaveTextContent('X-High')
  })

  it('offers only the levels the attached model can run', async () => {
    // deepseek-v4-flash, as the host reports it: `medium` is null in the
    // model's map. Prime clamps the pick up to High, so offering Medium was a
    // click that applied nothing and read as the pill being stuck.
    invoked.supported = ['off', 'high', 'xhigh']
    render(<PrimeThinkingToggle thinkingLevel="high" vaultPath="/vault" />)
    openPill()

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-pill-high')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-thinking-pill-off')).toBeInTheDocument()
    expect(screen.getByTestId('prime-thinking-pill-xhigh')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-thinking-pill-medium')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-thinking-pill-max')).not.toBeInTheDocument()
  })

  it('says the model is the reason when the menu is shorter than the scale', async () => {
    invoked.supported = ['off', 'high', 'xhigh']
    render(<PrimeThinkingToggle thinkingLevel="high" vaultPath="/vault" />)
    openPill()

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-pill-model-limited')).toHaveTextContent(
        'Limited by this model',
      )
    })
  })

  it('offers the whole scale when the model answer cannot be read', async () => {
    // An unreadable answer is not an answer. Hiding levels the user has would
    // be a worse failure than showing one the model refuses.
    invoked.supported = []
    render(<PrimeThinkingToggle thinkingLevel="off" vaultPath="/vault" />)
    openPill()

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-pill-medium')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('prime-thinking-pill-model-limited')).not.toBeInTheDocument()
  })

  it('loads thinking levels without starting Prime from an empty vault', async () => {
    render(<PrimeThinkingToggle thinkingLevel="off" />)
    openPill()

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-pill-medium')).toBeInTheDocument()
    })
    expect(invoked.calls.map((call) => call.cmd)).toContain('get_prime_thinking_levels')
    expect(invoked.calls.map((call) => call.cmd)).not.toContain('ensure_prime_session_host')
  })

  it('sets the chosen level from the pill menu', async () => {
    render(<PrimeThinkingToggle thinkingLevel="off" vaultPath="/vault" />)
    openPill()
    await waitFor(() => expect(screen.getByTestId('prime-thinking-pill-medium')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('prime-thinking-pill-medium'))

    await waitFor(() => {
      expect(invoked.calls.some((call) => call.cmd === 'set_prime_thinking_level')).toBe(true)
    })
    expect(invoked.calls.find((call) => call.cmd === 'set_prime_thinking_level')?.args).toEqual({
      level: 'medium',
    })
    expect(tracked.levels).toEqual([{ level: 'medium', source: 'pill' }])
  })
})
