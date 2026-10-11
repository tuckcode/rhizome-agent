import { useEffect, useRef } from 'react'
import {
  NOTES_CHROME_EVENT,
  type NotesChromeDestination,
} from '../lib/notesChrome'

export function useNotesChromeStatusBridge({
  onOpenResearch,
  onClickGraph,
  onClickMycelium,
}: {
  onOpenResearch?: () => void
  onClickGraph?: () => void
  onClickMycelium?: () => void
}): void {
  const researchRef = useRef(onOpenResearch)
  const graphRef = useRef(onClickGraph)
  const myceliumRef = useRef(onClickMycelium)

  useEffect(() => {
    researchRef.current = onOpenResearch
    graphRef.current = onClickGraph
    myceliumRef.current = onClickMycelium
  }, [onClickGraph, onClickMycelium, onOpenResearch])

  useEffect(() => {
    const onChrome = (event: Event) => {
      const destination = (event as CustomEvent<NotesChromeDestination>).detail
      if (destination === 'research') researchRef.current?.()
      if (destination === 'graph') graphRef.current?.()
      if (destination === 'mycelium') myceliumRef.current?.()
    }
    window.addEventListener(NOTES_CHROME_EVENT, onChrome)
    return () => window.removeEventListener(NOTES_CHROME_EVENT, onChrome)
  }, [])
}
