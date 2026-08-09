import { memo } from 'react'
import type { SidebarSelection } from '../../types'
import type { ProjectTreeBucket } from './projectTreeTypes'
import { SidebarGroupHeader } from '../sidebar/SidebarGroupHeader'
import { ProjectEntryRow } from './ProjectEntryRow'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'

const BUCKET_DEPTH_INDENT = 24

const BUCKET_LABEL_KEY: Record<ProjectTreeBucket['kind'], TranslationKey> = {
  unassigned: 'sidebar.projectTree.unassigned',
  archive: 'sidebar.projectTree.archive',
  inbox: 'sidebar.projectTree.inbox',
}

interface ProjectBucketSectionProps {
  bucket: ProjectTreeBucket
  expanded: boolean
  onToggle: (key: string) => void
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  locale?: AppLocale
}

export const ProjectBucketSection = memo(function ProjectBucketSection({
  bucket,
  expanded,
  onToggle,
  selection,
  onSelect,
  locale = 'en',
}: ProjectBucketSectionProps) {
  if (bucket.entries.length === 0) return null

  return (
    <div data-testid={`project-bucket:${bucket.kind}`}>
      <SidebarGroupHeader
        label={translate(locale, BUCKET_LABEL_KEY[bucket.kind])}
        collapsed={!expanded}
        onToggle={() => onToggle(bucket.kind)}
        count={bucket.entries.length}
      />
      {expanded &&
        bucket.entries.map((entry) => (
          <ProjectEntryRow
            key={entry.path}
            entry={entry}
            selection={selection}
            onSelect={onSelect}
            depthIndent={BUCKET_DEPTH_INDENT}
          />
        ))}
    </div>
  )
})
