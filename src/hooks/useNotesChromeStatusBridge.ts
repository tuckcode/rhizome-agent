import { useEffect, useRef } from 'react'
import {
  NOTES_CHROME_EVENT,
  type NotesChromeDestination,
} from '../lib/notesChrome'

export function useNotesChromeStatusBridge({
  onOpenResearch,
  onClickGraph,
}: {
  onOpenResearch?: () => void
  onClickGraph?: () => void
}): void {
  const researchRef = useRef(onOpenResearch)
  const graphRef = useRef(onClickGraph)

  useEffect(() => {
    researchRef.current = onOpenResearch
    graphRef.current = onClickGraph
  }, [onClickGraph, onOpenResearch])

  useEffect(() => {
    const onChrome = (event: Event) => {
      const destination = (event as CustomEvent<NotesChromeDestination>).detail
      if (destination === 'research') researchRef.current?.()
      if (destination === 'graph') graphRef.current?.()
    }
    window.addEventListener(NOTES_CHROME_EVENT, onChrome)
    return () => window.removeEventListener(NOTES_CHROME_EVENT, onChrome)
  }, [])
}
