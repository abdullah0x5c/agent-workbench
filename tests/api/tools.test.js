// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let routes

const params = (id) => ({ params: Promise.resolve({ id }) })
const json = async (response) => ({ status: response.status, body: await response.json() })
const request = (method, body) =>
  new Request('http://t', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri('agent_workbench_tools')
  routes = {
    tools: await import('@/app/api/tools/route.js'),
    tool: await import('@/app/api/tools/[id]/route.js'),
  }
}, 180000)

afterAll(async () => {
  const { disconnectDb } = await import('@/lib/db.js')
  await disconnectDb()
  if (mongo) await mongo.stop()
})

describe('tools API', () => {
  let toolId

  it('lists built-in tools', async () => {
    const { status, body } = await json(await routes.tools.GET())
    expect(status).toBe(200)
    expect(body.builtins.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['http_request', 'calculator', 'current_time'])
    )
  })

  it('creates a custom tool', async () => {
    const { status, body } = await json(
      await routes.tools.POST(
        request('POST', {
          name: 'word_count',
          description: 'Count words',
          parameters: { type: 'object', properties: { text: { type: 'string' } } },
          code: 'return { count: String(input.text || "").split(/\\s+/).filter(Boolean).length }',
        })
      )
    )
    expect(status).toBe(201)
    expect(body.tool.name).toBe('word_count')
    toolId = body.tool._id
  })

  it('rejects a duplicate tool name', async () => {
    const { status } = await json(
      await routes.tools.POST(request('POST', { name: 'word_count' }))
    )
    expect(status).toBe(409)
  })

  it('rejects an invalid tool name', async () => {
    const { status } = await json(
      await routes.tools.POST(request('POST', { name: 'Bad Name!' }))
    )
    expect(status).toBe(400)
  })

  it('updates a tool', async () => {
    const { status, body } = await json(
      await routes.tool.PUT(request('PUT', { description: 'Counts words' }), params(toolId))
    )
    expect(status).toBe(200)
    expect(body.tool.description).toBe('Counts words')
  })

  it('deletes a tool', async () => {
    expect(
      (await json(await routes.tool.DELETE(new Request('http://t'), params(toolId)))).status
    ).toBe(200)
    const list = await json(await routes.tools.GET())
    expect(list.body.tools).toHaveLength(0)
  })
})
