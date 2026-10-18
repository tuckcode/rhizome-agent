/** Preferred side for a composer-row menu that opens upward first. */
export type ComposerMenuSide = 'top' | 'bottom'

export const COMPOSER_MENU_COLLISION_PADDING_PX = 8
export const COMPOSER_CHIP_MENU_GAP_PX = 8
export const NATIVE_CHAT_MODEL_MENU_HEIGHT_PX = 420
export const NATIVE_CHAT_MODEL_LIST_MAX_HEIGHT_CLASS = 'max-h-[min(60vh,420px)]'
export const NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS = 'max-w-[12rem]'

/**
 * Lift the chip menu above the whole composer box, not just the trigger,
 * and leave an 8px gap. No box (Settings row, isolated tests) stays at 4.
 */
export function composerChipMenuSideOffset({
  triggerTop,
  composerBoxTop,
  gap = COMPOSER_CHIP_MENU_GAP_PX,
}: {
  triggerTop: number
  composerBoxTop: number | null
  gap?: number
}): number {
  if (composerBoxTop == null) return 4
  return Math.max(gap, Math.round(triggerTop - composerBoxTop + gap))
}

/**
 * Open upward when the panel has room. Flip down when the chip sits
 * near the top of a short panel so the menu stays inside the window.
 */
export function resolveComposerMenuSide({
  spaceAbove,
  spaceBelow,
  menuHeight,
  padding = COMPOSER_MENU_COLLISION_PADDING_PX,
}: {
  spaceAbove: number
  spaceBelow: number
  menuHeight: number
  padding?: number
}): ComposerMenuSide {
  const need = menuHeight + padding
  if (spaceAbove >= need) return 'top'
  if (spaceBelow >= need) return 'bottom'
  return spaceAbove >= spaceBelow ? 'top' : 'bottom'
}
