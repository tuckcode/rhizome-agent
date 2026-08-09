import type { VaultEntry } from '../../types'

export type ProjectBucketKind = 'unassigned' | 'archive' | 'inbox'

export interface ProjectTreeNode {
  project: string
  entries: VaultEntry[]
}

export interface ProjectTreeBucket {
  kind: ProjectBucketKind
  entries: VaultEntry[]
}

export interface ProjectTree {
  /** Single implicit "Active" wrapper for v1 — no project-hub-driven
   *  category grouping exists yet. See docs/plans project-tree scope note. */
  projects: ProjectTreeNode[]
  buckets: ProjectTreeBucket[]
}
