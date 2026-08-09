import type { VaultEntry } from '../../types'

export function PinnedCard({ entry, renderItem }: {
  entry: VaultEntry
  renderItem: (entry: VaultEntry, options?: { forceSelected?: boolean }) => React.ReactNode
}) {
  return renderItem(entry, { forceSelected: true })
}
