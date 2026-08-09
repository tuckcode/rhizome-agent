export interface VaultOption {
  label: string
  path: string
  alias?: string
  shortLabel?: string | null
  color?: string | null
  icon?: string | null
  mounted?: boolean
  managedDefault?: boolean
  available?: boolean
}
