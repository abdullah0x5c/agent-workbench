/**
 * Client-safe metadata for every node type. No server-only imports.
 */
export const NODE_META = {
  input: {
    type: 'input',
    label: 'Input',
    category: 'Input',
    description: 'Workflow entry point. Supplies the task input to the graph.',
    color: '#f59e0b',
    badge: 'IN',
    inputMode: 'none',
    inputs: [],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Input',
      example: '{\n  "question": "What is (21 * 2) + 8?"\n}',
    }),
  },

  agent: {
    type: 'agent',
    label: 'Agent',
    category: 'Agents',
    description: 'An LLM that reasons and calls tools in a loop until it answers.',
    color: '#6366f1',
    badge: 'AI',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Agent',
      systemPrompt:
        'You are a concise assistant. Use the available tools when they help, then give a short final answer.',
      provider: null,
      model: null,
      tools: ['calculator'],
      maxIterations: 8,
      memoryNamespace: '',
      memoryTopK: 3,
    }),
  },

  router: {
    type: 'router',
    label: 'Router',
    category: 'Logic',
    description: 'Evaluate a condition and route data to the true or false branch.',
    color: '#a855f7',
    badge: 'if',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [
      { id: 'true', label: 'True' },
      { id: 'false', label: 'False' },
    ],
    defaultData: () => ({
      label: 'Router',
      code: 'return Boolean(input)',
    }),
  },

  code: {
    type: 'code',
    label: 'Code',
    category: 'Logic',
    description: 'Transform data with sandboxed JavaScript.',
    color: '#10b981',
    badge: '{}',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Code',
      code: '// `input` is the previous node output.\nreturn input',
    }),
  },

  httpRequest: {
    type: 'httpRequest',
    label: 'HTTP Request',
    category: 'Network',
    description: 'Call an HTTP endpoint and return the status and body.',
    color: '#0ea5e9',
    badge: 'HTTP',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'HTTP Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: '',
      body: '',
      timeoutMs: 10000,
    }),
  },

  memory: {
    type: 'memory',
    label: 'Memory',
    category: 'Memory',
    description: 'Save text to long-term memory, or retrieve the most relevant entries.',
    color: '#14b8a6',
    badge: 'MEM',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Memory',
      op: 'search',
      namespace: 'default',
      topK: 3,
    }),
  },

  loop: {
    type: 'loop',
    label: 'Loop',
    category: 'Flow',
    description: 'Map the step expression over each item of the incoming array.',
    color: '#f97316',
    badge: 'LOOP',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Loop',
      step: 'return input',
      maxItems: 25,
    }),
  },

  output: {
    type: 'output',
    label: 'Output',
    category: 'Output',
    description: 'Marks the value returned by the workflow.',
    color: '#f43f5e',
    badge: 'OUT',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [],
    defaultData: () => ({ label: 'Output' }),
  },
}

export const NODE_META_LIST = Object.values(NODE_META)

export function getNodeMeta(type) {
  return NODE_META[type] || null
}

export function listNodeMeta() {
  return NODE_META_LIST.map((meta) => ({
    type: meta.type,
    label: meta.label,
    category: meta.category,
    description: meta.description,
    color: meta.color,
    badge: meta.badge,
    inputs: meta.inputs,
    outputs: meta.outputs,
    inputMode: meta.inputMode,
    defaultData: meta.defaultData(),
  }))
}
