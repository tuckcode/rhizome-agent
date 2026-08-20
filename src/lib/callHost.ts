import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

/**
 * The one seam between React and the Rust host.
 *
 * Before this existed the same four lines —
 *
 * ```ts
 * const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
 *   isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
 * ```
 *
 * — were written out 41 times across 32 files, six of them inside separate
 * `useCallback` bodies in `AiPanel.tsx` alone. Redrawing a seam at every call
 * site means it can be drawn *differently* at some of them, and it was: several
 * modules reached for `invoke` directly and returned early when not in Tauri,
 * so those surfaces were unreachable in mock and browser runs rather than
 * merely unfunctional.
 *
 * Everything that decides *how* to reach the host belongs in here — the
 * adapter choice, and what a caller sees when the command does not exist.
 * Callers should import `callHost` and never `invoke`.
 */
export async function callHost<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Argument-less commands are forwarded with one argument, not two. Passing
  // an explicit `undefined` changes the call shape the adapter sees — enough
  // to break assertions written against `invoke(cmd)` and, more importantly,
  // enough to differ from what every hand-written copy of this seam did.
  if (isTauri()) return args === undefined ? invoke<T>(command) : invoke<T>(command, args)
  return args === undefined ? mockInvoke<T>(command) : mockInvoke<T>(command, args)
}

/**
 * `callHost` for a command whose failure is not worth interrupting anyone over.
 *
 * Returns `fallback` instead of throwing. Use it for ambient reads — status
 * polls, background rosters — where the host simply not being up yet is the
 * ordinary case and an error banner would be noise.
 *
 * Deliberately separate rather than an option on `callHost`: swallowing an
 * error should be a visible decision at the call site, not a flag someone
 * copies without noticing. A mutation must never use this.
 */
export async function callHostOr<T>(
  command: string,
  fallback: T,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await callHost<T>(command, args)
  } catch {
    return fallback
  }
}
