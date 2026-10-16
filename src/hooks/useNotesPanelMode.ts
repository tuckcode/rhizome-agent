import { useCallback, useEffect, useState } from 'react'
import { trackNotesPanelModeChanged } from '../lib/productAnalytics'
import {
  type NotesPanelMode,
  cycleNotesPanelMode,
  isNotesPanelModeShortcut,
  readNotesPanelMode,
  resolveNotesPanelWindowId,
  writeNotesPanelMode,
} from '../lib/notesPanelMode'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useNotesPanelMode(windowId = resolveNotesPanelWindowId()) {
  const [mode, setModeState] = useState<NotesPanelMode>(() => readNotesPanelMode(windowId))

  const setMode = useCallback((next: NotesPanelMode) => {
    setModeState(next)
    writeNotesPanelMode(windowId, next)
    trackNotesPanelModeChanged(next)
  }, [windowId])

  const cycleMode = useCallback(() => {
    const next = cycleNotesPanelMode(mode)
    setMode(next)
  }, [mode, setMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isNotesPanelModeShortcut(event)) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      cycleMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cycleMode])

  return { mode, setMode, cycleMode, windowId }
}
