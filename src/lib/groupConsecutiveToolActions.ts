import type { AiAction } from '../components/AiMessage'

/**
 * Collapse a run of the same tool name into one card with a count.
 *
 * Five `ipython` (or five `bash`) rows are the same fact repeated. The
 * Tool use header still carries the true call count.
 */
export function groupConsecutiveToolActions(actions: AiAction[]): AiAction[] {
  const grouped: Array<{ action: AiAction; count: number; sameLabel: boolean }> = []
  for (const action of actions) {
    const last = grouped[grouped.length - 1]
    if (!last || last.action.tool !== action.tool) {
      grouped.push({ action: { ...action }, count: 1, sameLabel: true })
      continue
    }
    last.count += 1
    last.sameLabel = last.sameLabel && last.action.label === action.label
    last.action = {
      ...last.action,
      status: combinedStatus(last.action.status, action.status),
      path: last.action.path === action.path ? last.action.path : undefined,
      input: joinDetail(last.action.input, action.input),
      output: joinDetail(last.action.output, action.output),
    }
  }
  return grouped.map(({ action, count, sameLabel }) => {
    if (count < 2) return action
    const base = sameLabel ? action.label : action.tool
    return { ...action, label: `${base} ×${count}` }
  })
}

function combinedStatus(
  left: AiAction['status'],
  right: AiAction['status'],
): AiAction['status'] {
  if (left === 'error' || right === 'error') return 'error'
  if (left === 'pending' || right === 'pending') return 'pending'
  return 'done'
}

function joinDetail(left?: string, right?: string): string | undefined {
  if (!left) return right
  if (!right || left === right) return left
  return `${left}\n---\n${right}`
}
