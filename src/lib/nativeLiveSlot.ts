import { createContext, useContext } from 'react'

export const NativeLiveSlotContext = createContext<string | null>(null)

export function useNativeLiveSlot(): string | null {
  return useContext(NativeLiveSlotContext)
}
