import { NextResponse } from 'next/server'

async function expectedToken(password) {
  const data = new TextEncoder().encode(`agent-workbench:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request) {
  const password = process.env.DEMO_PASSWORD
  if (!password) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get('aw_auth')?.value
  const expected = await expectedToken(password)
  if (cookie === expected) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
