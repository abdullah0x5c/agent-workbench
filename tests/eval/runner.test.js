// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { runEval } from '@/lib/eval/runner.js'
import { createStarterWorkflow } from '@/lib/engine/starter.js'

function collector() {
  const events = []
  return { events, onEvent: (event, payload) => events.push({ event, payload }) }
}

describe('runEval', () => {
  const { nodes, edges } = createStarterWorkflow()
  const workflow = { id: 'wf1', nodes, edges }
  const dataset = {
    id: 'ds1',
    name: 'Arithmetic',
    cases: [
      { id: 'c1', name: 'Multiply', input: { question: 'What is 7 * 6?' }, expected: '42', rubric: '' },
      { id: 'c2', name: 'Add', input: { question: 'What is 100 + 23?' }, expected: '123', rubric: '' },
    ],
  }

  it('scores every case and aggregates', async () => {
    const { events, onEvent } = collector()
    const { results, aggregate } = await runEval({
      dataset,
      workflow,
      providerName: 'mock',
      model: 'mock-1',
      judgeProvider: 'mock',
      judgeModel: 'mock-1',
      onEvent,
    })

    expect(results).toHaveLength(2)
    expect(results[0].score).toBe(1)
    expect(aggregate.total).toBe(2)
    expect(aggregate.passed).toBe(2)
    expect(aggregate.score).toBe(1)
    expect(events.some((entry) => entry.event === 'eval:started')).toBe(true)
    expect(events.filter((entry) => entry.event === 'eval:case')).toHaveLength(4)
    expect(events.some((entry) => entry.event === 'eval:finished')).toBe(true)
  })

  it('reports a zero score for mismatched expectations', async () => {
    const badDataset = {
      id: 'ds2',
      cases: [
        { id: 'c1', name: 'Bad', input: { question: 'What is 7 * 6?' }, expected: 'a purple elephant', rubric: '' },
      ],
    }
    const { onEvent } = collector()
    const { results, aggregate } = await runEval({
      dataset: badDataset,
      workflow,
      providerName: 'mock',
      model: 'mock-1',
      onEvent,
    })
    expect(results[0].score).toBe(0)
    expect(aggregate.passed).toBe(0)
    expect(aggregate.score).toBe(0)
  })

  it('handles an empty dataset', async () => {
    const { onEvent } = collector()
    const { results, aggregate } = await runEval({
      dataset: { id: 'ds3', cases: [] },
      workflow,
      providerName: 'mock',
      model: 'mock-1',
      onEvent,
    })
    expect(results).toHaveLength(0)
    expect(aggregate).toEqual({ score: null, passed: 0, total: 0 })
  })
})
