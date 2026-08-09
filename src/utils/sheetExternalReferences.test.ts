import { describe, expect, it } from 'vitest'
import {
  extractSheetExternalCellReferences,
  isExternalFormulaInput,
  shiftExternalFormulaReferences,
} from './sheetExternalReferences'

describe('sheetExternalReferences', () => {
  it('detects formula inputs with sheet wikilink cell references', () => {
    expect(isExternalFormulaInput('=[[revenue]].B2')).toBe(true)
    expect(isExternalFormulaInput(' [[revenue]].B2')).toBe(false)
    expect(isExternalFormulaInput('[[revenue]].B2')).toBe(false)
  })

  it('extracts canonical targets and A1 addresses', () => {
    expect(extractSheetExternalCellReferences('=[[folder/revenue|Revenue]].$B$12+[[costs]].C3')).toEqual([
      { address: 'B12', target: 'folder/revenue' },
      { address: 'C3', target: 'costs' },
    ])
  })

  it('shifts relative references while preserving absolute row and column markers', () => {
    expect(shiftExternalFormulaReferences('=[[revenue]].B2+[[revenue]].$C$3+[[revenue]].D$4+[[revenue]].$E5', 2, 1))
      .toBe('=[[revenue]].C4+[[revenue]].$C$3+[[revenue]].E$4+[[revenue]].$E7')
  })

  it('leaves references unchanged when a relative shift would leave the sheet bounds', () => {
    expect(shiftExternalFormulaReferences('=[[revenue]].A1', -1, 0)).toBe('=[[revenue]].A1')
  })
})
