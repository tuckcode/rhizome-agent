import { expandShortHex, toHexColor } from './colorUtils'

const HEX3_RE = /^#[0-9a-f]{3}$/i
const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX8_RE = /^#[0-9a-f]{8}$/i
const CSS_VARIABLE_RE = /^var\(\s*(--[\w-]+)\s*\)$/i
const RGB_COLOR_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i

const SHEET_COLOR_ALIASES = new Map<string, string>([
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['red', '#e53e3e'],
  ['orange', '#d9730d'],
  ['yellow', '#d69e2e'],
  ['green', '#38a169'],
  ['blue', '#155dff'],
  ['purple', '#805ad5'],
  ['teal', '#319795'],
  ['pink', '#d53f8c'],
  ['gray', '#718096'],
  ['grey', '#718096'],
  ['violet', '#ee82ee'],
  ['--accent-red', '#e53e3e'],
  ['--accent-red-light', '#e53e3e'],
  ['--accent-orange', '#d9730d'],
  ['--accent-orange-light', '#d9730d'],
  ['--accent-yellow', '#d69e2e'],
  ['--accent-yellow-light', '#d69e2e'],
  ['--accent-green', '#38a169'],
  ['--accent-green-light', '#38a169'],
  ['--accent-blue', '#155dff'],
  ['--accent-blue-bg', '#155dff'],
  ['--accent-blue-hover', '#0d4ad6'],
  ['--accent-blue-light', '#155dff'],
  ['--accent-purple', '#805ad5'],
  ['--accent-purple-light', '#805ad5'],
  ['--accent-teal', '#319795'],
  ['--accent-teal-light', '#319795'],
  ['--accent-pink', '#d53f8c'],
  ['--accent-pink-light', '#d53f8c'],
  ['--accent-gray', '#718096'],
  ['--accent-gray-light', '#718096'],
])

function colorAlias(value: string): string {
  const match = CSS_VARIABLE_RE.exec(value)
  return (match?.[1] ?? value).toLowerCase()
}

function rgbComponentToHex(componentText: string): string | null {
  const component = Number(componentText)
  if (!Number.isInteger(component) || component < 0 || component > 255) return null
  return component.toString(16).padStart(2, '0')
}

function rgbColorToHex(value: string): string | null {
  const match = RGB_COLOR_RE.exec(value)
  if (!match) return null

  const red = match[1] ? rgbComponentToHex(match[1]) : null
  const green = match[2] ? rgbComponentToHex(match[2]) : null
  const blue = match[3] ? rgbComponentToHex(match[3]) : null
  if (!red || !green || !blue) return null

  return `#${red}${green}${blue}`
}

export function normalizeSheetColorForIronCalc(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (HEX6_RE.test(trimmed)) return trimmed.toLowerCase()
  if (HEX3_RE.test(trimmed)) return expandShortHex(trimmed).toLowerCase()
  if (HEX8_RE.test(trimmed)) return trimmed.slice(0, 7).toLowerCase()

  const mapped = SHEET_COLOR_ALIASES.get(colorAlias(trimmed))
  if (mapped) return mapped

  return rgbColorToHex(trimmed) ?? toHexColor(trimmed)
}
