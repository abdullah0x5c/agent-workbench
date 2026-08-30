import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Dataset from '@/lib/models/Dataset'
import Workflow from '@/lib/models/Workflow'
import EvalRun from '@/lib/models/EvalRun'
import { validateGraph } from '@/lib/engine/graph'
import { runEval } from '@/lib/eval/runner'
import { createSseStream } from '@/lib/api/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid dataset id' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    await connectDb()
    const dataset = await Dataset.findById(id).lean()
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    if (!body.workflowId || !mongoose.isValidObjectId(body.workflowId)) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }
    const workflow = await Workflow.findById(body.workflowId).lean()
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

    const judgeProvider = body.judgeProvider || undefined
    const judgeModel = body.judgeModel || process.env.JUDGE_MODEL || undefined

    const evalRun = await EvalRun.create({
      datasetId: dataset._id,
      workflowId: workflow._id,
      provider: body.provider || workflow.provider || null,
      model: body.model || workflow.model || null,
      judgeProvider: judgeProvider || null,
      judgeModel: judgeModel || null,
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    const evalRunId = evalRun._id.toString()

    const serialized = {
      id: workflow._id.toString(),
      name: workflow.name,
      provider: workflow.provider,
      model: workflow.model,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }

    const sse = createSseStream()
    sse.send('stream:open', { evalRunId })

    ;(async () => {
      try {
        const { results, aggregate } = await runEval({
          dataset: JSON.parse(JSON.stringify(dataset)),
          workflow: serialized,
          providerName: body.provider || undefined,
          model: body.model || undefined,
          judgeProvider,
          judgeModel,
          onEvent: (event, payload) => sse.send(event, payload),
          runIdPrefix: evalRunId,
        })
        await EvalRun.findByIdAndUpdate(evalRunId, {
          status: 'success',
          finishedAt: new Date().toISOString(),
          results,
          aggregate,
        })
        sse.send('stream:done', { evalRunId, aggregate })
      } catch (err) {
        await EvalRun.findByIdAndUpdate(evalRunId, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: err.message,
        }).catch(() => {})
        sse.send('eval:failed', { error: err.message })
      } finally {
        sse.close()
      }
    })()

    return new Response(sse.stream, { headers: sse.headers })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to start eval run', detail: err.message },
      { status: 500 }
    )
  }
}
