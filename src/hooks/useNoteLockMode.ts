import { useCallback, useEffect, useState, type MutableRefObject } from 'react'
import { trackNoteLockToggled } from '../lib/productAnalytics'

/**
 * Per-note edit lock as ephemeral view state (C68).
 * Default is editable. Not vault `editor_mode` (that is raw vs BlockNote).
 */
export function useNoteLockMode(
  activeTabPath: string | null,
  toggleRef?: MutableRefObject<() => void>,
) {
  const [lockedByPath, setLockedByPath] = useState<Map<string, boolean>>(() => new Map())

  const noteLocked = activeTabPath ? lockedByPath.get(activeTabPath) === true : false

  const onToggleNoteLock = useCallback(() => {
    if (!activeTabPath) return
    const nextLocked = !noteLocked
    setLockedByPath((prev) => {
      const next = new Map(prev)
      if (nextLocked) next.set(activeTabPath, true)
      else next.delete(activeTabPath)
      return next
    })
    trackNoteLockToggled(nextLocked)
  }, [activeTabPath, noteLocked])

  useEffect(() => {
    if (toggleRef) toggleRef.current = onToggleNoteLock
  }, [toggleRef, onToggleNoteLock])

  return { noteLocked, onToggleNoteLock }
}
