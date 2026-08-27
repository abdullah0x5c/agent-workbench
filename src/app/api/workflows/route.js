import { NextResponse } from 'next/server'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'
import { createStarterWorkflow } from '@/lib/engine/starter'

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
    const starter = createStarterWorkflow()
    const workflow = await Workflow.create({
      name: body.name || 'Untitled workflow',
      description: body.description || '',
      provider: body.provider || null,
      model: body.model || null,
      nodes: body.nodes || starter.nodes,
      edges: body.edges || starter.edges,
    })
    return NextResponse.json({ workflow }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create workflow', detail: err.message },
      { status: 500 }
    )
  }
}
