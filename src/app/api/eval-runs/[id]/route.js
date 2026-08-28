import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import EvalRun from '@/lib/models/EvalRun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { id } = await params

  if (id === 'latest') {
    const datasetId = new URL(request.url).searchParams.get('datasetId')
    if (!datasetId || !mongoose.isValidObjectId(datasetId)) {
      return NextResponse.json({ error: 'datasetId is required' }, { status: 400 })
    }
    await connectDb()
    const runs = await EvalRun.find({ datasetId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
    return NextResponse.json({ evalRuns: runs })
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid eval run id' }, { status: 400 })
  }
  try {
    await connectDb()
    const evalRun = await EvalRun.findById(id).lean()
    if (!evalRun) {
      return NextResponse.json({ error: 'Eval run not found' }, { status: 404 })
    }
    return NextResponse.json({ evalRun })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load eval run', detail: err.message },
      { status: 500 }
    )
  }
}
