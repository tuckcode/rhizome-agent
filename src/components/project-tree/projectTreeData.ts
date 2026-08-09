/**
 * Pure functions for building the Alpha-2 project tree from vault entries.
 * Mirrors sidebarSections.ts's isMarkdown/isActive filtering conventions.
 */

import type { VaultEntry } from '../../types'
import type { ProjectTree, ProjectTreeBucket, ProjectTreeNode } from './projectTreeTypes'

const isMarkdown = (e: VaultEntry) => e.fileKind === 'markdown' || !e.fileKind
const isTypeDefinition = (e: VaultEntry) => e.isA === 'Type'

/** Canonical physical inbox drop-zone (roadmap Alpha-3: `<vault>/raw/inbox/`,
 *  processed out to `raw/processed/`). Matches `src-tauri/src/inbox_watcher.rs`. */
const INBOX_PATH_PREFIX = 'raw/inbox/'

/** Whether a note physically lives in the inbox drop-zone. Membership is by
 *  location, not the `_organized` flag — no writer sets that flag, so gating
 *  Inbox on `!organized` (as this did originally) dumped every note into
 *  Inbox regardless of project. `organized: true` stays an explicit escape
 *  hatch to pull a still-in-place note out of Inbox once it's been processed. */
const isInInbox = (e: VaultEntry) =>
  !e.organized && (e.path === 'raw/inbox' || e.path.startsWith(INBOX_PATH_PREFIX))

/** Normalize a note's `project:` frontmatter (scalar or array) to a single
 *  string, or null when absent/empty. Rhizome writers emit a single string
 *  today; array support is defensive, not a real current shape. */
export function entryProject(entry: VaultEntry): string | null {
  const raw = entry.properties?.project
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (first == null) return null
    const trimmed = String(first).trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

/** Group vault entries into the Alpha-2 project tree: a flat list of
 *  projects (each with its pages) plus three buckets that are never
 *  nested under a project. Routing order: archived → Archive; else an
 *  assigned `project:` → that project; else physically in `raw/inbox/`
 *  → Inbox; else → Unassigned. Archive always wins (an archived note is
 *  never mixed into Active lists), and an assigned project outranks inbox
 *  location. Inbox membership is by physical path, not the `_organized`
 *  flag — see `isInInbox`. */
export function buildProjectTree(entries: VaultEntry[]): ProjectTree {
  const candidates = entries.filter((e) => isMarkdown(e) && !isTypeDefinition(e))

  const projectGroups = new Map<string, VaultEntry[]>()
  const buckets: Record<'unassigned' | 'archive' | 'inbox', VaultEntry[]> = {
    unassigned: [],
    archive: [],
    inbox: [],
  }

  for (const entry of candidates) {
    if (entry.archived) {
      buckets.archive.push(entry)
      continue
    }
    // An assigned project wins over inbox location: once a note carries a
    // project it belongs to that project even if a copy still sits in raw/inbox.
    const project = entryProject(entry)
    if (project != null) {
      const group = projectGroups.get(project)
      if (group) {
        group.push(entry)
      } else {
        projectGroups.set(project, [entry])
      }
      continue
    }
    if (isInInbox(entry)) {
      buckets.inbox.push(entry)
      continue
    }
    buckets.unassigned.push(entry)
  }

  const byTitle = (a: VaultEntry, b: VaultEntry) => a.title.localeCompare(b.title)

  const projects: ProjectTreeNode[] = Array.from(projectGroups.entries())
    .map(([project, projectEntries]) => ({
      project,
      entries: [...projectEntries].sort(byTitle),
    }))
    .sort((a, b) => a.project.localeCompare(b.project))

  const bucketList: ProjectTreeBucket[] = (['unassigned', 'archive', 'inbox'] as const).map(
    (kind) => ({
      kind,
      entries: [...buckets[kind]].sort(byTitle),
    })
  )

  return { projects, buckets: bucketList }
}
