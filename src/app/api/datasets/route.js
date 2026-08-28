import { NextResponse } from 'next/server'
import { connectDb } from '@/lib/db'
import Dataset from '@/lib/models/Dataset'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDb()
    const datasets = await Dataset.find({}).sort({ updatedAt: -1 }).lean()
    return NextResponse.json({ datasets })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load datasets', detail: err.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    await connectDb()
    const body = await request.json().catch(() => ({}))
    const dataset = await Dataset.create({
      name: body.name || 'Untitled dataset',
      description: body.description || '',
      cases: Array.isArray(body.cases)
        ? body.cases.map((entry, index) => ({
            id: entry.id || `case-${Date.now()}-${index}`,
            name: entry.name || `Case ${index + 1}`,
            input: entry.input ?? null,
            expected: entry.expected || '',
            rubric: entry.rubric || '',
          }))
        : [],
    })
    return NextResponse.json({ dataset }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create dataset', detail: err.message },
      { status: 500 }
    )
  }
}
