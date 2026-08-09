import { memo } from 'react'
import type { SidebarSelection } from '../../types'
import type { ProjectTreeNode } from './projectTreeTypes'
import { SidebarGroupHeader } from '../sidebar/SidebarGroupHeader'
import { ProjectEntryRow } from './ProjectEntryRow'

const PROJECT_DEPTH_INDENT = 24
const PAGE_DEPTH_INDENT = 36

interface ProjectTreeRowProps {
  node: ProjectTreeNode
  expanded: boolean
  onToggle: (key: string) => void
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
}

export const ProjectTreeRow = memo(function ProjectTreeRow({
  node,
  expanded,
  onToggle,
  selection,
  onSelect,
}: ProjectTreeRowProps) {
  return (
    <div data-testid={`project-node:${node.project}`}>
      <div style={{ paddingLeft: PROJECT_DEPTH_INDENT - 12 }}>
        <SidebarGroupHeader
          label={node.project}
          collapsed={!expanded}
          onToggle={() => onToggle(node.project)}
          count={node.entries.length}
        />
      </div>
      {expanded &&
        node.entries.map((entry) => (
          <ProjectEntryRow
            key={entry.path}
            entry={entry}
            selection={selection}
            onSelect={onSelect}
            depthIndent={PAGE_DEPTH_INDENT}
          />
        ))}
    </div>
  )
})
