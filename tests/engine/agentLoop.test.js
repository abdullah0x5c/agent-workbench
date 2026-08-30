// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { runAgent } from '@/lib/engine/agentLoop.js'
import { createMockProvider } from '@/lib/providers/mock.js'
import { buildToolRegistry } from '@/lib/engine/tools/registry.js'

function collector() {
  const events = []
  return { events, emit: (event, payload) => events.push({ event, payload }) }
}

const baseCtx = { nodeId: 'agent-1', nodeLabel: 'Agent', runId: 'run-1' }

describe('runAgent', () => {
  it('calls a tool then produces a final answer', async () => {
    const provider = createMockProvider()
    const registry = await buildToolRegistry(['calculator'])
    const { events, emit } = collector()

    const result = await runAgent({
      node: { data: { systemPrompt: 'be helpful', tools: ['calculator'] } },
      input: { question: 'What is 6 * 7?' },
      ctx: baseCtx,
      provider,
      model: 'mock-1',
      registry,
      emit,
    })

    expect(result.output).toMatch(/tool result/i)
    expect(result.toolCallCount).toBe(1)
    expect(result.iterations).toBe(2)

    const finished = events.filter((entry) => entry.event === 'span:finished')
    const llm = finished.filter((entry) => entry.payload.type === 'llm')
    const tool = finished.filter((entry) => entry.payload.type === 'tool')
    expect(llm).toHaveLength(2)
    expect(tool).toHaveLength(1)
    expect(tool[0].payload.toolName).toBe('calculator')
    expect(tool[0].payload.toolResult.result).toBe(42)
  })

  it('records token usage on llm spans', async () => {
    const provider = createMockProvider()
    const { events, emit } = collector()
    await runAgent({
      node: { data: { systemPrompt: 'x', tools: [] } },
      input: 'hello',
      ctx: baseCtx,
      provider,
      model: 'mock-1',
      registry: null,
      emit,
    })
    const llm = events.find(
      (entry) => entry.event === 'span:finished' && entry.payload.type === 'llm'
    )
    expect(llm.payload.usage.totalTokens).toBeGreaterThan(0)
  })

  it('emits deltas while streaming', async () => {
    const provider = createMockProvider()
    const { events, emit } = collector()
    await runAgent({
      node: { data: { systemPrompt: 'x', tools: [] } },
      input: 'stream please',
      ctx: baseCtx,
      provider,
      model: 'mock-1',
      registry: null,
      emit,
    })
    expect(events.some((entry) => entry.event === 'span:delta')).toBe(true)
  })

  it('enforces the max iterations cap', async () => {
    const provider = createMockProvider()
    const registry = await buildToolRegistry(['calculator'])
    await expect(
      runAgent({
        node: { data: { systemPrompt: 'x', tools: ['calculator'], maxIterations: 1 } },
        input: { question: 'What is 6 * 7?' },
        ctx: baseCtx,
        provider,
        model: 'mock-1',
        registry,
        emit: () => {},
      })
    ).rejects.toThrow(/exceeded 1 iterations/i)
  })

  it('marks a failed tool call but still finishes', async () => {
    const provider = createMockProvider()
    const registry = new Map([
      [
        'boom',
        {
          name: 'boom',
          description: 'always fails',
          parameters: { type: 'object', properties: {} },
          execute: async () => {
            throw new Error('tool blew up')
          },
        },
      ],
    ])
    const { events, emit } = collector()

    const result = await runAgent({
      node: { data: { systemPrompt: 'x', tools: ['boom'] } },
      input: 'do it',
      ctx: baseCtx,
      provider,
      model: 'mock-1',
      registry,
      emit,
    })

    expect(result.output).toBeTruthy()
    const failed = events.find(
      (entry) => entry.event === 'span:failed' && entry.payload.type === 'tool'
    )
    expect(failed.payload.error).toBe('tool blew up')
  })

  it('includes retrieved memory as a system message', async () => {
    const provider = createMockProvider()
    const { events, emit } = collector()
    await runAgent({
      node: { data: { systemPrompt: 'x', tools: [] } },
      input: 'hello',
      ctx: baseCtx,
      provider,
      model: 'mock-1',
      registry: null,
      emit,
      memoryContext: '- the user prefers concise answers',
    })
    const llm = events.find(
      (entry) => entry.event === 'span:finished' && entry.payload.type === 'llm'
    )
    const messages = llm.payload.messages
    expect(messages.some((message) => /prefers concise/.test(message.content))).toBe(true)
  })
})
