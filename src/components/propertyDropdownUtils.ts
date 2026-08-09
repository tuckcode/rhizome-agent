import { useEffect, type RefObject } from 'react'

export { getAnchoredDropdownLeft } from './anchoredDropdown'

export function getNextHighlightIndex(current: number, total: number) {
  if (total <= 0) return 0
  return current < total - 1 ? current + 1 : 0
}

export function getPreviousHighlightIndex(current: number, total: number) {
  if (total <= 0) return -1
  return current > 0 ? current - 1 : total - 1
}

export function isCreateOptionVisible(query: string, options: string[]) {
  const trimmed = query.trim()
  if (!trimmed) return false
  return !options.some((option) => option.toLowerCase() === trimmed.toLowerCase())
}

export function useAutoFocus<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
}
