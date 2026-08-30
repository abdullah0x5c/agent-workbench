import { NextResponse } from 'next/server'
import { WORKFLOW_TEMPLATES } from '@/lib/engine/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    templates: WORKFLOW_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
    })),
  })
}
