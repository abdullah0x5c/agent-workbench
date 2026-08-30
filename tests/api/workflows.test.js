// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let routes

const params = (id) => ({ params: Promise.resolve({ id }) })
const json = async (response) => ({ status: response.status, body: await response.json() })
const post = (url, body) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri('agent_workbench_api')
  process.env.ALLOW_REAL_PROVIDER = 'false'
  routes = {
    workflows: await import('@/app/api/workflows/route.js'),
    workflow: await import('@/app/api/workflows/[id]/route.js'),
    run: await import('@/app/api/workflows/[id]/run/route.js'),
    workflowRuns: await import('@/app/api/workflows/[id]/runs/route.js'),
    runById: await import('@/app/api/runs/[id]/route.js'),
  }
}, 180000)

afterAll(async () => {
  const { disconnectDb } = await import('@/lib/db.js')
  await disconnectDb()
  if (mongo) await mongo.stop()
})

describe('workflow API', () => {
  let workflowId

  it('creates a workflow seeded with the starter graph', async () => {
    const { status, body } = await json(await routes.workflows.POST(post('http://t/api/workflows')))
    expect(status).toBe(201)
    expect(body.workflow.nodes.length).toBe(3)
    expect(body.workflow.edges.length).toBe(2)
    workflowId = body.workflow._id
  })

  it('lists and reads workflows', async () => {
    const list = await json(await routes.workflows.GET())
    expect(list.status).toBe(200)
    expect(list.body.workflows.length).toBeGreaterThanOrEqual(1)

    const single = await json(
      await routes.workflow.GET(new Request('http://t'), params(workflowId))
    )
    expect(single.body.workflow._id).toBe(workflowId)
  })

  it('updates name and graph', async () => {
    const response = await routes.workflow.PUT(
      new Request('http://t', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed', model: 'mock-fast' }),
      }),
      params(workflowId)
    )
    const { status, body } = await json(response)
    expect(status).toBe(200)
    expect(body.workflow.name).toBe('Renamed')
    expect(body.workflow.model).toBe('mock-fast')
  })

  it('validates ids and missing workflows', async () => {
    expect((await json(await routes.workflow.GET(new Request('http://t'), params('bad')))).status).toBe(400)
    expect(
      (await json(await routes.workflow.GET(new Request('http://t'), params('0123456789abcdef01234567')))).status
    ).toBe(404)
  })

  it('rejects running a cyclic workflow', async () => {
    const created = await json(
      await routes.workflows.POST(
        post('http://t/api/workflows', {
          nodes: [
            { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: {} },
            { id: 'b', type: 'code', position: { x: 1, y: 0 }, data: {} },
          ],
          edges: [
            { id: 'e1', source: 'a', target: 'b' },
            { id: 'e2', source: 'b', target: 'a' },
          ],
        })
      )
    )
    const { status, body } = await json(
      await routes.run.POST(post('http://t'), params(created.body.workflow._id))
    )
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_graph')
  })

  it('runs a workflow and persists spans', async () => {
    const started = await json(
      await routes.run.POST(post('http://t', { model: 'mock-1' }), params(workflowId))
    )
    expect(started.status).toBe(202)

    let run
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const polled = await json(
        await routes.runById.GET(new Request('http://t'), params(started.body.runId))
      )
      run = polled.body.run
      if (run.status !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    expect(run.status).toBe('success')
    expect(run.spans.some((span) => span.type === 'llm')).toBe(true)
    expect(run.spans.some((span) => span.type === 'tool')).toBe(true)
    expect(run.usage.totalTokens).toBeGreaterThan(0)
    expect(run.output).toMatch(/tool result/i)
  }, 30000)

  it('lists runs without spans payloads', async () => {
    const { status, body } = await json(
      await routes.workflowRuns.GET(new Request('http://t'), params(workflowId))
    )
    expect(status).toBe(200)
    expect(body.runs.length).toBeGreaterThanOrEqual(1)
    expect(body.runs[0].spans).toBeUndefined()
  })

  it('deletes a workflow', async () => {
    expect(
      (await json(await routes.workflow.DELETE(new Request('http://t'), params(workflowId)))).status
    ).toBe(200)
  })
})
