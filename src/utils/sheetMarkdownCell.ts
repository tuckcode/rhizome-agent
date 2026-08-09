import type { SheetCellMetadata } from './sheetMetadata'

export interface ParsedSheetMarkdownCell {
  metadata: SheetCellMetadata
  value: string
}

function stripSymmetricMarkup(value: string, marker: string): string | null {
  if (!value.startsWith(marker) || !value.endsWith(marker)) return null
  const inner = value.slice(marker.length, -marker.length)
  const formulaCandidate = inner.replace(/^[*_~]+/, '').trimStart()
  if (formulaCandidate.startsWith('=')) return null
  return inner.length > 0 ? inner : null
}

export function parseSheetMarkdownCell(value: string): ParsedSheetMarkdownCell {
  if (value.startsWith('=')) return { value, metadata: {} }

  const boldItalic = stripSymmetricMarkup(value, '***')
  if (boldItalic !== null) {
    return {
      value: boldItalic,
      metadata: { bold: true, italic: true },
    }
  }

  const bold = stripSymmetricMarkup(value, '**')
  if (bold !== null) {
    return {
      value: bold,
      metadata: { bold: true },
    }
  }

  const boldUnderscore = stripSymmetricMarkup(value, '__')
  if (boldUnderscore !== null) {
    return {
      value: boldUnderscore,
      metadata: { bold: true },
    }
  }

  const italicUnderscore = stripSymmetricMarkup(value, '_')
  if (italicUnderscore !== null) {
    return {
      value: italicUnderscore,
      metadata: { italic: true },
    }
  }

  const italicStar = stripSymmetricMarkup(value, '*')
  if (italicStar !== null) {
    return {
      value: italicStar,
      metadata: { italic: true },
    }
  }

  const strike = stripSymmetricMarkup(value, '~~')
  if (strike !== null) {
    return {
      value: strike,
      metadata: { strike: true },
    }
  }

  return { value, metadata: {} }
}
