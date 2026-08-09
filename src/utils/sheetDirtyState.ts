export interface SheetWorkbookIdentity {
  generation: number
  path: string
}

interface SheetSerializeEligibility<T extends SheetWorkbookIdentity> {
  current: T | null
  dirtyGeneration: number | null
  expectedGeneration?: number
  latestContentPath: string
  pathsMatch: (left: string, right: string) => boolean
  workbookPath: string
}

export function markSheetWorkbookDirty(
  dirtyRef: { current: number | null },
  current: SheetWorkbookIdentity | null,
  shouldMark = true,
): void {
  if (shouldMark && current) dirtyRef.current = current.generation
}

export function clearSheetWorkbookDirty(dirtyRef: { current: number | null }): void {
  dirtyRef.current = null
}

export function canSerializeSheetWorkbook<T extends SheetWorkbookIdentity>({
  current,
  dirtyGeneration,
  expectedGeneration,
  latestContentPath,
  pathsMatch,
  workbookPath,
}: SheetSerializeEligibility<T>): boolean {
  return Boolean(
    current
    && (expectedGeneration === undefined || current.generation === expectedGeneration)
    && pathsMatch(workbookPath, current.path)
    && pathsMatch(latestContentPath, current.path)
    && dirtyGeneration === current.generation,
  )
}
