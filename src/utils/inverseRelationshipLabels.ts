import type { VaultEntry } from '../types'
import { humanizePropertyKey } from './propertyLabels'

const PREFERRED_INVERSE_RELATIONSHIP_LABELS = ['Children', 'Events', 'Referenced by'] as const

export function resolveInverseRelationshipLabel(
  key: string,
  entry: Pick<VaultEntry, 'isA'>,
): string {
  const normalizedKey = humanizePropertyKey(key).trim().toLowerCase()

  if (normalizedKey === 'belongs to') {
    return entry.isA === 'Event'
      ? 'Events'
      : 'Children'
  }

  if (normalizedKey === 'related to') {
    return entry.isA === 'Event'
      ? 'Events'
      : 'Referenced by'
  }

  return `← ${humanizePropertyKey(key)}`
}

export function orderInverseRelationshipLabels(labels: Iterable<string>): string[] {
  const presentLabels = [...labels]
  const preferredLabels = PREFERRED_INVERSE_RELATIONSHIP_LABELS.filter((label) => presentLabels.includes(label))
  const customLabels = presentLabels
    .filter((label) => !PREFERRED_INVERSE_RELATIONSHIP_LABELS.includes(label as typeof PREFERRED_INVERSE_RELATIONSHIP_LABELS[number]))
    .sort((left, right) => left.localeCompare(right))

  return [...preferredLabels, ...customLabels]
}
