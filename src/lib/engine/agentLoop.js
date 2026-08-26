import { toSerializable } from './sandbox.js'
import { toOpenAITools, executeTool } from './tools/registry.js'

let spanCounter = 0

function nextSpanId(prefix) {
  spanCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${spanCounter}`
}

function nowIso() {
  return new Date().toISOString()
}

function elapsed(startedAt, finishedAt) {
  return Date.parse(finishedAt) - Date.parse(startedAt)
}

/**
 * Runs a bounded ReAct loop for an Agent node:
 *   think (LLM) -> call tool(s) -> observe -> repeat until a final answer.
 * Every LLM call and tool call is emitted as a span so the UI can render a
 * live trace.
 */
export async function runAgent({
  node,
  input,
  ctx,
  provider,
  model,
  registry,
  emit = () => {},
  memoryContext = null,
} = {}) {
  const data = node?.data || {}
  const maxIterations = Number(
    data.maxIterations || process.env.AGENT_MAX_ITERATIONS || 8
  )
  const maxToolCalls = Number(process.env.AGENT_MAX_TOOL_CALLS || 20)
  const tools = registry ? toOpenAITools(registry) : []

  const messages = []
  if (data.systemPrompt) messages.push({ role: 'system', content: data.systemPrompt })
  if (memoryContext) {
    messages.push({
      role: 'system',
      content: `Relevant memory retrieved for this task:\n${memoryContext}`,
    })
  }
  const userContent =
    typeof input === 'string' ? input : JSON.stringify(input ?? null)
  messages.push({ role: 'user', content: userContent })

  const spans = []
  let toolCallCount = 0

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const startedAt = nowIso()
    const span = {
      id: nextSpanId('llm'),
      parentId: null,
      nodeId: ctx.nodeId,
      nodeLabel: ctx.nodeLabel,
      type: 'llm',
      name: `${provider.name}/${model}`,
      status: 'running',
      startedAt,
      model,
      provider: provider.name,
      messages: toSerializable(messages),
      content: null,
      reasoning: null,
      toolCalls: [],
      usage: null,
      error: null,
    }
    emit('span:started', span)

    let result
    try {
      result = await provider.chatStream({
        model,
        messages,
        tools,
        sessionId: `${ctx.runId}:${ctx.nodeId}`,
        signal: ctx.signal,
        onDelta: (delta) =>
          emit('span:delta', { ...delta, spanId: span.id, nodeId: ctx.nodeId }),
      })
    } catch (err) {
      const finishedAt = nowIso()
      span.status = 'failed'
      span.error = err.message
      span.finishedAt = finishedAt
      span.durationMs = elapsed(startedAt, finishedAt)
      emit('span:failed', span)
      spans.push(span)
      throw err
    }

    const finishedAt = nowIso()
    span.status = 'success'
    span.finishedAt = finishedAt
    span.durationMs = elapsed(startedAt, finishedAt)
    span.content = toSerializable(result.content || '')
    span.reasoning = result.reasoning || null
    span.toolCalls = toSerializable(result.toolCalls || [])
    span.usage = result.usage || null
    emit('span:finished', span)
    spans.push(span)

    if (result.toolCalls?.length) {
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      })

      for (const call of result.toolCalls) {
        toolCallCount += 1
        if (toolCallCount > maxToolCalls) {
          throw new Error(`Agent exceeded ${maxToolCalls} tool calls`)
        }

        let args = {}
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
        } catch {
          args = { _raw: call.function.arguments }
        }

        const toolStart = nowIso()
        const toolSpan = {
          id: nextSpanId('tool'),
          parentId: span.id,
          nodeId: ctx.nodeId,
          nodeLabel: ctx.nodeLabel,
          type: 'tool',
          name: call.function.name,
          status: 'running',
          startedAt: toolStart,
          toolName: call.function.name,
          toolArgs: toSerializable(args),
          toolResult: null,
          error: null,
        }
        emit('span:started', toolSpan)

        let toolResult
        let toolError = null
        try {
          toolResult = await executeTool(registry, call.function.name, args)
        } catch (err) {
          toolError = err.message
          toolResult = { error: err.message }
        }

        const toolEnd = nowIso()
        toolSpan.finishedAt = toolEnd
        toolSpan.durationMs = elapsed(toolStart, toolEnd)
        toolSpan.toolResult = toSerializable(toolResult)
        toolSpan.status = toolError ? 'failed' : 'success'
        toolSpan.error = toolError
        emit(toolError ? 'span:failed' : 'span:finished', toolSpan)
        spans.push(toolSpan)

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult).slice(0, 8000),
        })
      }

      continue
    }

    return {
      output: result.content,
      messages: toSerializable(messages),
      spans,
      iterations: iteration + 1,
      toolCallCount,
    }
  }

  throw new Error(
    `Agent exceeded ${maxIterations} iterations without producing a final answer`
  )
}
