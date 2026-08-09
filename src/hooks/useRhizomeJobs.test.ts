import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvokeFn = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

// Tracks registered listeners by event name so tests can fire them and can
// assert on registration order relative to invoke() — this is what exposes
// the bug_003/006 race (listener registration must complete before invoke).
let listenCalls: string[] = []
let listenHandlers = new Map<string, (event: { payload: unknown }) => void>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: (name: string, handler: (event: { payload: unknown }) => void) => {
    listenCalls.push(name)
    listenHandlers.set(name, handler)
    return Promise.resolve(() => { /* unlisten no-op */ })
  },
}))

import { useRhizomeJobs } from './useRhizomeJobs'

// useRhizomeJobs keeps its job list in module-level state, shared across
// every component that calls the hook (by design — see the hook's own
// doc comment). Tests share that same state, so every test must leave
// activeJobs empty when it's done, or later tests see leftover jobs.

describe('useRhizomeJobs', () => {
  beforeEach(() => {
    mockInvokeFn.mockReset()
    mockInvokeFn.mockResolvedValue(null)
    listenCalls = []
    listenHandlers = new Map()
  })

  it('uses a caller-supplied jobId instead of generating its own', async () => {
    const { result } = renderHook(() => useRhizomeJobs())

    await act(async () => {
      void result.current.startJob('rhizome_repo_research', {}, 'label', 'caller-supplied-id')
    })

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith(
        'start_rhizome_job',
        expect.objectContaining({ jobId: 'caller-supplied-id' }),
      )
    })
    expect(result.current.activeJobs.some(j => j.id === 'caller-supplied-id')).toBe(true)

    act(() => result.current.cancelJob('caller-supplied-id')) // cleanup
  })

  it('cancelJob actually resolves the completer for a caller-supplied jobId (bug_001 regression)', async () => {
    const { result } = renderHook(() => useRhizomeJobs())

    let outcome: unknown
    await act(async () => {
      result.current.startJob('rhizome_repo_research', {}, 'label', 'the-real-job-id').then((r) => {
        outcome = r
      })
    })

    await waitFor(() => expect(result.current.activeJobs.some(j => j.id === 'the-real-job-id')).toBe(true))

    act(() => {
      result.current.cancelJob('the-real-job-id')
    })

    await waitFor(() => expect(outcome).toEqual({ status: 'cancelled' }))
    expect(result.current.activeJobs.some(j => j.id === 'the-real-job-id')).toBe(false)
  })

  it('registers job-complete/error listeners before invoking start_rhizome_job (bug_003 race)', async () => {
    // Snapshot which listeners exist at the exact moment invoke fires. The
    // job promise itself never resolves in this test (nothing emits a
    // completion event), so the test must NOT await it.
    let listenersAtInvokeTime: string[] | null = null
    mockInvokeFn.mockImplementation((command: string) => {
      if (command === 'start_rhizome_job') {
        listenersAtInvokeTime = [...listenCalls]
      }
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useRhizomeJobs())

    act(() => {
      void result.current.startJob('rhizome_distill', {}, 'label', 'job-x')
    })

    await waitFor(() => expect(listenersAtInvokeTime).not.toBeNull())
    // Both listeners for job-x must be registered strictly before
    // start_rhizome_job is invoked.
    expect(listenersAtInvokeTime).toContain('rhizome-job-complete-job-x')
    expect(listenersAtInvokeTime).toContain('rhizome-job-error-job-x')

    act(() => result.current.cancelJob('job-x')) // cleanup shared job state
  })

  it('resolves complete with the real event payload output, not a hardcoded value (bug_006 regression)', async () => {
    const { result } = renderHook(() => useRhizomeJobs())

    let outcome: unknown
    await act(async () => {
      void result.current.startJob('rhizome_distill', {}, 'label', 'job-y').then((r) => {
        outcome = r
      })
    })

    await waitFor(() => expect(listenHandlers.has('rhizome-job-complete-job-y')).toBe(true))

    act(() => {
      listenHandlers.get('rhizome-job-complete-job-y')?.({
        payload: { output: '{"pages":["a.md","b.md"]}' },
      })
    })

    await waitFor(() =>
      expect(outcome).toEqual({ status: 'complete', output: '{"pages":["a.md","b.md"]}' }),
    )
  })
})
