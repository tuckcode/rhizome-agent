/**
 * Maps note types to their accent color CSS variables.
 * Single source of truth for type→color mapping used across Sidebar, NoteList, and Inspector.
 */

import type { VaultEntry } from '../types'
import { isValidCssColor } from './colorUtils'

/** Builds a map from type name → Type document entry (for custom color/icon lookup).
 *  Stores both original title and lowercase version so lookups work regardless
 *  of whether instances use `isA: Config` or `isA: config`. */
export function buildTypeEntryMap(entries: VaultEntry[]): Record<string, VaultEntry> {
  const map: Record<string, VaultEntry> = {}
  for (const e of entries) {
    if (e.isA === 'Type') {
      Reflect.set(map, e.title, e)
      const lower = e.title.toLowerCase()
      if (lower !== e.title) Reflect.set(map, lower, e)
    }
  }
  return map
}

const TYPE_COLOR_MAP: Record<string, string> = {
  Project: 'var(--accent-red)',
  Experiment: 'var(--accent-red)',
  Responsibility: 'var(--accent-purple)',
  Procedure: 'var(--accent-purple)',
  Person: 'var(--accent-yellow)',
  Event: 'var(--accent-yellow)',
  Topic: 'var(--accent-green)',
  Type: 'var(--accent-blue)',
}

const TYPE_LIGHT_COLOR_MAP: Record<string, string> = {
  Project: 'var(--accent-red-light)',
  Experiment: 'var(--accent-red-light)',
  Responsibility: 'var(--accent-purple-light)',
  Procedure: 'var(--accent-purple-light)',
  Person: 'var(--accent-yellow-light)',
  Event: 'var(--accent-yellow-light)',
  Topic: 'var(--accent-green-light)',
  Type: 'var(--accent-blue-light)',
}

const DEFAULT_COLOR = 'var(--muted-foreground)'
const DEFAULT_LIGHT_COLOR = 'var(--muted)'

/** Color key → CSS variable mapping for the design system accent palette */
export const ACCENT_COLORS: { key: string; label: string; css: string; cssLight: string }[] = [
  { key: 'red', label: 'Red', css: 'var(--accent-red)', cssLight: 'var(--accent-red-light)' },
  { key: 'orange', label: 'Orange', css: 'var(--accent-orange)', cssLight: 'var(--accent-orange-light)' },
  { key: 'yellow', label: 'Yellow', css: 'var(--accent-yellow)', cssLight: 'var(--accent-yellow-light)' },
  { key: 'green', label: 'Green', css: 'var(--accent-green)', cssLight: 'var(--accent-green-light)' },
  { key: 'blue', label: 'Blue', css: 'var(--accent-blue)', cssLight: 'var(--accent-blue-light)' },
  { key: 'purple', label: 'Purple', css: 'var(--accent-purple)', cssLight: 'var(--accent-purple-light)' },
  { key: 'teal', label: 'Teal', css: 'var(--accent-teal)', cssLight: 'var(--accent-teal-light)' },
  { key: 'pink', label: 'Pink', css: 'var(--accent-pink)', cssLight: 'var(--accent-pink-light)' },
  { key: 'gray', label: 'Gray', css: 'var(--accent-gray)', cssLight: 'var(--accent-gray-light)' },
]

export const ACCENT_COLOR_PICKER_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'] as const
export const ACCENT_COLOR_PICKER_COLORS = ACCENT_COLOR_PICKER_KEYS
  .map((key) => ACCENT_COLORS.find((color) => color.key === key) ?? null)
  .filter((color): color is typeof ACCENT_COLORS[number] => color !== null)

const COLOR_KEY_TO_CSS: Record<string, string> = Object.fromEntries(
  ACCENT_COLORS.map((c) => [c.key, c.css]),
)
const COLOR_KEY_TO_CSS_LIGHT: Record<string, string> = Object.fromEntries(
  ACCENT_COLORS.map((c) => [c.key, c.cssLight]),
)
const COLOR_KEY_TO_CSS_LOOKUP = new Map(Object.entries(COLOR_KEY_TO_CSS))
const COLOR_KEY_TO_CSS_LIGHT_LOOKUP = new Map(Object.entries(COLOR_KEY_TO_CSS_LIGHT))
const TYPE_COLOR_LOOKUP = new Map(Object.entries(TYPE_COLOR_MAP))
const TYPE_LIGHT_COLOR_LOOKUP = new Map(Object.entries(TYPE_LIGHT_COLOR_MAP))

const CSS_COLOR_LIGHT_MIX = 14

/** Deterministically maps an unmapped `isA` string to one of the accent palette
 *  colors, so real vault types (Note, Essay, etc.) still get a distinct color
 *  in the graph instead of collapsing to the gray default. */
function hashTypeToAccentColor(isA: string): typeof ACCENT_COLORS[number] {
  let sum = 0
  for (let i = 0; i < isA.length; i++) sum += isA.charCodeAt(i)
  return ACCENT_COLORS[sum % ACCENT_COLORS.length]
}

function resolveCustomColor(customColorKey?: string | null): string | null {
  const color = customColorKey?.trim()
  if (!color) return null

  const paletteKey = color.toLowerCase()
  return COLOR_KEY_TO_CSS_LOOKUP.get(paletteKey) ?? (isValidCssColor(color) ? color : null)
}

function resolveCustomLightColor(customColorKey?: string | null): string | null {
  const color = customColorKey?.trim()
  if (!color) return null

  const paletteKey = color.toLowerCase()
  return COLOR_KEY_TO_CSS_LIGHT_LOOKUP.get(paletteKey)
    ?? (isValidCssColor(color) ? `color-mix(in srgb, ${color} ${CSS_COLOR_LIGHT_MIX}%, transparent)` : null)
}

/** Returns the CSS variable for the accent color of a given note type, with optional custom override */
export function getTypeColor(isA: string | null, customColorKey?: string | null): string {
  const customColor = resolveCustomColor(customColorKey)
  if (customColor) return customColor
  if (!isA) return DEFAULT_COLOR
  return TYPE_COLOR_LOOKUP.get(isA) ?? hashTypeToAccentColor(isA).css
}

/** Returns the CSS variable for the light/background variant of a given note type's color */
export function getTypeLightColor(isA: string | null, customColorKey?: string | null): string {
  const customLightColor = resolveCustomLightColor(customColorKey)
  if (customLightColor) return customLightColor
  if (!isA) return DEFAULT_LIGHT_COLOR
  return TYPE_LIGHT_COLOR_LOOKUP.get(isA) ?? hashTypeToAccentColor(isA).cssLight
}
