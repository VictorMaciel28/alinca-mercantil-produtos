import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (!ua) return 'unknown'
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile'
  if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet'
  if (ua.includes('postman') || ua.includes('insomnia') || ua.includes('curl') || ua.includes('httpie')) {
    return 'api-client'
  }
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'bot'
  return 'desktop'
}

async function logWebhook(req: NextRequest) {
  const body = await req.text()
  const headers = Object.fromEntries(req.headers.entries())
  const userAgent = req.headers.get('user-agent') ?? null
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    req.headers.get('cf-connecting-ip') ??
    null

  const endpoint = req.nextUrl.pathname
  const queryParams = req.nextUrl.searchParams.toString() || null
  const method = req.method.toUpperCase()
  const device = detectDevice(userAgent ?? '')

  await prisma.$executeRaw`
    INSERT INTO webhook_log (
      endpoint, method, headers, body, ip_address, user_agent, device, query_params, received_at
    ) VALUES (
      ${endpoint},
      ${method},
      ${JSON.stringify(headers)},
      ${body || null},
      ${ipAddress},
      ${userAgent},
      ${device},
      ${queryParams},
      NOW()
    )
  `
}

async function handle(req: NextRequest) {
  try {
    await logWebhook(req)
    return NextResponse.json({ ok: true, message: 'webhook recebido' }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'falha ao registrar webhook',
        detail: error?.message ?? 'erro interno',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return handle(req)
}

export async function PUT(req: NextRequest) {
  return handle(req)
}

export async function PATCH(req: NextRequest) {
  return handle(req)
}

export async function DELETE(req: NextRequest) {
  return handle(req)
}
