import { useCallback, useEffect, useRef, useState } from 'react'

interface HistoryState {
  stack: string[]
  cursor: number
}

const EMPTY: HistoryState = { stack: [], cursor: -1 }
const MAX_HISTORY = 200
const BACKWARD = -1
const FORWARD = 1

interface HistoryTarget {
  cursor: number
  path: string
}

function currentPath({ stack, cursor }: HistoryState): string | undefined {
  return stack.at(cursor)
}

function appendHistoryPath(prev: HistoryState, path: string): HistoryState {
  const truncated = prev.stack.slice(0, prev.cursor + 1)
  const stack = truncated.length >= MAX_HISTORY
    ? [...truncated.slice(truncated.length - MAX_HISTORY + 1), path]
    : [...truncated, path]
  return { stack, cursor: stack.length - 1 }
}

function findHistoryTarget(
  { stack, cursor }: HistoryState,
  direction: typeof BACKWARD | typeof FORWARD,
  isValid?: (path: string) => boolean,
): HistoryTarget | null {
  const limit = direction === BACKWARD ? -1 : stack.length
  for (let i = cursor + direction; i !== limit; i += direction) {
    const path = stack.at(i)
    if (path === undefined) continue
    if (isValid && !isValid(path)) continue
    return { cursor: i, path }
  }
  return null
}

function cursorAfterRemoval(prev: HistoryState, removedIndex: number, nextStackLength: number): number {
  if (prev.cursor > removedIndex) return prev.cursor - 1
  if (prev.cursor === removedIndex) return Math.min(prev.cursor, nextStackLength - 1)
  return prev.cursor
}

/**
 * Manages a browser-style back/forward navigation stack of note paths.
 *
 * - `push(path)` adds a path, clearing any forward history.
 * - `goBack()` / `goForward()` return the target path (or null).
 * - Deleted/invalid paths are skipped transparently.
 */
export function useNavigationHistory() {
  const [state, setState] = useState<HistoryState>(EMPTY)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  const push = useCallback((path: string) => {
    setState((prev) => {
      if (prev.cursor >= 0 && currentPath(prev) === path) return prev
      return appendHistoryPath(prev, path)
    })
  }, [])

  const canGoBack = state.cursor > 0
  const canGoForward = state.cursor < state.stack.length - 1

  const goBack = useCallback((isValid?: (path: string) => boolean): string | null => {
    const target = findHistoryTarget(stateRef.current, BACKWARD, isValid)
    if (!target) return null
    setState({ stack: stateRef.current.stack, cursor: target.cursor })
    return target.path
  }, [])

  const goForward = useCallback((isValid?: (path: string) => boolean): string | null => {
    const target = findHistoryTarget(stateRef.current, FORWARD, isValid)
    if (!target) return null
    setState({ stack: stateRef.current.stack, cursor: target.cursor })
    return target.path
  }, [])

  /** Remove a path from history (e.g. when a tab is closed). */
  const removePath = useCallback((path: string) => {
    setState((prev) => {
      const idx = prev.stack.indexOf(path)
      if (idx === -1) return prev
      const stack = prev.stack.filter((p) => p !== path)
      const cursor = cursorAfterRemoval(prev, idx, stack.length)
      return { stack, cursor: Math.max(cursor, stack.length > 0 ? 0 : -1) }
    })
  }, [])

  return { canGoBack, canGoForward, push, goBack, goForward, removePath }
}
