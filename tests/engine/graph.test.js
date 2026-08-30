// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  topologicalOrder,
  validateGraph,
  isEdgeActive,
  indexGraph,
  findTriggerNodes,
} from '@/lib/engine/graph.js'

const nodes = [
  { id: 'a', type: 'input' },
  { id: 'b', type: 'agent' },
  { id: 'c', type: 'output' },
]
const edges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'b', target: 'c' },
]

describe('topologicalOrder', () => {
  it('orders dependencies first', () => {
    expect(topologicalOrder(['a', 'b', 'c'], edges)).toEqual(['a', 'b', 'c'])
  })

  it('throws on a cycle', () => {
    const cyclic = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ]
    expect(() => topologicalOrder(['a', 'b'], cyclic)).toThrow(/cycle/i)
  })
})

describe('validateGraph', () => {
  it('accepts a valid graph', () => {
    expect(validateGraph(nodes, edges).valid).toBe(true)
  })

  it('rejects an empty graph', () => {
    expect(validateGraph([], []).valid).toBe(false)
  })

  it('rejects edges to unknown nodes', () => {
    const result = validateGraph(nodes, [{ id: 'x', source: 'a', target: 'ghost' }])
    expect(result.errors.join(' ')).toMatch(/unknown node/)
  })

  it('rejects duplicate ids and self loops', () => {
    expect(
      validateGraph([{ id: 'a', type: 'input' }, { id: 'a', type: 'code' }], []).errors.join(' ')
    ).toMatch(/Duplicate/)
    expect(validateGraph(nodes, [{ id: 'x', source: 'a', target: 'a' }]).valid).toBe(false)
  })

  it('requires an input node', () => {
    const result = validateGraph([{ id: 'a', type: 'agent' }], [])
    expect(result.errors.join(' ')).toMatch(/Input node/)
  })
})

describe('indexGraph', () => {
  it('indexes nodes and edges', () => {
    const { nodeMap, outgoingByNode, incomingByNode } = indexGraph(nodes, edges)
    expect(nodeMap.size).toBe(3)
    expect(outgoingByNode.get('a').map((edge) => edge.id)).toEqual(['e1'])
    expect(incomingByNode.get('c').map((edge) => edge.id)).toEqual(['e2'])
  })
})

describe('findTriggerNodes', () => {
  it('finds input nodes', () => {
    expect(findTriggerNodes(nodes).map((node) => node.id)).toEqual(['a'])
  })
})

describe('isEdgeActive', () => {
  const nodeMap = new Map([
    ['router', { id: 'router', type: 'router' }],
    ['n', { id: 'n', type: 'code' }],
  ])

  it('follows the taken router branch', () => {
    const results = new Map([['router', { status: 'success', branch: 'true' }]])
    expect(
      isEdgeActive({ source: 'router', sourceHandle: 'true' }, results, new Set(), nodeMap)
    ).toBe(true)
    expect(
      isEdgeActive({ source: 'router', sourceHandle: 'false' }, results, new Set(), nodeMap)
    ).toBe(false)
  })

  it('defaults to the true handle', () => {
    const results = new Map([['router', { status: 'success' }]])
    expect(
      isEdgeActive({ source: 'router', sourceHandle: 'true' }, results, new Set(), nodeMap)
    ).toBe(true)
  })

  it('is inactive when the source failed or was skipped', () => {
    expect(
      isEdgeActive({ source: 'n' }, new Map([['n', { status: 'failed' }]]), new Set(), nodeMap)
    ).toBe(false)
    expect(
      isEdgeActive({ source: 'n' }, new Map([['n', { status: 'success' }]]), new Set(['n']), nodeMap)
    ).toBe(false)
  })

  it('is active for a successful plain node', () => {
    expect(
      isEdgeActive({ source: 'n' }, new Map([['n', { status: 'success' }]]), new Set(), nodeMap)
    ).toBe(true)
  })
})
