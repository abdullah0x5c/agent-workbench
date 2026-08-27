import { getNodeDefinition } from './nodeTypes.js'
import { indexGraph, topologicalOrder, isEdgeActive } from './graph.js'
import { toSerializable, withTimeout } from './sandbox.js'
import { getProvider, resolveProviderName } from '../providers/index.js'
import { buildToolRegistry } from './tools/registry.js'
import { emitToSocket } from '../realtime/io.js'

const nowIso = () => new Date().toISOString()

const DEFAULT_RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS || 300000)

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

function addUsage(target, usage) {
  if (!usage) return target
  target.promptTokens += usage.promptTokens || 0
  target.completionTokens += usage.completionTokens || 0
  target.totalTokens += usage.totalTokens || 0
  return target
}

export async function executeWorkflow({
  workflow,
  runId,
  input = null,
  onEvent,
  providerName,
  model,
  timeoutMs = DEFAULT_RUN_TIMEOUT_MS,
} = {}) {
  const nodes = workflow?.nodes || []
  const edges = workflow?.edges || []
  const workflowId = workflow?.id || String(workflow?._id || '')
  const cache = {}

  const resolvedName = resolveProviderName(providerName || workflow?.provider)
  const provider = getProvider(providerName || workflow?.provider)
  const activeModel =
    model || workflow?.model || process.env.DEFAULT_MODEL || 'mock-1'
  const usedMock = provider.name === 'mock'

  const spansById = new Map()
  const usage = emptyUsage()

  const emit = (event, payload) => {
    const enriched = {
      runId,
      workflowId,
      at: nowIso(),
      ...payload,
    }
    if (
      event === 'span:started' ||
      event === 'span:finished' ||
      event === 'span:failed'
    ) {
      const current = spansById.get(payload.id) || {}
      spansById.set(payload.id, { ...current, ...payload, event })
    }
    if (typeof onEvent === 'function') onEvent(event, enriched)
    else emitToSocket({ workflowId, runId, event, payload: enriched })
  }

  const { nodeMap } = indexGraph(nodes, edges)
  const results = new Map()
  const skipped = new Set()
  const nodeRuns = []
  const startedAt = nowIso()
  const runStart = Date.now()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (typeof timer.unref === 'function') timer.unref()

  const record = (entry) => {
    results.set(entry.nodeId, entry)
    nodeRuns.push(entry)
  }

  emit('run:started', { runId, workflowId, provider: resolvedName, model: activeModel, usedMock, input, startedAt })

  let order
  try {
    order = topologicalOrder(nodes.map((n) => n.id), edges)
  } catch (err) {
    clearTimeout(timer)
    const finishedAt = nowIso()
    emit('run:failed', { error: err.message, finishedAt })
    return {
      status: 'failed',
      error: err.message,
      provider: resolvedName,
      model: activeModel,
      usedMock,
      startedAt,
      finishedAt,
      durationMs: 0,
      nodeRuns,
      spans: [],
      output: null,
      usage,
    }
  }

  let failure = null
  const registryCache = new Map()

  const runBody = async () => {
    for (const nodeId of order) {
      if (controller.signal.aborted) {
        throw new Error(`Run timed out after ${timeoutMs}ms`)
      }

      const node = nodeMap.get(nodeId)
      const def = getNodeDefinition(node.type)
      const incomingEdges = edges.filter((edge) => edge.target === nodeId)
      const activeIncoming = incomingEdges.filter((edge) =>
        isEdgeActive(edge, results, skipped, nodeMap)
      )

      if (incomingEdges.length > 0 && activeIncoming.length === 0) {
        skipped.add(nodeId)
        const entry = {
          nodeId,
          type: node.type,
          status: 'skipped',
          input: null,
          output: null,
          logs: [],
          startedAt: null,
          finishedAt: null,
          durationMs: 0,
        }
        record(entry)
        emit('node:skipped', entry)
        continue
      }

      if (!def) {
        const entry = {
          nodeId,
          type: node.type,
          status: 'failed',
          input: null,
          output: null,
          error: `Unknown node type "${node.type}"`,
          logs: [],
          startedAt: nowIso(),
          finishedAt: nowIso(),
          durationMs: 0,
        }
        record(entry)
        skipped.add(nodeId)
        emit('node:failed', entry)
        failure = entry.error
        break
      }

      const collected = activeIncoming.map((edge) => results.get(edge.source)?.output)
      let nodeInput
      if (def.inputMode === 'none') nodeInput = undefined
      else if (def.inputMode === 'multiple') nodeInput = collected
      else nodeInput = collected.length ? collected[collected.length - 1] : undefined

      const nodeStart = nowIso()
      emit('node:started', {
        nodeId,
        type: node.type,
        label: node.data?.label || def.label,
        input: toSerializable(nodeInput),
        startedAt: nodeStart,
      })

      try {
        let registry = null
        if (node.type === 'agent' && Array.isArray(node.data?.tools) && node.data.tools.length) {
          const key = node.data.tools.join(',')
          if (!registryCache.has(key)) {
            registryCache.set(key, await buildToolRegistry(node.data.tools))
          }
          registry = registryCache.get(key)
        }

        const ctx = {
          nodeId,
          nodeType: node.type,
          nodeLabel: node.data?.label || def.label,
          workflowId,
          runId,
          cache,
          input,
          signal: controller.signal,
        }

        const result = await def.run({
          input: nodeInput,
          inputs: collected,
          data: node.data || {},
          node,
          ctx,
          emit,
          provider,
          model: activeModel,
          registry,
          memoryContext: null,
        })

        if (result?.error) {
          const err = new Error(result.error)
          err.logs = result.logs || []
          throw err
        }

        const finishedAt = nowIso()
        const entry = {
          nodeId,
          type: node.type,
          status: 'success',
          branch: result?.branch || null,
          input: toSerializable(nodeInput),
          output: toSerializable(result?.output ?? null),
          logs: toSerializable(result?.logs || []),
          startedAt: nodeStart,
          finishedAt,
          durationMs: Date.parse(finishedAt) - Date.parse(nodeStart),
        }
        record(entry)
        emit('node:finished', entry)
      } catch (err) {
        const finishedAt = nowIso()
        const entry = {
          nodeId,
          type: node.type,
          status: 'failed',
          input: toSerializable(nodeInput),
          output: null,
          error: err?.message || 'Unknown node error',
          logs: toSerializable(err?.logs || []),
          startedAt: nodeStart,
          finishedAt,
          durationMs: Date.parse(finishedAt) - Date.parse(nodeStart),
        }
        record(entry)
        skipped.add(nodeId)
        emit('node:failed', entry)
        failure = entry.error
        break
      }
    }
  }

  try {
    await withTimeout(runBody(), timeoutMs, `Run timed out after ${timeoutMs}ms`)
  } catch (err) {
    failure = failure || err.message
  } finally {
    clearTimeout(timer)
  }

  const spans = [...spansById.values()]
  for (const span of spans) addUsage(usage, span.usage)

  const outputNodes = nodeRuns.filter((entry) => entry.type === 'output' && entry.status === 'success')
  const output =
    outputNodes.length > 0
      ? outputNodes[outputNodes.length - 1].output
      : nodeRuns.length > 0
        ? nodeRuns[nodeRuns.length - 1].output
        : null

  const finishedAt = nowIso()
  const status = failure ? 'failed' : 'success'
  emit(status === 'success' ? 'run:finished' : 'run:failed', {
    status,
    error: failure,
    output,
    usage,
    finishedAt,
    durationMs: Date.now() - runStart,
  })

  return {
    status,
    error: failure,
    provider: resolvedName,
    model: activeModel,
    usedMock,
    startedAt,
    finishedAt,
    durationMs: Date.now() - runStart,
    nodeRuns,
    spans: toSerializable(spans),
    output: toSerializable(output),
    usage,
  }
}

export default executeWorkflow
