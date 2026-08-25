const MODEL_IDS = ['mock-1', 'mock-fast']

const ARITHMETIC = /(-?\d+(?:\.\d+)?(?:\s*[-+*/]\s*-?\d+(?:\.\d+)?)+)/

function fakeUsage(messages, content) {
  const promptTokens = (messages || []).reduce(
    (total, message) => total + Math.ceil(String(message.content || '').length / 4),
    0
  )
  const completionTokens = Math.ceil(String(content || '').length / 4) + 3
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

function lastUserContent(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return String(messages[i].content || '')
  }
  return ''
}

function systemContent(messages = []) {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content || ''))
    .join('\n')
}

function toolNames(tools = []) {
  return tools.map((tool) => tool.function?.name).filter(Boolean)
}

function parseJudge(text) {
  const expected = (text.match(/EXPECTED:\s*([\s\S]*?)(?:\n[A-Z ]+:|$)/) || [])[1]
  const actual = (text.match(/ACTUAL:\s*([\s\S]*?)(?:\n[A-Z ]+:|$)/) || [])[1]
  return {
    expected: (expected || '').trim().toLowerCase(),
    actual: (actual || '').trim().toLowerCase(),
  }
}

function judgeScore({ expected, actual }) {
  if (!expected) return { score: 0.5, rationale: 'No expected output provided.' }
  if (actual.includes(expected)) {
    return { score: 1, rationale: 'Actual output contains the expected output.' }
  }
  const expectedWords = new Set(expected.split(/\s+/).filter(Boolean))
  const actualWords = new Set(actual.split(/\s+/).filter(Boolean))
  let overlap = 0
  for (const word of expectedWords) if (actualWords.has(word)) overlap += 1
  const ratio = expectedWords.size ? overlap / expectedWords.size : 0
  const score = ratio >= 0.5 ? 0.5 : 0
  return {
    score,
    rationale: `Token overlap ${Math.round(ratio * 100)}% with expected output.`,
  }
}

function chooseTool(names, userContent) {
  const arithmetic = userContent.match(ARITHMETIC)
  if (names.includes('calculator') && arithmetic) {
    return { name: 'calculator', args: { expression: arithmetic[1].trim() } }
  }
  if (names.includes('current_time')) {
    return { name: 'current_time', args: { timezone: 'UTC' } }
  }
  if (names.includes('calculator')) {
    return { name: 'calculator', args: { expression: '2 + 2' } }
  }
  return { name: names[0], args: {} }
}

export function createMockProvider(fetchImpl = globalThis.fetch) {
  async function respond({ messages, tools }) {
    const system = systemContent(messages)
    const user = lastUserContent(messages)
    const previousTools = (messages || []).filter((message) => message.role === 'tool')

    if (/evaluation judge/i.test(system)) {
      const judged = judgeScore(parseJudge(system))
      const content = JSON.stringify(judged)
      return {
        content,
        reasoning: 'Scoring the actual output against the expected output.',
        toolCalls: [],
        finishReason: 'stop',
        usage: fakeUsage(messages, content),
      }
    }

    const names = toolNames(tools)
    if (names.length > 0 && previousTools.length === 0) {
      const chosen = chooseTool(names, user)
      const content = ''
      return {
        content,
        reasoning: `The request needs outside help, so I will call the ${chosen.name} tool.`,
        toolCalls: [
          {
            id: 'call_mock_1',
            type: 'function',
            function: {
              name: chosen.name,
              arguments: JSON.stringify(chosen.args),
            },
          },
        ],
        finishReason: 'tool_calls',
        usage: fakeUsage(messages, content),
      }
    }

    const lastTool = previousTools[previousTools.length - 1]
    const toolSummary = lastTool ? String(lastTool.content).slice(0, 160) : ''
    const content = toolSummary
      ? `Mock answer using the tool result: ${toolSummary}`
      : `Mock answer: ${user.slice(0, 200) || 'no input provided'}`

    return {
      content,
      reasoning: lastTool
        ? 'The tool returned a result, so I can now answer the user.'
        : 'This is a deterministic mock response used offline.',
      toolCalls: [],
      finishReason: 'stop',
      usage: fakeUsage(messages, content),
    }
  }

  return {
    name: 'mock',
    requiresKey: false,
    isAvailable: () => true,

    async listModels() {
      return [...MODEL_IDS]
    },

    async chat({ messages, tools }) {
      return respond({ messages, tools })
    },

    async chatStream({ messages, tools, onDelta }) {
      const result = await respond({ messages, tools })
      if (result.reasoning) {
        for (const chunk of result.reasoning.match(/.{1,24}/g) || []) {
          onDelta?.({ type: 'reasoning', text: chunk })
        }
      }
      if (result.content) {
        for (const chunk of result.content.match(/.{1,16}/g) || []) {
          onDelta?.({ type: 'content', text: chunk })
        }
      }
      for (const call of result.toolCalls) {
        onDelta?.({
          type: 'tool_call',
          name: call.function.name,
          argumentsDelta: call.function.arguments,
        })
      }
      return result
    },

    _fetch: fetchImpl,
  }
}

export { MODEL_IDS, judgeScore, parseJudge }
