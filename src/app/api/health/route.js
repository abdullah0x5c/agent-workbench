import { NextResponse } from 'next/server'
import { allowRealProvider, hasOpenCodeKey } from '@/lib/providers/index.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'agent-workbench',
    realtime: process.env.NEXT_PUBLIC_REALTIME || 'socket',
    realProviderAllowed: allowRealProvider(),
    opencodeKeyPresent: hasOpenCodeKey(),
    demoGate: Boolean(process.env.DEMO_PASSWORD),
  })
}
