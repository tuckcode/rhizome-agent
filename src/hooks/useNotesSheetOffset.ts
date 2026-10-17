import { useLayoutEffect } from 'react'
import { MACOS_TITLEBAR_HEIGHT } from '../components/MacOSTitlebar'
import { hasNativeMacosTrafficLights } from '../utils/trafficLights'

/** Sheet top inset. Not `--overlay-titlebar-height`, which title bands use as a min-height. */
export const NOTES_SHEET_OFFSET_VAR = '--notes-sheet-offset'

/** Marks the band the notes sheet must clear. `content` wins over `chrome`. */
export const SHEET_OFFSET_BAND_ATTR = 'data-sheet-offset-band'

function bandHeight(band: HTMLElement): number | null {
  const height = Math.ceil(band.getBoundingClientRect().height)
  return height > 0 ? height : null
}

/**
 * Height of the band actually on top of the chat column. A content band
 * (the session subhead) wins, because the sheet overlaps that row. With
 * no content band, the native macOS chrome band is measured. With neither,
 * native mac falls back to the 32px title bar.
 */
export function notesSheetOffsetPx(): number | null {
  const bands = [...document.querySelectorAll<HTMLElement>(`[${SHEET_OFFSET_BAND_ATTR}]`)]
  const content = bands.find((band) => band.getAttribute(SHEET_OFFSET_BAND_ATTR) === 'content')
  const chrome = bands.find((band) => band.getAttribute(SHEET_OFFSET_BAND_ATTR) === 'chrome')
  const measured = (content && bandHeight(content)) ?? (chrome && bandHeight(chrome))
  if (measured) return measured
  if (hasNativeMacosTrafficLights()) return MACOS_TITLEBAR_HEIGHT
  return null
}

function publishNotesSheetOffset(root: HTMLElement) {
  const offset = notesSheetOffsetPx()
  if (offset == null) {
    root.style.removeProperty(NOTES_SHEET_OFFSET_VAR)
    return
  }
  root.style.setProperty(NOTES_SHEET_OFFSET_VAR, `${offset}px`)
}

/** Publish the sheet offset and remove it when this owner unmounts. */
export function useNotesSheetOffset() {
  useLayoutEffect(() => {
    const root = document.documentElement
    let observer: ResizeObserver | null = null
    let observed: HTMLElement | null = null

    const sync = () => {
      publishNotesSheetOffset(root)
      const next = document.querySelector<HTMLElement>(`[${SHEET_OFFSET_BAND_ATTR}="content"]`)
        ?? document.querySelector<HTMLElement>(`[${SHEET_OFFSET_BAND_ATTR}="chrome"]`)
      if (next === observed) return
      observer?.disconnect()
      observed = next
      if (!next || typeof ResizeObserver === 'undefined') return
      observer = new ResizeObserver(() => publishNotesSheetOffset(root))
      observer.observe(next)
    }

    sync()
    const mutations = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(sync)
    mutations?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', SHEET_OFFSET_BAND_ATTR],
    })

    return () => {
      observer?.disconnect()
      mutations?.disconnect()
      root.style.removeProperty(NOTES_SHEET_OFFSET_VAR)
    }
  }, [])
}
