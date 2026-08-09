import { useEffect } from 'react'
import type { RefObject } from 'react'

export function useDismissibleLayer<T extends HTMLElement>(
  open: boolean,
  ref: RefObject<T | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onDismiss, ref])
}
