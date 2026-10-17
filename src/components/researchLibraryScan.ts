export interface LibraryScanItem {
  id: string
  title: string
  description: string
  type: 'wiki' | 'source' | 'card'
  tag?: string
  date: string
  dateEpoch: number
  path: string
}

interface LibraryScanRow {
  id: string
  path: string
  title: string
  description: string
  type: string
  tag: string
  date: number
}

/**
 * Parse the JSON from `rhizome_scan_library`. Throws on malformed input so
 * the Research panel can report one scan error instead of rendering a
 * partial library.
 */
export function parseLibraryScan(raw: string): LibraryScanItem[] {
  const items = JSON.parse(raw) as LibraryScanRow[]
  return items.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description || '(no description)',
    type: item.type as 'wiki' | 'source' | 'card',
    tag: item.tag,
    date: item.date > 0 ? new Date(item.date * 1000).toLocaleDateString() : 'unknown',
    dateEpoch: item.date,
    path: item.path,
  }))
}
