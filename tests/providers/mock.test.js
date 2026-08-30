// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createMockProvider, judgeScore, parseJudge } from '@/lib/providers/mock.js'

describe('mock provider', () => {
  it('returns a tool call on the first turn when tools exist', async () => {
    const provider = createMockProvider()
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'What is 6 * 7?' }],
      tools: [
        {
          type: 'function',
          function: { name: 'calculator', description: '', parameters: {} },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].function.name).toBe('calculator')
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({
      expression: '6 * 7',
    })
    expect(result.finishReason).toBe('tool_calls')
  })

  it('answers after a tool result is present', async () => {
    const provider = createMockProvider()
    const result = await provider.chat({
      messages: [
        { role: 'user', content: 'What is 6 * 7?' },
        { role: 'assistant', content: null, tool_calls: [] },
        { role: 'tool', tool_call_id: 'call_1', content: '{"result":42}' },
      ],
      tools: [{ type: 'function', function: { name: 'calculator' } }],
    })
    expect(result.toolCalls).toHaveLength(0)
    expect(result.content).toMatch(/tool result/i)
    expect(result.content).toContain('42')
  })

  it('answers directly when no tools are available', async () => {
    const provider = createMockProvider()
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'hello there' }],
      tools: [],
    })
    expect(result.content).toMatch(/Mock answer/)
    expect(result.toolCalls).toHaveLength(0)
  })

  it('streams reasoning and content deltas', async () => {
    const provider = createMockProvider()
    const deltas = []
    await provider.chatStream({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
      onDelta: (delta) => deltas.push(delta),
    })
    expect(deltas.some((delta) => delta.type === 'content')).toBe(true)
    expect(deltas.some((delta) => delta.type === 'reasoning')).toBe(true)
  })

  it('acts as a deterministic judge', async () => {
    const provider = createMockProvider()
    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'You are an evaluation judge.\nEXPECTED: 42\nRUBRIC: n/a\nINPUT: q\nACTUAL: the answer is 42',
        },
        { role: 'user', content: 'score' },
      ],
    })
    const parsed = JSON.parse(result.content)
    expect(parsed.score).toBe(1)
    expect(parsed.rationale).toMatch(/contains/)
  })

  it('lists mock models', async () => {
    const provider = createMockProvider()
    expect(await provider.listModels()).toEqual(['mock-1', 'mock-fast'])
  })
})

describe('judge scoring helpers', () => {
  it('scores a substring match as 1', () => {
    expect(judgeScore({ expected: '42', actual: 'the answer is 42' }).score).toBe(1)
  })

  it('scores partial word overlap as 0.5', () => {
    expect(
      judgeScore({ expected: 'capital of france is paris', actual: 'capital france paris' })
        .score
    ).toBe(0.5)
  })

  it('scores no overlap as 0', () => {
    expect(judgeScore({ expected: 'paris', actual: 'london' }).score).toBe(0)
  })

  it('handles a missing expected value', () => {
    expect(judgeScore({ expected: '', actual: 'x' }).score).toBe(0.5)
  })

  it('extracts expected and actual from a judge prompt', () => {
    const parsed = parseJudge('EXPECTED: 42\nRUBRIC: none\nINPUT: q\nACTUAL: forty two')
    expect(parsed).toEqual({ expected: '42', actual: 'forty two' })
  })
})
