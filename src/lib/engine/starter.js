import { getNodeDefinition } from './nodeTypes.js'

function node(id, type, position, overrides = {}) {
  const def = getNodeDefinition(type)
  return {
    id,
    type,
    position,
    data: { ...def.defaultData(), ...overrides },
  }
}

export function createStarterWorkflow() {
  const nodes = [
    node('input-1', 'input', { x: 40, y: 220 }, {
      label: 'Task',
      example: JSON.stringify({ question: 'What is (21 * 2) + 8?' }, null, 2),
    }),
    node('agent-1', 'agent', { x: 360, y: 180 }, {
      label: 'Solver',
      systemPrompt:
        'You are a precise assistant. When a calculation is needed, call the calculator tool, then answer in one short sentence.',
      tools: ['calculator'],
      maxIterations: 6,
    }),
    node('output-1', 'output', { x: 760, y: 220 }, { label: 'Answer' }),
  ]

  const edges = [
    {
      id: 'e-input-agent',
      source: 'input-1',
      target: 'agent-1',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
    {
      id: 'e-agent-output',
      source: 'agent-1',
      target: 'output-1',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
  ]

  return { nodes, edges }
}

export const STARTER_WORKFLOW_NAME = 'First agent'
