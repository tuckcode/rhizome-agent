import type { VaultEntry } from '../types'
import { isLegacyJournalingType } from './legacyTypes'

const DEFAULT_TYPES = ['Event', 'Person', 'Project', 'Note']
const DEFAULT_TYPE_CANONICAL_CASE = new Map(
  DEFAULT_TYPES.map((type) => [type.toLowerCase(), type] as const),
)

export function canonicalizeTypeName(type: string): string | null {
  const trimmedType = type.trim()
  if (!trimmedType) return null
  return DEFAULT_TYPE_CANONICAL_CASE.get(trimmedType.toLowerCase()) ?? trimmedType
}

function resolveEntryType(entry: VaultEntry): string | null {
  if (entry.isA === 'Type') return entry.title
  if (entry.isA && entry.isA !== 'Type') return entry.isA
  return null
}

function addCanonicalType(typeMap: Map<string, string>, rawType: string | null): void {
  if (!rawType) return

  const canonicalType = canonicalizeTypeName(rawType)
  if (!canonicalType) return

  const typeKey = canonicalType.toLowerCase()
  if (!typeMap.has(typeKey)) {
    typeMap.set(typeKey, canonicalType)
  }
}

function collectHiddenTypeKeys(entries: VaultEntry[]): Set<string> {
  const hiddenTypeKeys = new Set<string>()

  for (const entry of entries) {
    if (entry.isA !== 'Type' || entry.visible !== false) continue

    const canonicalType = canonicalizeTypeName(entry.title)
    if (!canonicalType) continue

    hiddenTypeKeys.add(canonicalType.toLowerCase())
  }

  return hiddenTypeKeys
}

function hasExplicitTypeDefinition(entries: VaultEntry[], type: string): boolean {
  const typeKey = type.trim().toLowerCase()
  return entries.some((entry) => entry.isA === 'Type' && !entry.archived && entry.title.trim().toLowerCase() === typeKey)
}

function shouldIncludeCommandPaletteType(type: string, hiddenTypeKeys: Set<string>, entries: VaultEntry[]): boolean {
  const typeKey = type.toLowerCase()
  if (hiddenTypeKeys.has(typeKey)) return false
  if (!isLegacyJournalingType(type)) return true
  return hasExplicitTypeDefinition(entries, type)
}

export function extractVaultTypes(entries: VaultEntry[]): string[] {
  const typeMap = new Map<string, string>()

  for (const entry of entries) {
    addCanonicalType(typeMap, resolveEntryType(entry))
  }

  const hiddenTypeKeys = collectHiddenTypeKeys(entries)
  const sourceTypes = typeMap.size === 0 ? DEFAULT_TYPES : Array.from(typeMap.values()).sort()

  return sourceTypes.filter((type) => shouldIncludeCommandPaletteType(type, hiddenTypeKeys, entries))
}
