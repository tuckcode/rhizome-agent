import { useEffect, useEffectEvent } from 'react'
import { handleAppKeyboardEvent } from './appKeyboardShortcuts'
import type { KeyboardActions } from './appKeyboardShortcuts'

export type { KeyboardActions } from './appKeyboardShortcuts'

export function useAppKeyboard(actions: KeyboardActions) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    handleAppKeyboardEvent(actions, event)
  })

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      onKeyDown(event)
    }

    window.addEventListener('keydown', handleWindowKeyDown, true)
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true)
  }, [])
}
