import { runUserCode } from '../sandbox.js'

const httpRequest = {
  name: 'http_request',
  description: 'Perform an HTTP request and return the status code and parsed body.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Absolute URL to request.' },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
        description: 'HTTP method.',
      },
      headers: { type: 'object', description: 'Optional request headers.' },
      body: { type: 'string', description: 'Optional request body.' },
    },
    required: ['url'],
  },
  async execute(args = {}) {
    const method = String(args.method || 'GET').toUpperCase()
    const headers =
      args.headers && typeof args.headers === 'object' ? { ...args.headers } : {}
    let body
    if (method !== 'GET' && method !== 'HEAD' && args.body !== undefined) {
      body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body)
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
      )
      if (!hasContentType) headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(args.url, {
        method,
        headers,
        body,
        signal: controller.signal,
      })
      const text = await response.text()
      let data = text
      try {
        data = JSON.parse(text)
      } catch {
        /* keep text */
      }
      return { status: response.status, ok: response.ok, data }
    } finally {
      clearTimeout(timer)
    }
  },
}

const calculator = {
  name: 'calculator',
  description: 'Evaluate a basic arithmetic expression and return the number.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'e.g. (21 * 2) + 5' },
    },
    required: ['expression'],
  },
  async execute(args = {}) {
    const expression = String(args.expression || '').trim()
    if (!expression) throw new Error('expression is required')
    if (!/^[-0-9+*/(). %]+$/.test(expression)) {
      throw new Error('expression contains unsupported characters')
    }
    const result = await runUserCode(`return (${expression})`, { timeoutMs: 2000 })
    if (!result.ok) throw new Error(result.error)
    if (typeof result.output !== 'number' || !Number.isFinite(result.output)) {
      throw new Error('expression did not evaluate to a finite number')
    }
    return { expression, result: result.output }
  },
}

const currentTime = {
  name: 'current_time',
  description: 'Return the current date and time.',
  parameters: {
    type: 'object',
    properties: {
      timezone: { type: 'string', description: 'IANA timezone, defaults to UTC.' },
    },
  },
  async execute(args = {}) {
    const timezone = args.timezone || 'UTC'
    let formatted
    try {
      formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(new Date())
    } catch {
      throw new Error(`unknown timezone: ${timezone}`)
    }
    return { timezone, iso: new Date().toISOString(), formatted }
  },
}

export const BUILTIN_TOOLS = {
  [httpRequest.name]: httpRequest,
  [calculator.name]: calculator,
  [currentTime.name]: currentTime,
}

export function listBuiltinTools() {
  return Object.values(BUILTIN_TOOLS).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}
