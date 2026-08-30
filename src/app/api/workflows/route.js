import { NextResponse } from 'next/server'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'
import {
  applyModelDefaults,
  createStarterWorkflow,
  getTemplate,
} from '@/lib/engine/starter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDb()
    const workflows = await Workflow.find({}).sort({ updatedAt: -1 }).lean()
    return NextResponse.json({ workflows })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load workflows', detail: err.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    await connectDb()
    const body = await request.json().catch(() => ({}))
    const template = getTemplate(body.template)
    const built = template ? template.build() : createStarterWorkflow()
    const provider = body.provider ?? process.env.DEFAULT_PROVIDER ?? null
    const model = body.model ?? process.env.DEFAULT_MODEL ?? null
    const nodes = applyModelDefaults(body.nodes || built.nodes, { provider, model })
    const workflow = await Workflow.create({
      name: body.name || template?.name || 'Untitled workflow',
      description: body.description || template?.description || '',
      provider,
      model,
      nodes,
      edges: body.edges || built.edges,
    })
    return NextResponse.json({ workflow }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create workflow', detail: err.message },
      { status: 500 }
    )
  }
}
