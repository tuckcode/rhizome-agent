import { describe, expect, it } from 'vitest'
import {
  canSerializeSheetWorkbook,
  clearSheetWorkbookDirty,
  markSheetWorkbookDirty,
} from './sheetDirtyState'

const pathsMatch = (left: string, right: string) => left === right

describe('sheetDirtyState', () => {
  it('marks and clears the active workbook generation', () => {
    const dirtyRef = { current: null as number | null }

    markSheetWorkbookDirty(dirtyRef, { generation: 4, path: '/vault/sheet.md' })
    expect(dirtyRef.current).toBe(4)

    clearSheetWorkbookDirty(dirtyRef)
    expect(dirtyRef.current).toBeNull()
  })

  it('does not mark navigation or cleanup work as dirty when disabled', () => {
    const dirtyRef = { current: null as number | null }

    markSheetWorkbookDirty(dirtyRef, { generation: 4, path: '/vault/sheet.md' }, false)

    expect(dirtyRef.current).toBeNull()
  })

  it('allows serialization only for the dirty current generation and path', () => {
    const current = { generation: 4, path: '/vault/sheet.md' }
    const base = {
      current,
      dirtyGeneration: 4,
      latestContentPath: '/vault/sheet.md',
      pathsMatch,
      workbookPath: '/vault/sheet.md',
    }

    expect(canSerializeSheetWorkbook(base)).toBe(true)
    expect(canSerializeSheetWorkbook({ ...base, dirtyGeneration: null })).toBe(false)
    expect(canSerializeSheetWorkbook({ ...base, expectedGeneration: 3 })).toBe(false)
    expect(canSerializeSheetWorkbook({ ...base, latestContentPath: '/vault/other.md' })).toBe(false)
    expect(canSerializeSheetWorkbook({ ...base, workbookPath: '/vault/other.md' })).toBe(false)
    expect(canSerializeSheetWorkbook({ ...base, current: null })).toBe(false)
  })
})
