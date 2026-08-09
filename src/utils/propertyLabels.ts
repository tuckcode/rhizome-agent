export function humanizePropertyKey(key: string): string {
  const normalized = key.replace(/^_+/, '')
  const spaced = normalized.replace(/[_-]/g, ' ')
  if (!spaced) return spaced
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
