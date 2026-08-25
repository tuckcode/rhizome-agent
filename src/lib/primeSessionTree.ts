/**
 * Fork/branch history of the *current* conversation — Prime `get_session_tree`.
 *
 * Distinct from the sessions drawer (between conversations) and from the RLM
 * family band (live subagents). This tree is parentId lineage inside one
 * session log. A linear conversation has no siblings, so the Chat band stays
 * quiet rather than listing every message as a "branch".
 */

export interface PrimeSessionTreeNode {
  id: string
  parentId?: string | null
  /** `user` | `assistant` | entry type for everything else. */
  kind: string
  title: string
  label?: string
}

export interface PrimeSessionTree {
  leafId?: string | null
  nodes: PrimeSessionTreeNode[]
}

export const EMPTY_PRIME_SESSION_TREE: PrimeSessionTree = { nodes: [] }

export interface SessionTreeBranchRow {
  id: string
  title: string
  current: boolean
  kind: string
}

function ancestryIds(nodes: readonly PrimeSessionTreeNode[], leafId: string | null | undefined): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ids = new Set<string>()
  let current = leafId?.trim() || undefined
  while (current && !ids.has(current)) {
    ids.add(current)
    current = byId.get(current)?.parentId ?? undefined
  }
  return ids
}

function rowTitle(node: PrimeSessionTreeNode): string {
  return (node.label ?? node.title).trim()
}

function isDisplayable(node: PrimeSessionTreeNode): boolean {
  if (node.kind === 'user' || node.kind === 'assistant') return true
  return Boolean(node.label?.trim())
}

/**
 * Sibling groups at actual forks — two or more children of the same parent.
 *
 * Linear history (every node has 0–1 child) yields nothing. That is the
 * silence rule #17 shares with the activity band: no branches, no chrome.
 */
export function sessionTreeBranchGroups(
  tree: PrimeSessionTree | null | undefined,
): SessionTreeBranchRow[][] {
  const nodes = tree?.nodes ?? []
  if (nodes.length === 0) return []

  const byParent = new Map<string, PrimeSessionTreeNode[]>()
  for (const node of nodes) {
    const key = node.parentId?.trim() || ''
    const siblings = byParent.get(key) ?? []
    siblings.push(node)
    byParent.set(key, siblings)
  }

  const onPath = ancestryIds(nodes, tree?.leafId)
  const groups: SessionTreeBranchRow[][] = []
  for (const siblings of byParent.values()) {
    if (siblings.length < 2) continue
    const rows = siblings.filter(isDisplayable).map((node) => ({
      id: node.id,
      title: rowTitle(node) || node.kind,
      current: onPath.has(node.id),
      kind: node.kind,
    }))
    if (rows.length >= 2) groups.push(rows)
  }
  return groups
}

export function sessionTreeBranchCount(tree: PrimeSessionTree | null | undefined): number {
  return sessionTreeBranchGroups(tree).reduce((sum, group) => sum + group.length, 0)
}
