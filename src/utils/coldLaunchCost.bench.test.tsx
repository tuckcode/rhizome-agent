import { writeFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COLD_LAUNCH_SESSION_ROWS,
  buildColdLaunchSessions,
  buildColdLaunchTranscript,
  median,
} from './coldLaunchCost'

/**
 * Cold-launch cost of two mounts.
 *
 * Transcript: fold the newest-log-sized fixture, then commit
 * `AiPanelMessageHistory` (the remount). Sessions rail: commit
 * `PrimeSessionList` through the summaries promise until the first
 * "Open session" row is in the document. jsdom, same process.
 *
 * One warmup, then fifteen iterations. The reported figure is the median.
 * The rail is timed first so the transcript mount does not heat the process
 * before that number.
 * Run with `COLD_LAUNCH_BENCH=1`. The default suite skips this file.
 */

const enabled = process.env.COLD_LAUNCH_BENCH === '1'
const ITERATIONS = 15

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging: vi.fn() }),
}))

const sessions = buildColdLaunchSessions()
const invoked = vi.hoisted(() => ({
  sessions: [] as unknown[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string) => {
    if (cmd === 'list_prime_running_sessions') return Promise.resolve([])
    if (cmd === 'list_prime_session_summaries') return Promise.resolve(invoked.sessions)
    return Promise.resolve(null)
  },
}))

vi.mock('../lib/productAnalytics', () => ({
  trackPrimeSessionListOpened: () => {},
  trackPrimeSessionOpened: () => {},
  trackPrimeSessionArchived: () => {},
  trackPrimeSessionListFiltered: () => {},
  trackPrimeSessionListScoped: () => {},
  trackPrimeSessionListSorted: () => {},
  trackPrimeSessionRenamed: () => {},
}))

async function flushList(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10
}

describe.skipIf(!enabled)('cold launch cost', () => {
  afterEach(() => {
    cleanup()
  })

  it('measures the transcript remount and the sessions rail', async () => {
    const { AiPanelMessageHistory } = await import('../components/AiPanelChrome')
    const { default: PrimeSessionList } = await import('../components/PrimeSessionList')
    const { primeTranscriptToConversation } = await import('../lib/primeTranscriptToConversation')
    const items = buildColdLaunchTranscript()
    invoked.sessions = sessions

    const railTotals: number[] = []
    let mountedRows = 0
    let railNodes = 0
    for (let index = 0; index < ITERATIONS + 1; index += 1) {
      const start = performance.now()
      const view = render(<PrimeSessionList locale="en" now={Date.UTC(2026, 8, 27, 15, 0, 0)} vaultPath="/Users/jdoe/code/projects/rhizome-agent" />)
      await flushList()
      const rows = screen.getAllByRole('button', { name: /Open session/ })
      const totalMs = performance.now() - start
      mountedRows = rows.length
      railNodes = view.container.querySelectorAll('*').length
      expect(mountedRows).toBeGreaterThan(0)
      cleanup()
      if (index === 0) continue
      railTotals.push(totalMs)
    }

    const transcriptTotals: number[] = []
    const transcriptConverts: number[] = []
    const transcriptMounts: number[] = []
    let messageCount = 0

    for (let index = 0; index < ITERATIONS + 1; index += 1) {
      const convertStart = performance.now()
      const messages = primeTranscriptToConversation(items)
      const convertMs = performance.now() - convertStart
      messageCount = messages.length
      const mountStart = performance.now()
      render(
        <AiPanelMessageHistory
          agentLabel="Prime"
          agentReadiness="ready"
          messages={messages}
          isActive={false}
          hasContext={false}
        />,
      )
      const mountMs = performance.now() - mountStart
      expect(screen.getByTestId('ai-panel-message-history')).toBeInTheDocument()
      cleanup()
      if (index === 0) continue
      transcriptConverts.push(convertMs)
      transcriptMounts.push(mountMs)
      transcriptTotals.push(convertMs + mountMs)
    }

    const report = {
      iterations: ITERATIONS,
      warmup: 1,
      transcriptItems: items.length,
      transcriptBytes: JSON.stringify(items).length,
      transcriptMessages: messageCount,
      transcriptConvertMs: roundMs(median(transcriptConverts)),
      transcriptMountMs: roundMs(median(transcriptMounts)),
      transcriptRemountMs: roundMs(median(transcriptTotals)),
      transcriptRemountMinMs: roundMs(Math.min(...transcriptTotals)),
      transcriptRemountMaxMs: roundMs(Math.max(...transcriptTotals)),
      sessionRows: COLD_LAUNCH_SESSION_ROWS,
      sessionRowsMounted: mountedRows,
      sessionRailNodes: railNodes,
      sessionsRailMs: roundMs(median(railTotals)),
      sessionsRailMinMs: roundMs(Math.min(...railTotals)),
      sessionsRailMaxMs: roundMs(Math.max(...railTotals)),
    }
    const line = `COLD_LAUNCH_COST ${JSON.stringify(report)}`
    process.stdout.write(`${line}\n`)
    writeFileSync('/tmp/rhizome-cold-launch-cost.json', `${JSON.stringify(report, null, 2)}\n`)
    expect(report.transcriptRemountMs).toBeGreaterThan(0)
    expect(report.sessionsRailMs).toBeGreaterThan(0)
  }, 300_000)
})
