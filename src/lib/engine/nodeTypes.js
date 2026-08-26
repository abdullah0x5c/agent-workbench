import { runUserCode } from './sandbox.js'
import { isPlainObject } from './graph.js'
import { NODE_META } from './nodeCatalog.js'
import { runAgent } from './agentLoop.js'
import { saveMemory, searchMemory } from '../memory/store.js'

const parseJsonish = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function asText(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const runners = {
  input: async ({ data, ctx }) => {
    if (ctx.input !== undefined && ctx.input !== null) {
      return { output: ctx.input }
    }
    const example = data?.example
    if (example === undefined || example === null || String(example).trim() === '') {
      return { output: null }
    }
    return { output: parseMaybeJson(String(example)) }
  },

  agent: async ({ input, data, node, ctx, emit, provider, model, registry, memoryContext }) => {
    const result = await runAgent({
      node,
      input,
      ctx,
      provider,
      model,
      registry,
      emit,
      memoryContext:
        memoryContext ??
        (data?.memoryNamespace
          ? await buildMemoryContext({
              namespace: data.memoryNamespace,
              query: asText(input),
              topK: data.memoryTopK,
            })
          : null),
    })
    return { output: result.output }
  },

  router: async ({ input, data, ctx }) => {
    const code = data?.code || 'return Boolean(input)'
    const result = await runUserCode(code, { input, ctx })
    if (!result.ok) return { error: result.error, logs: result.logs }
    const condition = Boolean(result.output)
    const passed = isPlainObject(input)
      ? { ...input, _branch: condition ? 'true' : 'false' }
      : { value: input, _branch: condition ? 'true' : 'false' }
    return {
      output: passed,
      branch: condition ? 'true' : 'false',
      logs: result.logs,
    }
  },

  code: async ({ input, data, ctx }) => {
    const result = await runUserCode(data?.code ?? 'return input', { input, ctx })
    return {
      output: result.output,
      logs: result.logs,
      error: result.ok ? null : result.error,
    }
  },

  httpRequest: async ({ data }) => {
    const method = String(data?.method || 'GET').toUpperCase()
    const url = data?.url
    if (!url) throw new Error('HTTP Request node needs a URL')
    const headers = parseJsonish(data?.headers, {})
    const timeoutMs = Math.min(Math.max(Number(data?.timeoutMs) || 10000, 100), 60000)

    let body
    if (method !== 'GET' && method !== 'HEAD' && data?.body) {
      body = typeof data.body === 'string' ? data.body : JSON.stringify(data.body)
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
      )
      if (!hasContentType) headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal })
      const text = await response.text()
      let parsed = text
      try {
        parsed = JSON.parse(text)
      } catch {
        /* keep text */
      }
      return {
        output: {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsed,
        },
      }
    } finally {
      clearTimeout(timer)
    }
  },

  memory: async ({ input, data, ctx, emit }) => {
    const namespace = data?.namespace || 'default'
    const op = data?.op || 'search'
    const startedAt = new Date().toISOString()
    const span = {
      id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      nodeId: ctx.nodeId,
      nodeLabel: ctx.nodeLabel,
      type: 'memory',
      name: `${op}:${namespace}`,
      status: 'running',
      startedAt,
    }
    emit?.('span:started', span)

    try {
      if (op === 'save') {
        const text = data?.text ? String(data.text) : asText(input)
        const saved = await saveMemory({ namespace, text, kind: data?.kind || 'fact' })
        span.status = 'success'
        span.toolResult = saved
        span.finishedAt = new Date().toISOString()
        span.durationMs = Date.parse(span.finishedAt) - Date.parse(startedAt)
        emit?.('span:finished', span)
        return { output: { saved, input } }
      }

      const query = data?.query ? String(data.query) : asText(input)
      const results = await searchMemory({ namespace, query, topK: data?.topK || 3 })
      span.status = 'success'
      span.toolResult = results
      span.finishedAt = new Date().toISOString()
      span.durationMs = Date.parse(span.finishedAt) - Date.parse(startedAt)
      emit?.('span:finished', span)
      return { output: { query, results } }
    } catch (err) {
      span.status = 'failed'
      span.error = err.message
      span.finishedAt = new Date().toISOString()
      span.durationMs = Date.parse(span.finishedAt) - Date.parse(startedAt)
      emit?.('span:failed', span)
      throw err
    }
  },

  loop: async ({ input, data, ctx }) => {
    const items = Array.isArray(input)
      ? input
      : Array.isArray(input?.items)
        ? input.items
        : []
    const maxItems = Math.min(Math.max(Number(data?.maxItems) || 25, 1), 200)
    const step = data?.step || 'return input'
    const results = []

    for (let index = 0; index < items.length && index < maxItems; index += 1) {
      const result = await runUserCode(step, {
        input: items[index],
        ctx: { ...ctx, index, item: items[index] },
      })
      if (!result.ok) throw new Error(`Loop step failed at item ${index}: ${result.error}`)
      results.push(result.output)
    }

    return { output: { items: results, count: results.length } }
  },

  output: async ({ input }) => ({ output: input }),
}

async function buildMemoryContext({ namespace, query, topK }) {
  try {
    const results = await searchMemory({ namespace, query, topK })
    if (!results.length) return null
    return results.map((entry) => `- ${entry.text}`).join('\n')
  } catch {
    return null
  }
}

export const NODE_DEFINITIONS = Object.fromEntries(
  Object.entries(NODE_META).map(([type, meta]) => [type, { ...meta, run: runners[type] }])
)

export function getNodeDefinition(type) {
  return NODE_DEFINITIONS[type] || null
}

export function listNodeDefinitions() {
  return Object.values(NODE_DEFINITIONS).map((def) => ({
    type: def.type,
    label: def.label,
    category: def.category,
    description: def.description,
    color: def.color,
    badge: def.badge,
    inputs: def.inputs,
    outputs: def.outputs,
    defaultData: def.defaultData(),
  }))
}

export { parseJsonish }
