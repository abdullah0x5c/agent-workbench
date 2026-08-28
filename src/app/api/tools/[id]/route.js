import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Tool from '@/lib/models/Tool'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid tool id' }, { status: 400 })
  }
  try {
    await connectDb()
    const body = await request.json().catch(() => ({}))
    const update = {}
    if (typeof body.description === 'string') update.description = body.description
    if (typeof body.code === 'string') update.code = body.code
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled
    if (body.parameters !== undefined) {
      update.parameters =
        typeof body.parameters === 'string'
          ? JSON.parse(body.parameters || '{}')
          : body.parameters
    }
    const tool = await Tool.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }
    return NextResponse.json({ tool })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update tool', detail: err.message },
      { status: 400 }
    )
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid tool id' }, { status: 400 })
  }
  try {
    await connectDb()
    const tool = await Tool.findByIdAndDelete(id).lean()
    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete tool', detail: err.message },
      { status: 500 }
    )
  }
}
