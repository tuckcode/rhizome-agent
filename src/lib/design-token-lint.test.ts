import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

describe('design token lint', () => {
  const eslint = new ESLint()
  const component = 'src/components/DesignTokenFixture.tsx'

  it.each([
    ['text-[13px]', '<div className="hover:text-[13px]/5" />'],
    ['fontSize', '<div style={{ fontSize: 13 }} />'],
    ['raw hex color', '<div className="bg-[#abc]" />'],
    ['raw RGB color', '<div style={{ background: "rgb(0 0 0)" }} />'],
    ['raw HSL color', '<div style={{ color: "hsl(10 20% 30%)" }} />'],
  ])('rejects %s in source', async (_, markup) => {
    const [result] = await eslint.lintText(`export const Fixture = () => ${markup}`, { filePath: component })
    expect(result.messages.map((message) => message.ruleId)).toContain('rhizome/design-tokens')
  })

  it('allows tokens and dynamic sizes', async () => {
    const [result] = await eslint.lintText(
      'export const Fixture = ({ size }: { size: number }) => <div className="text-control bg-primary" style={{ fontSize: size, color: "var(--foreground)" }} />',
      { filePath: component },
    )
    expect(result.messages).toEqual([])
  })

  it('allows literal classes in test fixtures', async () => {
    const [result] = await eslint.lintText('export const fixture = "text-[13px]"', { filePath: 'src/lib/DesignTokenFixture.test.ts' })
    expect(result.messages).toEqual([])
  })
})
