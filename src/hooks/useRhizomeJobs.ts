import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface RhizomeJob {
  id: string
  name: string
  startedAt: number
  /** Human-readable label, e.g. "Generate → architecture" */
  label: string
}

export type JobResult =
  | { status: 'complete'; output: string }
  | { status: 'error'; error: string }
  | { status: 'cancelled' }

interface UseRhizomeJobsReturn {
  /** Currently active (in-flight) jobs. */
  activeJobs: RhizomeJob[]
  /**
   * Start a cancellable job. Returns a promise that resolves when the job
   * finishes (complete, error, or cancelled). The Research panel can await
   * this just like the old blocking `invoke('call_rhizome_tool', ...)`.
   *
   * `jobId`, if supplied, is used as-is instead of generating a new one —
   * callers that need to reference the job before `startJob` resolves (e.g.
   * to wire up a Cancel button) must pass the same id they'll later hand to
   * `cancelJob`, or cancellation silently targets a job that was never
   * registered.
   */
  startJob: (
    name: string,
    args: Record<string, string>,
    label?: string,
    jobId?: string,
  ) => Promise<JobResult>
  /** Cancel a running job. */
  cancelJob: (jobId: string) => void
  /** Whether any job is currently running. */
  hasActiveJobs: boolean
}

// ── Module-level shared state ────────────────────────────────────────────────
// Both the Research panel and the status bar badge need to observe the same
// activeJobs set. Rather than threading a context through 1850-line App.tsx,
// we use a module-level subscriber pattern. Each `useRhizomeJobs()` call
// subscribes to the same singleton state.

type Subscriber = (jobs: RhizomeJob[]) => void

let sharedJobs: RhizomeJob[] = []
const subscribers = new Set<Subscriber>()

function notifySubscribers() {
  for (const sub of subscribers) {
    try { sub(sharedJobs) } catch { /* ignore */ }
  }
}

function addJob(job: RhizomeJob) {
  sharedJobs = [...sharedJobs, job]
  notifySubscribers()
}

function removeJob(jobId: string) {
  sharedJobs = sharedJobs.filter(j => j.id !== jobId)
  notifySubscribers()
}

/**
 * Hook for managing cancellable rhizome jobs.
 *
 * Shares state across callers (e.g. ResearchPanel + StatusBar) via a
 * module-level subscriber pattern — no context provider needed.
 */
export function useRhizomeJobs(): UseRhizomeJobsReturn {
  const [activeJobs, setActiveJobs] = useState<RhizomeJob[]>(sharedJobs)
  const listenersRef = useRef<Map<string, () => void>>(new Map())
  const completersRef = useRef<Map<string, (result: JobResult) => void>>(new Map())

  // Subscribe to shared state changes.
  useEffect(() => {
    const unsub = subscribe(setActiveJobs)
    return unsub
  }, [])

  // Cleanup all listeners on unmount.
  useEffect(() => {
    const listeners = listenersRef.current
    const completers = completersRef.current
    return () => {
      for (const unlisten of listeners.values()) {
        unlisten()
      }
      listeners.clear()
      completers.clear()
    }
  }, [])

  const removeJobAndCleanup = useCallback((jobId: string) => {
    removeJob(jobId)
    const unlisten = listenersRef.current.get(jobId)
    if (unlisten) {
      unlisten()
      listenersRef.current.delete(jobId)
    }
    completersRef.current.delete(jobId)
  }, [])

  const startJob = useCallback(
    (
      name: string,
      args: Record<string, string>,
      label?: string,
      callerJobId?: string,
    ): Promise<JobResult> => {
      const jobId = callerJobId ?? crypto.randomUUID()
      const job: RhizomeJob = {
        id: jobId,
        name,
        startedAt: Date.now(),
        label: label ?? name,
      }

      addJob(job)

      // Create a promise that resolves when the job completes.
      const promise = new Promise<JobResult>((resolve) => {
        completersRef.current.set(jobId, resolve)
      })

      // Listen for completion / error events.
      const completeEvent = `rhizome-job-complete-${jobId}`
      const errorEvent = `rhizome-job-error-${jobId}`

      const setupListeners = async () => {
        const unlistenComplete = await listen<{ output: string }>(completeEvent, (event) => {
          const resolve = completersRef.current.get(jobId)
          if (resolve) {
            resolve({ status: 'complete', output: event.payload.output })
          }
          removeJobAndCleanup(jobId)
        })
        const unlistenError = await listen<{ error: string }>(errorEvent, (event) => {
          const resolve = completersRef.current.get(jobId)
          if (resolve) {
            resolve({ status: 'error', error: event.payload.error })
          }
          removeJobAndCleanup(jobId)
        })
        listenersRef.current.set(jobId, () => {
          unlistenComplete()
          unlistenError()
        })
      }

      // Listeners must be registered before the job can possibly finish, or
      // a fast-failing backend job can emit its complete/error event before
      // anything is listening for it — the event is dropped and the
      // returned promise hangs forever. Await registration before invoking.
      void (async () => {
        try {
          await setupListeners()
        } catch {
          // Non-Tauri environment (test / browser dev) — clean up.
          const resolve = completersRef.current.get(jobId)
          if (resolve) {
            resolve({ status: 'error', error: 'Failed to set up job listeners' })
          }
          removeJobAndCleanup(jobId)
          return
        }

        invoke('start_rhizome_job', { jobId, name, args }).catch((err: unknown) => {
          const resolve = completersRef.current.get(jobId)
          if (resolve) {
            resolve({ status: 'error', error: String(err) })
          }
          removeJobAndCleanup(jobId)
        })
      })()

      return promise
    },
    [removeJobAndCleanup],
  )

  const cancelJob = useCallback(
    (jobId: string) => {
      invoke<boolean>('cancel_rhizome_job', { jobId }).catch(() => {
        // Best-effort
      })
      const resolve = completersRef.current.get(jobId)
      if (resolve) {
        resolve({ status: 'cancelled' })
      }
      removeJobAndCleanup(jobId)
    },
    [removeJobAndCleanup],
  )

  return {
    activeJobs,
    startJob,
    cancelJob,
    hasActiveJobs: activeJobs.length > 0,
  }
}

function subscribe(subscriber: Subscriber): () => void {
  subscribers.add(subscriber)
  subscriber(sharedJobs) // immediate sync
  return () => { subscribers.delete(subscriber) }
}