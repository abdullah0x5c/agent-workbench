import { getNodeDefinition } from './nodeTypes.js'

function node(id, type, position, overrides = {}) {
  const def = getNodeDefinition(type)
  return { id, type, position, data: { ...def.defaultData(), ...overrides } }
}

/**
 * Ready-made workflows. Each is a self-contained graph so it runs immediately
 * with whichever provider/model the deployment defaults to.
 */
export const WORKFLOW_TEMPLATES = [
  {
    id: 'first-agent',
    name: 'First agent',
    description: 'Input -> Agent that calls the calculator -> Output',
    build: () => ({
      nodes: [
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
        node('output-1', 'output', { x: 780, y: 220 }, { label: 'Answer' }),
      ],
      edges: [
        { id: 'e-input-agent', source: 'input-1', target: 'agent-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e-agent-output', source: 'agent-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    }),
  },

  {
    id: 'summarizer',
    name: 'Text summarizer',
    description: 'Input -> Agent that summarizes text into three bullets',
    build: () => ({
      nodes: [
        node('input-1', 'input', { x: 40, y: 200 }, {
          label: 'Article',
          example: JSON.stringify(
            {
              text: 'The James Webb Space Telescope has observed galaxies further away than any previous instrument. Its infrared sensors can see through dust clouds that block visible light. Astronomers have already published hundreds of papers based on its first year of data.',
            },
            null,
            2
          ),
        }),
        node('agent-1', 'agent', { x: 360, y: 170 }, {
          label: 'Summarizer',
          systemPrompt:
            'Summarize input.text in exactly three concise bullet points. Return only the bullets.',
          tools: [],
          maxIterations: 2,
        }),
        node('output-1', 'output', { x: 780, y: 200 }, { label: 'Summary' }),
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'agent-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'agent-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    }),
  },

  {
    id: 'sentiment-router',
    name: 'Sentiment router',
    description: 'Agent classifies a review, a Router sends it down one of two paths',
    build: () => ({
      nodes: [
        node('input-1', 'input', { x: 40, y: 240 }, {
          label: 'Review',
          example: JSON.stringify({ review: 'I absolutely love this product!' }, null, 2),
        }),
        node('agent-1', 'agent', { x: 340, y: 210 }, {
          label: 'Classifier',
          systemPrompt:
            'Classify the sentiment of input.review. Reply with exactly one word: positive or negative.',
          tools: [],
          maxIterations: 2,
        }),
        node('router-1', 'router', { x: 700, y: 240 }, {
          label: 'Positive?',
          code: 'return /positive|love|great|good|excellent/i.test(String(input))',
        }),
        node('output-yes', 'output', { x: 1020, y: 120 }, { label: 'Positive path' }),
        node('output-no', 'output', { x: 1020, y: 360 }, { label: 'Negative path' }),
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'agent-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'agent-1', target: 'router-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e3', source: 'router-1', target: 'output-yes', sourceHandle: 'true', targetHandle: 'in' },
        { id: 'e4', source: 'router-1', target: 'output-no', sourceHandle: 'false', targetHandle: 'in' },
      ],
    }),
  },

  {
    id: 'memory-assistant',
    name: 'Memory assistant',
    description: 'Retrieve long-term memory with BM25, then answer with it injected',
    build: () => ({
      nodes: [
        node('input-1', 'input', { x: 40, y: 220 }, {
          label: 'Question',
          example: JSON.stringify({ question: 'What does the user prefer?' }, null, 2),
        }),
        node('memory-1', 'memory', { x: 320, y: 220 }, {
          label: 'Recall',
          op: 'search',
          namespace: 'assistant',
          topK: 3,
        }),
        node('agent-1', 'agent', { x: 620, y: 190 }, {
          label: 'Assistant',
          systemPrompt:
            'Answer the question using the relevant memory when it helps. If memory is empty, say you do not know yet.',
          tools: [],
          maxIterations: 2,
          memoryNamespace: 'assistant',
          memoryTopK: 3,
        }),
        node('output-1', 'output', { x: 1000, y: 220 }, { label: 'Answer' }),
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'memory-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'memory-1', target: 'agent-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e3', source: 'agent-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    }),
  },

  {
    id: 'batch-extractor',
    name: 'Batch extractor',
    description: 'Loop over a list of items and compute a value for each',
    build: () => ({
      nodes: [
        node('input-1', 'input', { x: 60, y: 220 }, {
          label: 'Items',
          example: JSON.stringify(
            { items: [{ name: 'alpha', qty: 2 }, { name: 'beta', qty: 5 }, { name: 'gamma', qty: 9 }] },
            null,
            2
          ),
        }),
        node('loop-1', 'loop', { x: 400, y: 220 }, {
          label: 'Compute totals',
          step: 'return { name: input.name, total: (input.qty || 0) * 10 }',
          maxItems: 25,
        }),
        node('output-1', 'output', { x: 780, y: 220 }, { label: 'Totals' }),
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'loop-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'loop-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    }),
  },
]

export const STARTER_WORKFLOW_NAME = WORKFLOW_TEMPLATES[0].name

export function getTemplate(id) {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id) || null
}

export function createStarterWorkflow() {
  return WORKFLOW_TEMPLATES[0].build()
}

/** Fills in provider/model on agent nodes so the inspector shows real values. */
export function applyModelDefaults(nodes = [], defaults = {}) {
  const provider = defaults.provider || null
  const model = defaults.model || null
  return nodes.map((entry) => {
    if (entry.type !== 'agent') return entry
    const data = { ...entry.data }
    if (!data.provider) data.provider = provider
    if (!data.model) data.model = model
    return { ...entry, data }
  })
}
