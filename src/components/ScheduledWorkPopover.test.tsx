import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Heartbeat } from '@phosphor-icons/react'
import { ScheduledWorkPopover } from './ScheduledWorkPopover'
import { withHeartbeatFlag, type PrimeScheduledWork } from '../lib/primeScheduledWork'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  fail: '',
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (invoked.fail) return Promise.reject(new Error(invoked.fail))
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ actions: [] as string[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeScheduledWorkAction: (action: string) => tracked.actions.push(action),
}))

vi.mock('../lib/i18n', () => ({
  DEFAULT_APP_LOCALE: 'en',
  createTranslator: () => (key: string) => key,
}))

function work(overrides: Partial<PrimeScheduledWork> = {}): PrimeScheduledWork {
  return {
    id: 'job-1',
    label: 'Check open work',
    interval: 'every 30 minutes',
    status: 'active',
    source: 'heartbeat',
    ...overrides,
  }
}

function open(items: PrimeScheduledWork[], onChanged = vi.fn()) {
  render(
    <ScheduledWorkPopover
      icon={Heartbeat}
      summary="2 heartbeats"
      items={withHeartbeatFlag(items)}
      onChanged={onChanged}
    />,
  )
  fireEvent.click(screen.getByTestId('scheduled-work-trigger'))
  return onChanged
}

const cmds = () => invoked.calls.map((c) => c.cmd)

beforeEach(() => {
  invoked.calls = []
  invoked.fail = ''
  tracked.actions = []
})

describe('ScheduledWorkPopover', () => {
  it('renders nothing at all when nothing is scheduled', () => {
    // #14: the strip must not advertise features that are not in use.
    render(
      <ScheduledWorkPopover icon={Heartbeat} summary="0" items={[]} onChanged={vi.fn()} />,
    )
    expect(screen.queryByTestId('scheduled-work-trigger')).not.toBeInTheDocument()
  })

  it('lists each entry individually, not just a count', async () => {
    open([work({ id: 'a' }), work({ id: 'b', label: 'Second prompt' })])
    const rows = await screen.findAllByTestId('scheduled-work-row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent('Second prompt')
  })

  it('pauses a heartbeat through heartbeat_manage', async () => {
    const onChanged = open([work()])
    fireEvent.click(await screen.findByTestId('scheduled-work-pause'))

    await waitFor(() => expect(cmds()).toContain('manage_prime_heartbeat'))
    const call = invoked.calls.find((c) => c.cmd === 'manage_prime_heartbeat')
    expect(call?.args).toEqual({ jobId: 'job-1', action: 'pause' })
    // The row must update immediately, not after the 15s poll (#14).
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(tracked.actions).toContain('pause')
  })

  it('offers resume rather than pause once paused', async () => {
    open([work({ status: 'paused' })])
    fireEvent.click(await screen.findByTestId('scheduled-work-pause'))

    await waitFor(() => {
      const call = invoked.calls.find((c) => c.cmd === 'manage_prime_heartbeat')
      expect(call?.args).toEqual({ jobId: 'job-1', action: 'resume' })
    })
  })

  it('never offers pause on a plain schedule', async () => {
    // The daemon has no cron_pause; a pause button here could not be honoured.
    open([work({ source: 'cron' })])
    await screen.findByTestId('scheduled-work-row')
    expect(screen.queryByTestId('scheduled-work-pause')).not.toBeInTheDocument()
    expect(screen.getByTestId('scheduled-work-cancel')).toBeInTheDocument()
  })

  it('cancels either kind through cron_cancel', async () => {
    open([work({ source: 'cron', id: 'cron-1' })])
    fireEvent.click(await screen.findByTestId('scheduled-work-cancel'))

    await waitFor(() => expect(cmds()).toContain('cancel_prime_scheduled_work'))
    const call = invoked.calls.find((c) => c.cmd === 'cancel_prime_scheduled_work')
    expect(call?.args).toEqual({ jobId: 'cron-1' })
  })

  it('surfaces a refusal instead of leaving the row silently unchanged', async () => {
    invoked.fail = 'no such job'
    const onChanged = open([work()])
    fireEvent.click(await screen.findByTestId('scheduled-work-pause'))

    expect(await screen.findByRole('alert')).toHaveTextContent('no such job')
    expect(onChanged).not.toHaveBeenCalled()
  })
})
