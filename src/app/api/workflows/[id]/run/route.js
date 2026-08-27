import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'
import Run from '@/lib/models/Run'
import { validateGraph } from '@/lib/engine/graph'
import { executeWorkflow } from '@/lib/engine/executor'
import { createSseStream } from '@/lib/api/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function persistRun(runDocId, result, extra = {}) {
  await Run.findByIdAndUpdate(runDocId, {
    status: result.status,
    provider: result.provider,
    model: result.model,
    usedMock: result.usedMock,
    output: result.output ?? null,
    error: result.error || null,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    usage: result.usage || null,
    nodeRuns: result.nodeRuns || [],
    spans: result.spans || [],
    ...extra,
  }).catch(() => {})
}

export async function POST(request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid workflow id' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    await connectDb()
    const workflow = await Workflow.findById(id).lean()
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const validation = validateGraph(workflow.nodes, workflow.edges)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'invalid_graph', errors: validation.errors },
        { status: 400 }
      )
    }

    const serialized = {
      id: workflow._id.toString(),
      name: workflow.name,
      provider: workflow.provider,
      model: workflow.model,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }

    const wantsStream =
      new URL(request.url).searchParams.get('stream') === '1' ||
      String(request.headers.get('accept') || '').includes('text/event-stream')

    const input = body.input ?? null
    const providerName = body.provider || undefined
    const model = body.model || undefined

    const run = await Run.create({
      workflowId: workflow._id,
      status: 'running',
      startedAt: new Date().toISOString(),
      input,
      provider: providerName || workflow.provider || null,
      model: model || workflow.model || null,
    })
    const runId = run._id.toString()

    if (!wantsStream) {
      // Socket.io transport: kick off detached, stream over websocket rooms.
      executeWorkflow({
        workflow: serialized,
        runId,
        input,
        providerName,
        model,
      })
        .then((result) => persistRun(run._id, result))
        .catch((err) => persistRun(run._id, {
          status: 'failed',
          error: err.message,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          nodeRuns: [],
          spans: [],
        }))

      return NextResponse.json({ runId, workflowId: serialized.id }, { status: 202 })
    }

    // SSE transport: execute inside this streaming response.
    const sse = createSseStream()
    sse.send('stream:open', { runId, workflowId: serialized.id })

    ;(async () => {
      try {
        const result = await executeWorkflow({
          workflow: serialized,
          runId,
          input,
          providerName,
          model,
          onEvent: (event, payload) => sse.send(event, payload),
        })
        await persistRun(run._id, result)
        sse.send('stream:done', {
          runId,
          status: result.status,
          error: result.error || null,
        })
      } catch (err) {
        sse.send('run:failed', { error: err.message })
        await persistRun(run._id, {
          status: 'failed',
          error: err.message,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          nodeRuns: [],
          spans: [],
        })
      } finally {
        sse.close()
      }
    })()

    return new Response(sse.stream, { headers: sse.headers })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to start run', detail: err.message },
      { status: 500 }
    )
  }
}
