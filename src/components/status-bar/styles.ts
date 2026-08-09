import type { CSSProperties } from 'react'

export const ICON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

export const DISABLED_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  opacity: 0.4,
  cursor: 'not-allowed',
}

export const SEP_STYLE: CSSProperties = {
  color: 'var(--border)',
}
