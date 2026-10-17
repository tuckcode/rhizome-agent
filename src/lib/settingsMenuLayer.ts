/**
 * Overlay menus that must sit above Settings (`z-[1300]`) and the composer.
 * Nested selects inside those menus use the nested layer.
 */
export const SETTINGS_MENU_Z_INDEX = 12000
export const SETTINGS_MENU_Z_CLASS = 'z-[12000]' as const
export const SETTINGS_NESTED_MENU_Z_INDEX = 13000
export const SETTINGS_NESTED_MENU_Z_CLASS = 'z-[13000]' as const
