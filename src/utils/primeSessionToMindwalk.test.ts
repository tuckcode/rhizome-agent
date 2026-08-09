import { describe, expect, it } from 'vitest'
import { bridgePrimeSessionJsonl, rewritePrimeSessionValue } from './primeSessionToMindwalk'

describe('bridgePrimeSessionJsonl', () => {
  it('rewrites ipython %%bash toolCall to bash', () => {
    const line = JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'ipython',
            arguments: { code: '%%bash\nrg -n promote src\n' },
          },
        ],
      },
    })
    const { bridged, rewrittenTools } = bridgePrimeSessionJsonl(line)
    expect(rewrittenTools).toBe(1)
    const parsed = JSON.parse(bridged)
    const call = parsed.message.content[0]
    expect(call.name).toBe('bash')
    expect(call.arguments.command).toContain('rg -n promote')
  })

  it('leaves plain user lines alone', () => {
    const line = JSON.stringify({ type: 'message', message: { role: 'user', content: 'hi' } })
    const { bridged, rewrittenTools } = bridgePrimeSessionJsonl(`${line}\n`)
    expect(rewrittenTools).toBe(0)
    expect(bridged).toContain('hi')
  })
})

describe('rewritePrimeSessionValue', () => {
  it('is a no-op for non-tool trees', () => {
    const { value, rewritten } = rewritePrimeSessionValue({ a: 1 })
    expect(rewritten).toBe(0)
    expect(value).toEqual({ a: 1 })
  })
})
