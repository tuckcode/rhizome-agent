import { useEffect } from 'react'

const BACK_BUTTON = 3
const FORWARD_BUTTON = 4

function historyDirection(event: MouseEvent): 'back' | 'forward' | null {
  if (event.button === BACK_BUTTON) return 'back'
  if (event.button === FORWARD_BUTTON) return 'forward'
  return null
}

/**
 * Mouse back/forward buttons walk the note trail: note → wikilink → note.
 * Capture-phase so a focused editor cannot swallow the click. Down and up
 * are both consumed once so WKWebView cannot also treat them as browser history.
 */
export function useNavigationGestures({
  onGoBack,
  onGoForward,
}: {
  onGoBack: () => void
  onGoForward: () => void
}) {
  useEffect(() => {
    let consumedButton: number | null = null

    const navigate = (event: MouseEvent) => {
      const direction = historyDirection(event)
      if (!direction) return false
      event.preventDefault()
      event.stopPropagation()
      if (consumedButton === event.button) return true
      consumedButton = event.button
      if (direction === 'back') onGoBack()
      else onGoForward()
      return true
    }

    const handleDown = (event: MouseEvent) => {
      navigate(event)
    }
    const handleUp = (event: MouseEvent) => {
      navigate(event)
      if (event.button === BACK_BUTTON || event.button === FORWARD_BUTTON) {
        consumedButton = null
      }
    }

    window.addEventListener('mousedown', handleDown, true)
    window.addEventListener('mouseup', handleUp, true)
    window.addEventListener('auxclick', handleUp, true)

    return () => {
      window.removeEventListener('mousedown', handleDown, true)
      window.removeEventListener('mouseup', handleUp, true)
      window.removeEventListener('auxclick', handleUp, true)
    }
  }, [onGoBack, onGoForward])
}
