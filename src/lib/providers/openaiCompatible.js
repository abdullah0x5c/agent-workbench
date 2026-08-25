function normalizeUsage(usage) {
  if (!usage) return null
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens
  return { promptTokens, completionTokens, totalTokens }
}

function parseToolCalls(message) {
  return (message?.tool_calls || []).map((call) => ({
    id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`,
    type: 'function',
    function: {
      name: call.function?.name || '',
      arguments: call.function?.arguments || '{}',
    },
  }))
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      if (!data) continue
      try {
        onEvent(JSON.parse(data))
      } catch {
        /* ignore malformed keep-alive chunks */
      }
    }
  }
}

/**
 * OpenAI-compatible chat provider. `opencode-go` uses this same shape with a
 * different base URL and the x-opencode-session header.
 */
export function createOpenAICompatibleProvider({
  name,
  baseUrl,
  apiKey = null,
  extraHeaders = {},
  requireKey = true,
  fetchImpl = globalThis.fetch,
}) {
  async function request(path, body, { signal, sessionId } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'agent-workbench/0.1',
      ...extraHeaders,
    }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    if (sessionId) headers['x-opencode-session'] = sessionId

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`${name} ${response.status}: ${text.slice(0, 300)}`)
    }
    return response
  }

  function buildBody({ model, messages, tools, toolChoice, temperature, maxTokens }, streaming) {
    const body = { model, messages }
    if (tools?.length) {
      body.tools = tools
      body.tool_choice = toolChoice || 'auto'
    }
    if (temperature != null) body.temperature = temperature
    if (maxTokens) body.max_tokens = maxTokens
    if (streaming) {
      body.stream = true
      body.stream_options = { include_usage: true }
    }
    return body
  }

  return {
    name,
    requiresKey: requireKey,
    isAvailable: () => !requireKey || Boolean(apiKey),

    async listModels() {
      const headers = { 'User-Agent': 'agent-workbench/0.1', ...extraHeaders }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`
      const response = await fetchImpl(`${baseUrl}/models`, { headers })
      if (!response.ok) {
        throw new Error(`${name} ${response.status} listing models`)
      }
      const json = await response.json()
      return (json.data || [])
        .map((model) => model.id)
        .filter(Boolean)
        .sort()
    },

    async chat({ model, messages, tools, toolChoice, temperature, maxTokens, sessionId, signal }) {
      const response = await request(
        '/chat/completions',
        buildBody({ model, messages, tools, toolChoice, temperature, maxTokens }, false),
        { signal, sessionId }
      )
      const json = await response.json()
      const choice = json.choices?.[0]
      return {
        content: choice?.message?.content ?? '',
        reasoning:
          choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? null,
        toolCalls: parseToolCalls(choice?.message),
        finishReason: choice?.finish_reason ?? null,
        usage: normalizeUsage(json.usage),
      }
    },

    async chatStream({
      model,
      messages,
      tools,
      toolChoice,
      temperature,
      maxTokens,
      sessionId,
      signal,
      onDelta,
    }) {
      const response = await request(
        '/chat/completions',
        buildBody({ model, messages, tools, toolChoice, temperature, maxTokens }, true),
        { signal, sessionId }
      )

      let content = ''
      let reasoning = ''
      let usage = null
      let finishReason = null
      const toolMap = new Map()

      await readSse(response, (chunk) => {
        if (chunk.usage) usage = normalizeUsage(chunk.usage)
        const choice = chunk.choices?.[0]
        if (!choice) return
        const delta = choice.delta || {}
        if (delta.content) {
          content += delta.content
          onDelta?.({ type: 'content', text: delta.content })
        }
        const reasoningDelta = delta.reasoning_content ?? delta.reasoning
        if (reasoningDelta) {
          reasoning += reasoningDelta
          onDelta?.({ type: 'reasoning', text: reasoningDelta })
        }
        for (const call of delta.tool_calls || []) {
          const index = call.index ?? 0
          const entry = toolMap.get(index) || {
            id: null,
            type: 'function',
            function: { name: '', arguments: '' },
          }
          if (call.id) entry.id = call.id
          if (call.function?.name) entry.function.name += call.function.name
          if (call.function?.arguments) {
            entry.function.arguments += call.function.arguments
          }
          toolMap.set(index, entry)
          onDelta?.({
            type: 'tool_call',
            name: entry.function.name,
            argumentsDelta: call.function?.arguments || '',
          })
        }
        if (choice.finish_reason) finishReason = choice.finish_reason
      })

      const toolCalls = [...toolMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => ({
          id: value.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          type: 'function',
          function: {
            name: value.function.name,
            arguments: value.function.arguments || '{}',
          },
        }))

      return {
        content,
        reasoning: reasoning || null,
        toolCalls,
        finishReason,
        usage,
      }
    },
  }
}

export { normalizeUsage }
