// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { executeWorkflow } from '@/lib/engine/executor.js'
import { createStarterWorkflow } from '@/lib/engine/starter.js'

function collector() {
  const events = []
  return { events, onEvent: (event, payload) => events.push({ event, payload }) }
}

describe('executeWorkflow', () => {
  it('runs the starter graph with the mock provider', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'r1',
      onEvent,
    })

    expect(result.status).toBe('success')
    expect(result.usedMock).toBe(true)
    expect(result.nodeRuns.map((node) => node.nodeId)).toEqual([
      'input-1',
      'agent-1',
      'output-1',
    ])
    expect(result.spans.some((span) => span.type === 'llm')).toBe(true)
    expect(result.spans.some((span) => span.type === 'tool')).toBe(true)
    expect(result.output).toMatch(/tool result/i)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  })

  it('uses an explicit run input over the node example', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'r2',
      input: { question: 'What is 9 * 9?' },
      onEvent,
    })

    const toolSpan = result.spans.find((span) => span.type === 'tool')
    expect(toolSpan.toolResult.result).toBe(81)
  })

  it('emits run lifecycle and span events', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { events, onEvent } = collector()
    await executeWorkflow({ workflow: { id: 'wf1', nodes, edges }, runId: 'r3', onEvent })

    const names = events.map((entry) => entry.event)
    expect(names[0]).toBe('run:started')
    expect(names).toContain('node:started')
    expect(names).toContain('span:started')
    expect(names).toContain('span:finished')
    expect(names[names.length - 1]).toBe('run:finished')
  })

  it('skips the untaken router branch', async () => {
    const nodes = [
      { id: 'in', type: 'input', data: { example: '{"value": 1}' } },
      { id: 'r', type: 'router', data: { code: 'return input.value > 10' } },
      { id: 'yes', type: 'output', data: {} },
      { id: 'no', type: 'output', data: {} },
    ]
    const edges = [
      { id: 'e1', source: 'in', target: 'r' },
      { id: 'e2', source: 'r', target: 'yes', sourceHandle: 'true' },
      { id: 'e3', source: 'r', target: 'no', sourceHandle: 'false' },
    ]
    const { events, onEvent } = collector()
    const result = await executeWorkflow({
      workflow: { id: 'wf2', nodes, edges },
      runId: 'r4',
      onEvent,
    })

    expect(result.status).toBe('success')
    const skipped = events
      .filter((entry) => entry.event === 'node:skipped')
      .map((entry) => entry.payload.nodeId)
    expect(skipped).toContain('yes')
    const finished = result.nodeRuns
      .filter((node) => node.status === 'success')
      .map((node) => node.nodeId)
    expect(finished).toContain('no')
  })

  it('fails fast when a node throws', async () => {
    const nodes = [
      { id: 'in', type: 'input', data: { example: '{}' } },
      { id: 'c', type: 'code', data: { code: 'throw new Error("kaboom")' } },
      { id: 'out', type: 'output', data: {} },
    ]
    const edges = [
      { id: 'e1', source: 'in', target: 'c' },
      { id: 'e2', source: 'c', target: 'out' },
    ]
    const { events, onEvent } = collector()
    const result = await executeWorkflow({
      workflow: { id: 'wf3', nodes, edges },
      runId: 'r5',
      onEvent,
    })

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/kaboom/)
    expect(result.nodeRuns.some((node) => node.nodeId === 'out')).toBe(false)
    expect(events[events.length - 1].event).toBe('run:failed')
  })

  it('reports cycles without running', async () => {
    const nodes = [
      { id: 'a', type: 'input', data: {} },
      { id: 'b', type: 'code', data: {} },
    ]
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ]
    const { onEvent } = collector()
    const result = await executeWorkflow({
      workflow: { id: 'wf4', nodes, edges },
      runId: 'r6',
      onEvent,
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/cycle/i)
    expect(result.nodeRuns).toHaveLength(0)
  })

  it('fails on unknown node types', async () => {
    const { onEvent } = collector()
    const result = await executeWorkflow({
      workflow: { id: 'wf5', nodes: [{ id: 'x', type: 'mystery', data: {} }], edges: [] },
      runId: 'r7',
      onEvent,
    })
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/Unknown node type/)
  })
})
