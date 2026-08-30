// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { runUserCode } from '@/lib/engine/sandbox.js'

describe('runUserCode', () => {
  it('returns the value the snippet returns', async () => {
    const result = await runUserCode('return 1 + 2')
    expect(result.ok).toBe(true)
    expect(result.output).toBe(3)
  })

  it('exposes input and ctx', async () => {
    const result = await runUserCode('return { value: input.value * 2, node: ctx.nodeId }', {
      input: { value: 5 },
      ctx: { nodeId: 'n1' },
    })
    expect(result.output).toEqual({ value: 10, node: 'n1' })
  })

  it('supports async/await', async () => {
    const result = await runUserCode('await new Promise((r) => setTimeout(r, 10))\nreturn "done"')
    expect(result.output).toBe('done')
  })

  it('captures console output', async () => {
    const result = await runUserCode('console.log("hi", 7)\nreturn true')
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].level).toBe('log')
    expect(result.logs[0].message).toEqual(['hi', 7])
  })

  it('reports syntax errors', async () => {
    const result = await runUserCode('return (')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/SyntaxError/)
  })

  it('reports runtime errors', async () => {
    const result = await runUserCode('throw new Error("boom")')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('aborts synchronous infinite loops', async () => {
    const result = await runUserCode('while (true) {}', { timeoutMs: 200 })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/timed out/i)
  })

  it('aborts async code that never resolves', async () => {
    const result = await runUserCode('await new Promise(() => {})', { timeoutMs: 150 })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/timed out/i)
  })

  it('does not expose process or require', async () => {
    const result = await runUserCode(
      'return { p: typeof process, r: typeof require }'
    )
    expect(result.output).toEqual({ p: 'undefined', r: 'undefined' })
  })

  it('treats empty code as a no-op', async () => {
    const result = await runUserCode('  ')
    expect(result.ok).toBe(true)
    expect(result.output).toBeNull()
  })
})
