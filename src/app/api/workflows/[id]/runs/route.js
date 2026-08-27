import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Run from '@/lib/models/Run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid workflow id' }, { status: 400 })
  }
  try {
    await connectDb()
    const runs = await Run.find({ workflowId: id })
      .sort({ createdAt: -1 })
      .limit(25)
      .select('-spans')
      .lean()
    return NextResponse.json({ runs })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load runs', detail: err.message },
      { status: 500 }
    )
  }
}
