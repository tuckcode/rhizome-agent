import { describe, expect, it } from 'vitest'
import {
  cellAddressToIndexes,
  columnIndexFromName,
  mergeSheetMetadata,
  parseSheetMetadata,
} from './sheetMetadata'

describe('sheetMetadata', () => {
  it('converts spreadsheet addresses to one-based indexes', () => {
    expect(columnIndexFromName('A')).toBe(1)
    expect(columnIndexFromName('AA')).toBe(27)
    expect(cellAddressToIndexes('B12')).toEqual({ row: 12, column: 2 })
    expect(cellAddressToIndexes('bad')).toBeNull()
  })

  it('merges plain-text sheet metadata into frontmatter before the closing delimiter', () => {
    const frontmatter = '---\ntype: Sheet\nworkspace: personal\n---\n'
    const merged = mergeSheetMetadata(frontmatter, {
      frozenColumns: 1,
      frozenRows: 2,
      showGridLines: false,
      columns: { B: { width: 180 } },
      rows: { '1': { height: 44 } },
      cells: {
        C2: {
          numFmt: '0.00%',
          bold: true,
          fontSize: 15,
          fillColor: '#ffeeaa',
          verticalAlign: 'top',
          borderTop: { color: '#ff0000', style: 'thin' },
          borderBottom: { style: 'double' },
        },
      },
    })

    expect(merged).toBe([
      '---',
      'type: Sheet',
      'workspace: personal',
      '_sheet:',
      '  show_grid_lines: false',
      '  frozen_rows: 2',
      '  frozen_columns: 1',
      '  columns:',
      '    B:',
      '      width: 180',
      '  rows:',
      '    "1":',
      '      height: 44',
      '  cells:',
      '    C2:',
      '      num_fmt: "0.00%"',
      '      bold: true',
      '      font_size: 15',
      '      fill_color: "#ffeeaa"',
      '      vertical_align: "top"',
      '      border_top: "thin #ff0000"',
      '      border_bottom: "double"',
      '---',
      '',
    ].join('\n'))
  })

  it('parses the metadata block back from frontmatter', () => {
    const frontmatter = [
      '---',
      'type: Sheet',
      '_sheet:',
      '  show_grid_lines: false',
      '  frozen_rows: 2',
      '  frozen_columns: 1',
      '  columns:',
      '    B:',
      '      width: 180',
      '  rows:',
      '    "1":',
      '      height: 44',
      '  cells:',
      '    C2:',
      '      num_fmt: "0.00%"',
      '      bold: true',
      '      font_size: 15',
      '      fill_color: "#ffeeaa"',
      '      vertical_align: "top"',
      '      border_top: "thin #ff0000"',
      '      border_bottom: "double"',
      '---',
      '',
    ].join('\n')

    expect(parseSheetMetadata(frontmatter)).toEqual({
      frozenColumns: 1,
      frozenRows: 2,
      showGridLines: false,
      columns: { B: { width: 180 } },
      rows: { '1': { height: 44 } },
      cells: {
        C2: {
          numFmt: '0.00%',
          bold: true,
          fontSize: 15,
          fillColor: '#ffeeaa',
          verticalAlign: 'top',
          borderTop: { color: '#ff0000', style: 'thin' },
          borderBottom: { style: 'double' },
        },
      },
    })
  })

  it('replaces an existing metadata block instead of duplicating it', () => {
    const frontmatter = [
      '---',
      'type: Sheet',
      '_sheet:',
      '  columns:',
      '    A:',
      '      width: 160',
      'workspace: personal',
      '---',
      '',
    ].join('\n')

    const merged = mergeSheetMetadata(frontmatter, {
      columns: { C: { width: 220 } },
      rows: {},
      cells: {},
    })

    expect(merged).toContain('workspace: personal')
    expect(merged).toContain('    C:')
    expect(merged).not.toContain('    A:')
  })
})
