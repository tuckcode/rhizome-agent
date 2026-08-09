export type IdleHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> }

export function scheduleIdle(callback: () => void): IdleHandle {
  const requestIdle = typeof window !== 'undefined' ? window.requestIdleCallback?.bind(window) : undefined
  if (typeof requestIdle === 'function') return { kind: 'idle', id: requestIdle(callback) }
  return { kind: 'timeout', id: setTimeout(callback, 0) }
}

export function cancelIdle(handle: IdleHandle): void {
  if (handle.kind === 'idle') {
    const cancelIdleFn = typeof window !== 'undefined' ? window.cancelIdleCallback?.bind(window) : undefined
    if (typeof cancelIdleFn === 'function') cancelIdleFn(handle.id)
    return
  }

  clearTimeout(handle.id)
}

export function requestFrame(callback: () => void): number {
  return typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(callback, 0)
}

export function cancelFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id)
    return
  }

  window.clearTimeout(id)
}
