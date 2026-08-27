import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const invalidId = () =>
  NextResponse.json({ error: 'Invalid workflow id' }, { status: 400 })

export async function GET(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) return invalidId()
  try {
    await connectDb()
    const workflow = await Workflow.findById(id).lean()
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }
    return NextResponse.json({ workflow })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load workflow', detail: err.message },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) return invalidId()
  try {
    await connectDb()
    const body = await request.json().catch(() => ({}))
    const update = {}
    if (typeof body.name === 'string') update.name = body.name
    if (typeof body.description === 'string') update.description = body.description
    if (typeof body.provider === 'string' || body.provider === null) {
      update.provider = body.provider
    }
    if (typeof body.model === 'string' || body.model === null) update.model = body.model
    if (Array.isArray(body.nodes)) update.nodes = body.nodes
    if (Array.isArray(body.edges)) update.edges = body.edges

    const workflow = await Workflow.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean()

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }
    return NextResponse.json({ workflow })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update workflow', detail: err.message },
      { status: 500 }
    )
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) return invalidId()
  try {
    await connectDb()
    const workflow = await Workflow.findByIdAndDelete(id).lean()
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete workflow', detail: err.message },
      { status: 500 }
    )
  }
}
