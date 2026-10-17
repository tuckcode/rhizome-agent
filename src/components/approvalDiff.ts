export const APPROVAL_COLLAPSE_AFTER = 12
const COLLAPSED_PREFIX = 3
const COLLAPSED_ADDED = 8

export function compactDiffLines(diff: string): string[] {
  return diff
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('---') && !line.startsWith('+++'))
}

function isAddedLine(line: string): boolean {
  return (line.startsWith('+') && !line.startsWith('+++')) || line.includes('more added')
}

function isHunkLine(line: string): boolean {
  return line.startsWith('@@')
}

export function collapseApprovalLines(lines: string[]): string[] {
  if (lines.length <= APPROVAL_COLLAPSE_AFTER) return lines
  const start = lines.findIndex(isHunkLine)
  const body = start >= 0 ? lines.slice(start) : lines
  const out: string[] = []
  let prefix = 0
  let added = 0
  for (const line of body) {
    if (isHunkLine(line)) {
      out.push(line)
      continue
    }
    if (isAddedLine(line)) {
      if (added >= COLLAPSED_ADDED) continue
      out.push(line)
      added++
      continue
    }
    if (prefix >= COLLAPSED_PREFIX) continue
    out.push(line)
    prefix++
  }
  return out.length > 0 ? out : body.slice(0, APPROVAL_COLLAPSE_AFTER)
}
