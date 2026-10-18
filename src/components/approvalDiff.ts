export const APPROVAL_COLLAPSE_AFTER = 12

export type CompactDiffLine = {
  kind: 'hunk' | 'line' | 'note'
  text: string
}

function dropFileHeaders(lines: string[]): string[] {
  if (
    lines.length >= 2
    && lines[0].startsWith('---')
    && lines[1].startsWith('+++')
  ) {
    return lines.slice(2)
  }
  return lines
}

export function compactDiffLines(diff: string): string[] {
  return splitDiffLines(diff)
    .filter((line) => line.kind !== 'note')
    .map((line) => line.text)
}

export function splitDiffLines(diff: string): CompactDiffLine[] {
  const raw = diff.split('\n').filter((line) => line.length > 0)
  return dropFileHeaders(raw).map((text) => ({ kind: 'line', text }))
}

export function isFileHeaderPair(first: string, second: string): boolean {
  return first.startsWith('---') && second.startsWith('+++')
}
