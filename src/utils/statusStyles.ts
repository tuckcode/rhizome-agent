import { getAppStorageItem } from '../constants/appStorage'
import { ACCENT_COLORS } from './typeColors'
import { updateVaultConfigField } from './vaultConfigStore'

export interface StatusStyle {
  bg: string
  color: string
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  Active: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Done: { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)' },
  Paused: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Archived: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Dropped: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Open: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  Closed: { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  'Not started': { bg: 'var(--accent-blue-light)', color: 'var(--muted-foreground)' },
  Draft: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Mixed: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
  Published: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)' },
  'In progress': { bg: 'var(--accent-purple-light)', color: 'var(--accent-purple)' },
  Blocked: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Cancelled: { bg: 'var(--accent-red-light)', color: 'var(--accent-red)' },
  Pending: { bg: 'var(--accent-yellow-light)', color: 'var(--accent-yellow)' },
}

export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: 'var(--accent-blue-light)',
  color: 'var(--muted-foreground)',
}

/** Default suggested statuses shown in the dropdown */
export const SUGGESTED_STATUSES = [
  'Not started',
  'In progress',
  'Active',
  'Done',
  'Blocked',
  'Paused',
  'Draft',
  'Archived',
]

const COLOR_KEY_TO_STYLE: Record<string, StatusStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.css }]),
)
const COLOR_KEY_STYLE_LOOKUP = new Map(Object.entries(COLOR_KEY_TO_STYLE))
const STATUS_STYLE_LOOKUP = new Map(Object.entries(STATUS_STYLES))

let colorOverrides: Record<string, string> = loadColorOverrides()

/** Initialize status color overrides from vault config (replaces localStorage). */
export function initStatusColors(overrides: Record<string, string>): void {
  colorOverrides = { ...overrides }
}

function loadColorOverrides(): Record<string, string> {
  const raw = getAppStorageItem('statusColors')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export function getStatusColorOverrides(): Record<string, string> {
  return { ...colorOverrides }
}

export function setStatusColor(status: string, colorKey: string | null): void {
  if (colorKey === null) {
    Reflect.deleteProperty(colorOverrides, status)
  } else {
    Reflect.set(colorOverrides, status, colorKey)
  }
  const snapshot = { ...colorOverrides }
  updateVaultConfigField('status_colors', Object.keys(snapshot).length > 0 ? snapshot : null)
}

export function getStatusColorKey(status: string): string | null {
  return (Reflect.get(colorOverrides, status) as string | undefined) ?? null
}

export function getMappedStatusStyle(status: string): StatusStyle | null {
  const overrideKey = Reflect.get(colorOverrides, status) as string | undefined
  if (overrideKey) {
    const style = COLOR_KEY_STYLE_LOOKUP.get(overrideKey)
    if (style) return style
  }
  return STATUS_STYLE_LOOKUP.get(status) ?? null
}

export function getStatusStyle(status: string): StatusStyle {
  return getMappedStatusStyle(status) ?? DEFAULT_STATUS_STYLE
}
