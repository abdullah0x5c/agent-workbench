import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

function token(password) {
  return crypto.createHash('sha256').update(`agent-workbench:${password}`).digest('hex')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const expected = process.env.DEMO_PASSWORD
  if (!expected) {
    return NextResponse.json({ ok: true, gate: false })
  }
  const body = await request.json().catch(() => ({}))
  if (String(body.password || '') !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true, gate: true })
  response.cookies.set('aw_auth', token(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('aw_auth', '', { path: '/', maxAge: 0 })
  return response
}
