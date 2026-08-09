import { useMemo } from 'react'
import type { VaultEntry, SidebarSelection } from '../types'
import { buildProjectTree, entryProject } from './project-tree/projectTreeData'
import { ProjectTreeRow } from './project-tree/ProjectTreeRow'
import { ProjectBucketSection } from './project-tree/ProjectBucketSection'
import { useProjectTreeDisclosure } from './project-tree/useProjectTreeDisclosure'
import { SidebarGroupHeader } from './sidebar/SidebarGroupHeader'
import { SIDEBAR_SECTION_CONTENT_PADDING_BOTTOM } from './sidebar/sidebarStyles'
import { translate, type AppLocale } from '../lib/i18n'

interface SidebarProjectsNavigationProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  groupCollapsed?: boolean
  onToggleGroup?: () => void
  locale?: AppLocale
}

/** Wiki-vault sidebar nav (Alpha-2): a flat list of projects (single
 *  implicit "Active" wrapper for v1, no project-hub category concept yet)
 *  plus Unassigned/Archive/Inbox buckets that never nest under a project. */
export function SidebarProjectsNavigation({
  entries,
  selection,
  onSelect,
  groupCollapsed,
  onToggleGroup,
  locale = 'en',
}: SidebarProjectsNavigationProps) {
  const tree = useMemo(() => buildProjectTree(entries), [entries])

  const selectedGroupKey = useMemo(() => {
    if (selection.kind !== 'entity') return null
    return entryProject(selection.entry) ?? undefined
  }, [selection])

  const { expanded, toggleNode, sectionCollapsed, handleToggleSection } = useProjectTreeDisclosure(
    {
      collapsed: groupCollapsed,
      onToggle: onToggleGroup,
      selection,
      selectedGroupKey,
    }
  )

  if (tree.projects.length === 0 && tree.buckets.every((b) => b.entries.length === 0)) {
    return null
  }

  return (
    <div
      data-testid="sidebar-projects-navigation"
      style={{ paddingBottom: SIDEBAR_SECTION_CONTENT_PADDING_BOTTOM }}
    >
      <div style={{ paddingLeft: 12 }}>
        <SidebarGroupHeader
          label={translate(locale, 'sidebar.group.projects')}
          collapsed={sectionCollapsed}
          onToggle={handleToggleSection}
        />
      </div>
      {!sectionCollapsed && (
        <>
          {tree.projects.map((node) => (
            <ProjectTreeRow
              key={node.project}
              node={node}
              expanded={expanded[node.project] ?? false}
              onToggle={toggleNode}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
          {tree.buckets.map((bucket) => (
            <ProjectBucketSection
              key={bucket.kind}
              bucket={bucket}
              expanded={expanded[bucket.kind] ?? false}
              onToggle={toggleNode}
              selection={selection}
              onSelect={onSelect}
              locale={locale}
            />
          ))}
        </>
      )}
    </div>
  )
}
