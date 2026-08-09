import { useEffect } from 'react'

/**
 * Registers mouse button 3/4 (back/forward) navigation.
 * The horizontal trackpad swipe path was removed because it was firing
 * unreliably in WKWebView and conflicted with the explicit keyboard path.
 */
export function useNavigationGestures({
  onGoBack,
  onGoForward,
}: {
  onGoBack: () => void
  onGoForward: () => void
}) {
  useEffect(() => {
    const handleMouseNavigation = (event: MouseEvent) => {
      if (event.button === 3) {
        event.preventDefault()
        onGoBack()
        return
      }

      if (event.button === 4) {
        event.preventDefault()
        onGoForward()
      }
    }
    window.addEventListener('mouseup', handleMouseNavigation)

    return () => {
      window.removeEventListener('mouseup', handleMouseNavigation)
    }
  }, [onGoBack, onGoForward])
}
