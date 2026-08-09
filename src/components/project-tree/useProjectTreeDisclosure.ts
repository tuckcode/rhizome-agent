import { useCallback, useMemo, useState } from 'react'
import type { SidebarSelection } from '../../types'

interface UseProjectTreeDisclosureInput {
  collapsed?: boolean
  onToggle?: () => void
  selection: SidebarSelection
  /** The project name (or bucket kind) that owns the currently selected
   *  entry, if any — auto-expands that node so the selection is visible. */
  selectedGroupKey?: string | null
}

/** Expand-state for the project tree: a flat `Record<groupKey, boolean>`
 *  (project name or bucket kind as the key), one level deep — no arbitrary
 *  nesting like `useFolderTreeDisclosure`, since the tree is exactly
 *  Project → pages. No create/rename affordances either; the project tree
 *  doesn't support inline project creation in v1. */
export function useProjectTreeDisclosure({
  collapsed: externalCollapsed,
  onToggle,
  selection,
  selectedGroupKey,
}: UseProjectTreeDisclosureInput) {
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({})
  const [internalCollapsed, setInternalCollapsed] = useState(false)

  const expanded = useMemo(() => {
    if (!selectedGroupKey) return manualExpanded
    if (manualExpanded[selectedGroupKey]) return manualExpanded
    return { ...manualExpanded, [selectedGroupKey]: true }
  }, [manualExpanded, selectedGroupKey])

  const toggleNode = useCallback((key: string) => {
    setManualExpanded((current) => ({ ...current, [key]: !(current[key] ?? false) }))
  }, [])

  const sectionCollapsed = externalCollapsed ?? internalCollapsed
  const handleToggleSection = useCallback(() => {
    if (onToggle) {
      onToggle()
      return
    }
    setInternalCollapsed((current) => !current)
  }, [onToggle])

  return { expanded, toggleNode, sectionCollapsed, handleToggleSection, selection }
}
