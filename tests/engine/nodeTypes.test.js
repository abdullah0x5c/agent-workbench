// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getNodeDefinition } from '@/lib/engine/nodeTypes.js'

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
})

const ctx = { nodeId: 'n1', nodeLabel: 'Node', runId: 'r1' }

describe('input node', () => {
  const def = getNodeDefinition('input')

  it('prefers an explicit run input', async () => {
    const result = await def.run({ data: { example: '{"a":1}' }, ctx: { ...ctx, input: { b: 2 } } })
    expect(result.output).toEqual({ b: 2 })
  })

  it('parses the configured example', async () => {
    const result = await def.run({ data: { example: '{"a":1}' }, ctx })
    expect(result.output).toEqual({ a: 1 })
  })

  it('returns null without an example', async () => {
    const result = await def.run({ data: {}, ctx })
    expect(result.output).toBeNull()
  })
})

describe('code node', () => {
  const def = getNodeDefinition('code')

  it('transforms input', async () => {
    const result = await def.run({
      input: { value: 3 },
      data: { code: 'return { ...input, doubled: input.value * 2 }' },
      ctx,
    })
    expect(result.output).toEqual({ value: 3, doubled: 6 })
  })

  it('surfaces errors', async () => {
    const result = await def.run({ input: {}, data: { code: 'throw new Error("nope")' }, ctx })
    expect(result.error).toBe('nope')
  })
})

describe('router node', () => {
  const def = getNodeDefinition('router')

  it('routes true and false', async () => {
    const yes = await def.run({ input: { value: 50 }, data: { code: 'return input.value > 10' }, ctx })
    expect(yes.branch).toBe('true')
    const no = await def.run({ input: { value: 5 }, data: { code: 'return input.value > 10' }, ctx })
    expect(no.branch).toBe('false')
  })
})

describe('loop node', () => {
  const def = getNodeDefinition('loop')

  it('maps the step over the items', async () => {
    const result = await def.run({
      input: { items: [1, 2, 3] },
      data: { step: 'return input * 2', maxItems: 25 },
      ctx,
    })
    expect(result.output).toEqual({ items: [2, 4, 6], count: 3 })
  })

  it('honours maxItems', async () => {
    const result = await def.run({
      input: { items: [1, 2, 3, 4] },
      data: { step: 'return input', maxItems: 2 },
      ctx,
    })
    expect(result.output.count).toBe(2)
  })

  it('throws when a step fails', async () => {
    await expect(
      def.run({ input: { items: [1] }, data: { step: 'throw new Error("step broke")' }, ctx })
    ).rejects.toThrow(/step broke/)
  })
})

describe('httpRequest node', () => {
  const def = getNodeDefinition('httpRequest')

  it('normalizes the response', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const result = await def.run({
      data: { url: 'https://example.com', method: 'GET' },
      ctx,
    })
    expect(result.output.status).toBe(200)
    expect(result.output.data).toEqual({ ok: true })
  })

  it('requires a URL', async () => {
    await expect(def.run({ data: {}, ctx })).rejects.toThrow(/URL/)
  })
})

describe('output node', () => {
  it('passes the value through', async () => {
    const result = await getNodeDefinition('output').run({ input: { done: true }, ctx })
    expect(result.output).toEqual({ done: true })
  })
})
