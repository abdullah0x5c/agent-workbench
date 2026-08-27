import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Run from '@/lib/models/Run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid run id' }, { status: 400 })
  }
  try {
    await connectDb()
    const run = await Run.findById(id).lean()
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ run })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load run', detail: err.message },
      { status: 500 }
    )
  }
}
