import type { VaultEntry, VaultPropertyValue } from '../types'
import { parseFrontmatter } from '../utils/frontmatter'
import { frontmatterToEntryPatch, type PropertiesPatch } from './frontmatterOps'

function createRawEditorEntryState(): Partial<VaultEntry> {
  return {
    aliases: [],
    archived: false,
    belongsTo: [],
    color: null,
    favorite: false,
    favoriteIndex: null,
    icon: null,
    isA: null,
    listPropertiesDisplay: [],
    order: null,
    organized: false,
    properties: {},
    relatedTo: [],
    relationships: {},
    sidebarLabel: null,
    sort: null,
    status: null,
    template: null,
    view: null,
    visible: null,
  }
}

function mergeRelationships(target: Record<string, string[]>, source: Record<string, string[] | null> | null): void {
  if (!source) return
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && value.length > 0) Reflect.set(target, key, value)
  }
}

function mergeProperties(
  target: Record<string, VaultPropertyValue>,
  source: PropertiesPatch | null,
): void {
  if (!source) return
  for (const [key, value] of Object.entries(source)) {
    if (value !== null) Reflect.set(target, key, value)
  }
}

export function deriveRawEditorEntryState(content: string): Partial<VaultEntry> {
  const derived = createRawEditorEntryState()
  const properties: Record<string, VaultPropertyValue> = {}
  const relationships: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(parseFrontmatter(content))) {
    const { patch, relationshipPatch, propertiesPatch } = frontmatterToEntryPatch('update', key, value)
    Object.assign(derived, patch)
    mergeRelationships(relationships, relationshipPatch)
    mergeProperties(properties, propertiesPatch)
  }

  derived.properties = properties
  derived.relationships = relationships
  return derived
}
