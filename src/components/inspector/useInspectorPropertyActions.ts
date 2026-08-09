import { useMemo } from 'react'
import type { VaultEntry } from '../../types'
import type { FrontmatterOpOptions } from '../../hooks/frontmatterOps'

type FrontmatterValue = string | number | boolean | string[] | null

interface InspectorPropertyActionsConfig {
  entry: VaultEntry | null
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue, options?: FrontmatterOpOptions) => Promise<void>
  onDeleteProperty?: (path: string, key: string, options?: FrontmatterOpOptions) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue, options?: FrontmatterOpOptions) => Promise<void>
  onCreateMissingType?: (path: string, missingType: string, nextTypeName: string) => Promise<boolean | void>
}

function activeEntryOptions(entry: VaultEntry): FrontmatterOpOptions {
  return { requireActivePath: entry.path }
}

function bindUpdateAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onUpdateFrontmatter'],
) {
  if (!entry || !action) return undefined
  return (key: string, value: FrontmatterValue) => action(entry.path, key, value, activeEntryOptions(entry))
}

function bindDeleteAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onDeleteProperty'],
) {
  if (!entry || !action) return undefined
  return (key: string) => action(entry.path, key, activeEntryOptions(entry))
}

function bindAddAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onAddProperty'],
) {
  if (!entry || !action) return undefined
  return (key: string, value: FrontmatterValue) => action(entry.path, key, value, activeEntryOptions(entry))
}

function bindMissingTypeAction(
  entry: VaultEntry | null,
  action: ((path: string, missingType: string, nextTypeName: string) => Promise<boolean | void>) | undefined,
) {
  const missingType = entry?.isA
  if (!entry || !missingType || !action) return undefined
  return (nextTypeName: string) => action(entry.path, missingType, nextTypeName)
}

export function useInspectorPropertyActions({
  entry,
  onUpdateFrontmatter,
  onDeleteProperty,
  onAddProperty,
  onCreateMissingType,
}: InspectorPropertyActionsConfig) {
  const handleUpdateProperty = useMemo(
    () => bindUpdateAction(entry, onUpdateFrontmatter),
    [entry, onUpdateFrontmatter],
  )
  const handleDeleteProperty = useMemo(
    () => bindDeleteAction(entry, onDeleteProperty),
    [entry, onDeleteProperty],
  )
  const handleAddProperty = useMemo(
    () => bindAddAction(entry, onAddProperty),
    [entry, onAddProperty],
  )
  const handleCreateMissingType = useMemo(
    () => bindMissingTypeAction(entry, onCreateMissingType),
    [entry, onCreateMissingType],
  )

  return {
    handleUpdateProperty,
    handleDeleteProperty,
    handleAddProperty,
    handleCreateMissingType,
  }
}
