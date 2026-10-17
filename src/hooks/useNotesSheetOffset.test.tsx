import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MACOS_TITLEBAR_HEIGHT } from '../components/MacOSTitlebar'
import { hasNativeMacosTrafficLights } from '../utils/trafficLights'
import {
  NOTES_SHEET_OFFSET_VAR,
  SHEET_OFFSET_BAND_ATTR,
  useNotesSheetOffset,
} from './useNotesSheetOffset'

vi.mock('../utils/trafficLights', () => ({
  hasNativeMacosTrafficLights: vi.fn(() => false),
}))

function OffsetOwner() {
  useNotesSheetOffset()
  return null
}

function stubHeight(node: HTMLElement, height: number) {
  node.getBoundingClientRect = () => ({
    height,
    width: 100,
    top: 0,
    left: 0,
    bottom: height,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

afterEach(() => {
  document.documentElement.style.removeProperty(NOTES_SHEET_OFFSET_VAR)
  document.documentElement.style.removeProperty('--overlay-titlebar-height')
  vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(false)
})

describe('useNotesSheetOffset', () => {
  it('shrinks the sheet offset when the content band shrinks', async () => {
    const band = document.createElement('div')
    band.setAttribute(SHEET_OFFSET_BAND_ATTR, 'content')
    stubHeight(band, 72)
    document.body.appendChild(band)

    render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('72px')
    expect(document.documentElement.style.getPropertyValue('--overlay-titlebar-height')).toBe('')

    stubHeight(band, 30)
    band.style.height = '30px'

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('30px')
    })
    band.remove()
  })

  it('clears the sheet offset when the owner unmounts', () => {
    const band = document.createElement('div')
    band.setAttribute(SHEET_OFFSET_BAND_ATTR, 'content')
    stubHeight(band, 40)
    document.body.appendChild(band)

    const view = render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('40px')

    view.unmount()
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('')
    band.remove()
  })

  it('uses the native macOS title bar height when no band is on top', () => {
    vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(true)
    render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe(
      `${MACOS_TITLEBAR_HEIGHT}px`,
    )
    expect(MACOS_TITLEBAR_HEIGHT).toBe(32)
  })
})
