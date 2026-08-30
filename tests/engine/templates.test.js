// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  WORKFLOW_TEMPLATES,
  getTemplate,
  createStarterWorkflow,
  applyModelDefaults,
} from '@/lib/engine/templates.js'
import { validateGraph } from '@/lib/engine/graph.js'

describe('workflow templates', () => {
  it('ships at least five templates with unique ids', () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(5)
    const ids = WORKFLOW_TEMPLATES.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const template of WORKFLOW_TEMPLATES) {
    it(`"${template.name}" builds a valid graph`, () => {
      const { nodes, edges } = template.build()
      const validation = validateGraph(nodes, edges)
      expect(validation.valid).toBe(true)

      const ids = new Set(nodes.map((node) => node.id))
      expect(ids.size).toBe(nodes.length)
      for (const edge of edges) {
        expect(ids.has(edge.source)).toBe(true)
        expect(ids.has(edge.target)).toBe(true)
      }
      expect(nodes.some((node) => node.type === 'input')).toBe(true)
      expect(nodes.some((node) => node.type === 'output')).toBe(true)
    })
  }

  it('looks templates up by id', () => {
    expect(getTemplate('summarizer').name).toBe('Text summarizer')
    expect(getTemplate('batch-extractor')).toBeTruthy()
    expect(getTemplate('nope')).toBeNull()
  })

  it('createStarterWorkflow returns the first template graph', () => {
    const starter = createStarterWorkflow()
    expect(starter.nodes[0].type).toBe('input')
    expect(validateGraph(starter.nodes, starter.edges).valid).toBe(true)
  })

  it('routes the sentiment template through a router with both branches', () => {
    const { nodes, edges } = getTemplate('sentiment-router').build()
    const router = nodes.find((node) => node.type === 'router')
    expect(router).toBeTruthy()
    const handles = edges
      .filter((edge) => edge.source === router.id)
      .map((edge) => edge.sourceHandle)
    expect(handles.sort()).toEqual(['false', 'true'])
  })

  it('applyModelDefaults fills provider and model on agent nodes only', () => {
    const nodes = [
      { id: 'a', type: 'agent', data: { label: 'A' } },
      { id: 'b', type: 'agent', data: { label: 'B', model: 'keep-me' } },
      { id: 'c', type: 'code', data: {} },
    ]
    const out = applyModelDefaults(nodes, {
      provider: 'opencode',
      model: 'deepseek-v4.1-flash',
    })
    expect(out[0].data.provider).toBe('opencode')
    expect(out[0].data.model).toBe('deepseek-v4.1-flash')
    expect(out[1].data.model).toBe('keep-me')
    expect(out[2].data.model).toBeUndefined()
  })
})
