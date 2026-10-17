export const APPROVAL_COLLAPSE_AFTER = 12

export function compactDiffLines(diff: string): string[] {
  return diff
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('---') && !line.startsWith('+++'))
}
