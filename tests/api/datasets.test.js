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
  process.env.MONGODB_URI = mongo.getUri('agent_workbench_datasets')
  process.env.ALLOW_REAL_PROVIDER = 'false'
  routes = {
    datasets: await import('@/app/api/datasets/route.js'),
    dataset: await import('@/app/api/datasets/[id]/route.js'),
    evalRun: await import('@/app/api/datasets/[id]/run/route.js'),
    evalRuns: await import('@/app/api/eval-runs/[id]/route.js'),
    workflows: await import('@/app/api/workflows/route.js'),
  }
}, 180000)

afterAll(async () => {
  const { disconnectDb } = await import('@/lib/db.js')
  await disconnectDb()
  if (mongo) await mongo.stop()
})

describe('datasets API and eval run', () => {
  let datasetId
  let workflowId

  it('creates a dataset', async () => {
    const { status, body } = await json(
      await routes.datasets.POST(
        request('POST', {
          name: 'Arithmetic',
          cases: [
            { id: 'c1', name: 'Multiply', input: { question: 'What is 7 * 6?' }, expected: '42' },
          ],
        })
      )
    )
    expect(status).toBe(201)
    expect(body.dataset.cases).toHaveLength(1)
    datasetId = body.dataset._id
  })

  it('updates dataset cases', async () => {
    const { status, body } = await json(
      await routes.dataset.PUT(
        request('PUT', {
          cases: [
            { id: 'c1', name: 'Multiply', input: { question: 'What is 7 * 6?' }, expected: '42' },
            { id: 'c2', name: 'Add', input: { question: 'What is 2 + 2?' }, expected: '4' },
          ],
        }),
        params(datasetId)
      )
    )
    expect(status).toBe(200)
    expect(body.dataset.cases).toHaveLength(2)
  })

  it('runs an eval and streams results', async () => {
    const createdWorkflow = await json(await routes.workflows.POST(request('POST', {})))
    workflowId = createdWorkflow.body.workflow._id

    const response = await routes.evalRun.POST(
      request('POST', { workflowId, provider: 'mock', model: 'mock-1' }),
      params(datasetId)
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const text = await response.text()
    expect(text).toContain('event: eval:started')
    expect(text).toContain('event: eval:finished')
    expect(text).toContain('event: stream:done')
  }, 60000)

  it('exposes the persisted eval run', async () => {
    const latest = await json(
      await routes.evalRuns.GET(
        new Request(`http://t/api/eval-runs/latest?datasetId=${datasetId}`),
        params('latest')
      )
    )
    expect(latest.status).toBe(200)
    expect(latest.body.evalRuns.length).toBeGreaterThanOrEqual(1)
    const run = latest.body.evalRuns[0]
    expect(run.status).toBe('success')
    expect(run.results).toHaveLength(2)
    expect(run.aggregate.total).toBe(2)

    const single = await json(
      await routes.evalRuns.GET(new Request('http://t'), params(run._id))
    )
    expect(single.body.evalRun._id).toBe(run._id)
  }, 30000)

  it('requires a workflow id to run an eval', async () => {
    const { status } = await json(
      await routes.evalRun.POST(request('POST', {}), params(datasetId))
    )
    expect(status).toBe(400)
  })

  it('deletes a dataset', async () => {
    expect(
      (await json(await routes.dataset.DELETE(new Request('http://t'), params(datasetId)))).status
    ).toBe(200)
  })
})
