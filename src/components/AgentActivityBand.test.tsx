import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentActivityBand, type PrimeAgentActivity } from './AgentActivityBand'

function band(activity: PrimeAgentActivity) {
  return render(<AgentActivityBand now={activity} />)
}

describe('AgentActivityBand', () => {
  /**
   * The band appearing is itself the signal. An idle session with no goal and
   * nothing scheduled must not get a row of zeroes reporting that nothing is
   * happening — that is noise where silence is the honest answer.
   */
  it('renders nothing when the harness is doing nothing', () => {
    band({ goal: { active: false }, heartbeats: [], schedules: [] })

    expect(screen.queryByTestId('agent-activity-band')).not.toBeInTheDocument()
  })

  it('renders nothing before the first read lands', () => {
    render(<AgentActivityBand />)

    expect(screen.queryByTestId('agent-activity-band')).not.toBeInTheDocument()
  })

  it('shows an active goal with its objective and remaining budget', () => {
    band({
      goal: {
        active: true,
        objective: 'ship the release notes',
        remainingTokens: 80_000,
      },
    })

    expect(screen.getByTestId('agent-activity-band')).toHaveTextContent(
      'Goal · ship the release notes',
    )
    expect(screen.getByTestId('agent-activity-band')).toHaveTextContent('80k left')
  })

  /** A goal can be active before it has objective text. */
  it('still reports an active goal with no objective', () => {
    band({ goal: { active: true } })

    expect(screen.getByTestId('agent-activity-band')).toHaveTextContent('Goal active')
  })

  it('counts heartbeats and shows the first interval', () => {
    band({ heartbeats: [{ id: 'hb-1', label: 'tests', interval: '5m' }, { id: 'hb-2' }] })

    const strip = screen.getByTestId('agent-activity-band')
    expect(strip).toHaveTextContent('2 heartbeat(s)')
    expect(strip).toHaveTextContent('5m')
  })

  it('counts schedules separately from heartbeats', () => {
    band({ schedules: [{ id: 'job-1' }] })

    expect(screen.getByTestId('agent-activity-band')).toHaveTextContent('1 scheduled')
  })

  /** Thinking level rides along, but is not on its own reason to show a band —
   *  every session has one, so it would make the band permanent. */
  it('does not show a band for thinking level alone', () => {
    band({ goal: { active: false }, thinkingLevel: 'high' })

    expect(screen.queryByTestId('agent-activity-band')).not.toBeInTheDocument()
  })

  it('shows thinking level alongside real activity', () => {
    band({ goal: { active: true }, thinkingLevel: 'high' })

    expect(screen.getByTestId('agent-activity-band')).toHaveTextContent('thinking high')
  })

  it('is silent when disabled, whatever the activity says', () => {
    render(<AgentActivityBand enabled={false} now={{ goal: { active: true } }} />)

    expect(screen.queryByTestId('agent-activity-band')).not.toBeInTheDocument()
  })
})
