// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createOpenAICompatibleProvider } from '@/lib/providers/openaiCompatible.js'

function sseResponse(chunks) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function providerWith(fetchImpl) {
  return createOpenAICompatibleProvider({
    name: 'opencode',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    apiKey: 'test-key',
    extraHeaders: {
      'x-opencode-session': 'agent-workbench',
      'User-Agent': 'agent-workbench/0.1',
    },
    fetchImpl,
  })
}

describe('createOpenAICompatibleProvider', () => {
  it('posts a chat completion and normalizes the response', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'pong',
                reasoning_content: 'because',
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'calculator', arguments: '{"expression":"1+1"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        }),
        { status: 200 }
      )
    )
    const provider = providerWith(fetchImpl)

    const result = await provider.chat({
      model: 'deepseek-v4.1-flash',
      messages: [{ role: 'user', content: 'ping' }],
      tools: [
        { type: 'function', function: { name: 'calculator', parameters: {} } },
      ],
      sessionId: 'sess-1',
    })

    expect(result.content).toBe('pong')
    expect(result.reasoning).toBe('because')
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].function.name).toBe('calculator')
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions')
    expect(options.headers.Authorization).toBe('Bearer test-key')
    expect(options.headers['x-opencode-session']).toBe('sess-1')
    expect(options.headers['User-Agent']).toBe('agent-workbench/0.1')
    const body = JSON.parse(options.body)
    expect(body.tools).toHaveLength(1)
    expect(body.tool_choice).toBe('auto')
  })

  it('parses streamed content, reasoning and tool calls', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"think "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"calc","arguments":"{\\"a\\""}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":1}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":7,"total_tokens":12}}\n\n',
        'data: [DONE]\n\n',
      ])
    )
    const provider = providerWith(fetchImpl)
    const deltas = []

    const result = await provider.chatStream({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: (delta) => deltas.push(delta),
    })

    expect(result.content).toBe('Hello')
    expect(result.reasoning).toBe('think ')
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].function.name).toBe('calc')
    expect(result.toolCalls[0].function.arguments).toBe('{"a":1}')
    expect(result.usage.totalTokens).toBe(12)
    expect(result.finishReason).toBe('tool_calls')
    expect(deltas.some((delta) => delta.type === 'content')).toBe(true)
    expect(deltas.some((delta) => delta.type === 'reasoning')).toBe(true)
    expect(deltas.some((delta) => delta.type === 'tool_call')).toBe(true)

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body.stream).toBe(true)
    expect(body.stream_options).toEqual({ include_usage: true })
  })

  it('lists models', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }] }),
        { status: 200 }
      )
    )
    const provider = providerWith(fetchImpl)
    const models = await provider.listModels()
    expect(models).toEqual(['a-model', 'z-model'])
  })

  it('throws a descriptive error on a failed request', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }))
    const provider = providerWith(fetchImpl)
    await expect(
      provider.chat({ model: 'm', messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toThrow(/opencode 500/)
  })

  it('reports availability based on the key', () => {
    expect(providerWith(vi.fn()).isAvailable()).toBe(true)
    const noKey = createOpenAICompatibleProvider({
      name: 'x',
      baseUrl: 'https://x/v1',
      apiKey: null,
      fetchImpl: vi.fn(),
    })
    expect(noKey.isAvailable()).toBe(false)
  })
})
