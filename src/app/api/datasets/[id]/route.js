import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Dataset from '@/lib/models/Dataset'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const invalidId = () =>
  NextResponse.json({ error: 'Invalid dataset id' }, { status: 400 })

export async function GET(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) return invalidId()
  try {
    await connectDb()
    const dataset = await Dataset.findById(id).lean()
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    return NextResponse.json({ dataset })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load dataset', detail: err.message },
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
    if (Array.isArray(body.cases)) {
      update.cases = body.cases.map((entry, index) => ({
        id: entry.id || `case-${Date.now()}-${index}`,
        name: entry.name || `Case ${index + 1}`,
        input: entry.input ?? null,
        expected: entry.expected || '',
        rubric: entry.rubric || '',
      }))
    }
    const dataset = await Dataset.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    return NextResponse.json({ dataset })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update dataset', detail: err.message },
      { status: 500 }
    )
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) return invalidId()
  try {
    await connectDb()
    const dataset = await Dataset.findByIdAndDelete(id).lean()
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete dataset', detail: err.message },
      { status: 500 }
    )
  }
}
