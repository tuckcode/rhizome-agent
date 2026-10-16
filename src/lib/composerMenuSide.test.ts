import { describe, expect, it } from 'vitest'
import {
  COMPOSER_CHIP_MENU_GAP_PX,
  COMPOSER_MENU_COLLISION_PADDING_PX,
  NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
  composerChipMenuSideOffset,
  resolveComposerMenuSide,
} from './composerMenuSide'

describe('resolveComposerMenuSide', () => {
  it('opens upward when the panel has room above the chip', () => {
    expect(
      resolveComposerMenuSide({
        spaceAbove: 400,
        spaceBelow: 80,
        menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
      }),
    ).toBe('top')
  })

  it('flips down when the chip sits near the top of a short panel', () => {
    expect(
      resolveComposerMenuSide({
        spaceAbove: 40,
        spaceBelow: 400,
        menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
        padding: COMPOSER_MENU_COLLISION_PADDING_PX,
      }),
    ).toBe('bottom')
  })

  it('picks the larger remaining side when neither side fits the menu', () => {
    expect(
      resolveComposerMenuSide({
        spaceAbove: 120,
        spaceBelow: 90,
        menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
      }),
    ).toBe('top')
    expect(
      resolveComposerMenuSide({
        spaceAbove: 90,
        spaceBelow: 120,
        menuHeight: NATIVE_CHAT_MODEL_MENU_HEIGHT_PX,
      }),
    ).toBe('bottom')
  })
})

describe('composerChipMenuSideOffset', () => {
  it('clears the composer box and leaves an 8px gap', () => {
    expect(
      composerChipMenuSideOffset({
        triggerTop: 420,
        composerBoxTop: 360,
        gap: COMPOSER_CHIP_MENU_GAP_PX,
      }),
    ).toBe(68)
  })

  it('falls back to 4 when there is no composer box', () => {
    expect(composerChipMenuSideOffset({ triggerTop: 420, composerBoxTop: null })).toBe(4)
  })
})
