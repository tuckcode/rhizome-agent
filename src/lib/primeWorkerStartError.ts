const WORKER_START_FAILURE_PREFIX = 'worker-failed: '

/**
 * Reason after `worker-failed: `, or null when this is not a worker-start failure.
 *
 * The host prefixes the raw send error. Chat then stores it as `Error: worker-failed: …`.
 * Both forms carry the same reason. The prefix is exact, including the space.
 */
function reasonAfterPrefix(body: string): string | null {
  if (!body.startsWith(WORKER_START_FAILURE_PREFIX)) return null
  const reason = body.slice(WORKER_START_FAILURE_PREFIX.length).trim()
  return reason.length > 0 ? reason : null
}

export function workerStartFailureReason(message: string): string | null {
  const trimmed = message.trim()
  const body = trimmed.startsWith('Error:')
    ? trimmed.replace(/^Error:\s*/u, '')
    : trimmed
  const direct = reasonAfterPrefix(body)
  if (direct) return direct
  // A few tokens can arrive before the host reports the dead worker.
  const embedded = trimmed.match(/\n\nError:\s*worker-failed: ([\s\S]+)$/u)
  const reason = embedded?.[1]?.trim()
  return reason ? reason : null
}

/**
 * Assistant text for a failed send.
 * A worker that failed to start shows its reason. Every other message stays as written.
 */
export function presentWorkerStartFailure(message: string): string | null {
  const reason = workerStartFailureReason(message)
  if (!reason) return null
  const embedded = message.match(/\n\nError:\s*worker-failed: [\s\S]*$/u)
  if (embedded?.index !== undefined) {
    return `${message.slice(0, embedded.index)}\n\nError: ${reason}`
  }
  return `Error: ${reason}`
}
