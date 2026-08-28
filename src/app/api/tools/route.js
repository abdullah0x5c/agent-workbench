import { NextResponse } from 'next/server'
import { connectDb } from '@/lib/db'
import Tool from '@/lib/models/Tool'
import { listBuiltinTools } from '@/lib/engine/tools/builtins'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDb()
    const tools = await Tool.find({}).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ builtins: listBuiltinTools(), tools })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load tools', detail: err.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    await connectDb()
    const body = await request.json().catch(() => ({}))
    if (!body.name) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 })
    }
    const tool = await Tool.create({
      name: body.name,
      description: body.description || '',
      parameters:
        typeof body.parameters === 'string'
          ? JSON.parse(body.parameters || '{}')
          : body.parameters || { type: 'object', properties: {} },
      code: body.code || 'return { ok: true }',
      enabled: body.enabled !== false,
    })
    return NextResponse.json({ tool }, { status: 201 })
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'A tool with that name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create tool', detail: err.message },
      { status: 400 }
    )
  }
}
