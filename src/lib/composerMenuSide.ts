/** Preferred side for a composer-row menu that opens upward first. */
export type ComposerMenuSide = 'top' | 'bottom'

export const COMPOSER_MENU_COLLISION_PADDING_PX = 8
export const NATIVE_CHAT_MODEL_MENU_HEIGHT_PX = 384
export const NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS = 'max-w-[8.5rem]'

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
