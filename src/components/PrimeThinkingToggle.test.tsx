import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeThinkingToggle } from './PrimeThinkingToggle'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  levels: ['off', 'low', 'high'] as string[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_prime_thinking_levels') return Promise.resolve(invoked.levels)
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
  invoked.levels = ['off', 'low', 'high']
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

  it('cycles off to high from the host list', async () => {
    render(<PrimeThinkingToggle thinkingLevel="off" vaultPath="/vault" />)
    fireEvent.click(screen.getByTestId('prime-thinking-toggle'))

    await waitFor(() => {
      expect(invoked.calls.map((call) => call.cmd)).toEqual([
        'ensure_prime_session_host',
        'get_prime_thinking_levels',
        'set_prime_thinking_level',
      ])
    })
    expect(invoked.calls.find((call) => call.cmd === 'set_prime_thinking_level')?.args).toEqual({
      level: 'high',
    })
    expect(tracked.levels).toEqual([{ level: 'high', source: 'toggle' }])
  })
})
