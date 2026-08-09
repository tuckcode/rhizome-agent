import { describe, expect, it } from 'vitest'
import { parseSheetMarkdownCell } from './sheetMarkdownCell'

describe('sheetMarkdownCell', () => {
  it('turns bold markdown cell wrappers into cell metadata', () => {
    expect(parseSheetMarkdownCell('**Subscriptions**')).toEqual({
      value: 'Subscriptions',
      metadata: { bold: true },
    })
    expect(parseSheetMarkdownCell('__Subscriptions__')).toEqual({
      value: 'Subscriptions',
      metadata: { bold: true },
    })
  })

  it('turns italic markdown cell wrappers into cell metadata', () => {
    expect(parseSheetMarkdownCell('_Growth_')).toEqual({
      value: 'Growth',
      metadata: { italic: true },
    })
  })

  it('turns bold italic wrappers into combined metadata', () => {
    expect(parseSheetMarkdownCell('***Net***')).toEqual({
      value: 'Net',
      metadata: { bold: true, italic: true },
    })
  })

  it('turns strikethrough wrappers into strike metadata', () => {
    expect(parseSheetMarkdownCell('~~Dropped~~')).toEqual({
      value: 'Dropped',
      metadata: { strike: true },
    })
  })

  it('leaves formulas untouched even when they contain markdown-like characters', () => {
    expect(parseSheetMarkdownCell('=CONCAT("**",A1)')).toEqual({
      value: '=CONCAT("**",A1)',
      metadata: {},
    })
  })

  it('does not import markdown wrappers around formulas as formatting', () => {
    expect(parseSheetMarkdownCell('**=SUM(A1:A2)**')).toEqual({
      value: '**=SUM(A1:A2)**',
      metadata: {},
    })
  })
})
