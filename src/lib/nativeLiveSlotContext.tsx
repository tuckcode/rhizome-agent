import type { ReactNode } from 'react'
import { NativeLiveSlotContext } from './nativeLiveSlot'

/** The chat panel's live slot. The composer reads this when it is not given one. */
export function NativeLiveSlotProvider({
  slot,
  children,
}: {
  slot: string | null
  children: ReactNode
}) {
  return <NativeLiveSlotContext.Provider value={slot}>{children}</NativeLiveSlotContext.Provider>
}
