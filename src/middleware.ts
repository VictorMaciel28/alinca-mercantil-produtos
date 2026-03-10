import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') {
    return NextResponse.next()
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'kvwLrfri/MBznUCofIoRH9+NvGu6GqvVdqO3mor1GuA=' })
  if (token) {
    return NextResponse.redirect(new URL('/pedidos', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
