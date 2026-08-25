import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RlmFamilyBand } from './RlmFamilyBand'
import type { RlmFamilyMember } from '../lib/primeRunningSessions'

const callHost = vi.fn()

vi.mock('../lib/callHost', () => ({
  callHost: (...args: unknown[]) => callHost(...args),
}))

function member(overrides: Partial<RlmFamilyMember> = {}): RlmFamilyMember {
  return {
    id: 'kid',
    title: 'Review auth',
    activity: { kind: 'status', key: 'working' },
    working: true,
    depth: 1,
    ...overrides,
  }
}

describe('RlmFamilyBand', () => {
  it('renders nothing when the live session has no children', () => {
    render(<RlmFamilyBand liveSessionId="root" now={[]} />)
    expect(screen.queryByTestId('rlm-family-band')).not.toBeInTheDocument()
  })

  it('names each child and can ask Prime to stop one', async () => {
    callHost.mockResolvedValue(true)
    render(
      <RlmFamilyBand
        liveSessionId="root"
        now={[member(), member({ id: 'grandkid', title: 'Audit tests', depth: 2 })]}
      />,
    )

    expect(screen.getByTestId('rlm-family-band')).toHaveTextContent('2 subagent(s)')
    expect(screen.getAllByTestId('rlm-family-member')).toHaveLength(2)

    fireEvent.click(screen.getAllByTestId('rlm-family-stop')[0])
    await waitFor(() => {
      expect(callHost).toHaveBeenCalledWith('cancel_prime_rlm_child', { childId: 'kid' })
    })
  })
})
