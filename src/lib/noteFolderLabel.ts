/**
 * Last folder segment of a note path, for breadcrumbs.
 * `/vault/wiki/pattern.md` + `pattern.md` → `wiki`.
 */
export function noteFolderLabel(path: string, filename: string): string | null {
  const normalized = path.replace(/\\/g, '/')
  const file = filename.replace(/\\/g, '/')
  if (!normalized.includes('/') || normalized === file) return null
  const withoutFile = normalized.endsWith(`/${file}`)
    ? normalized.slice(0, -(file.length + 1))
    : normalized.replace(/\/[^/]+$/, '')
  const segments = withoutFile.split('/').filter(Boolean)
  return segments.at(-1) ?? null
}
