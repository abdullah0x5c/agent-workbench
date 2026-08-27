import { NextResponse } from 'next/server'
import { listModels, listProviders } from '@/lib/providers/index.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const provider = new URL(request.url).searchParams.get('provider') || undefined

  try {
    const [providers, models] = await Promise.all([
      listProviders(),
      listModels(provider),
    ])
    return NextResponse.json({
      providers,
      provider: models.provider,
      models: models.models,
      usedMock: models.usedMock,
      note: models.note || null,
      defaultModel: process.env.DEFAULT_MODEL || null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load models', detail: err.message },
      { status: 500 }
    )
  }
}
