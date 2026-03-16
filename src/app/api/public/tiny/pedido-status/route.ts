import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (!ua) return 'unknown'
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile'
  if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet'
  if (ua.includes('postman') || ua.includes('insomnia') || ua.includes('curl') || ua.includes('httpie')) return 'api-client'
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'bot'
  return 'desktop'
}

async function logWebhook(req: NextRequest, rawBody: string) {
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
      ${rawBody || null},
      ${ipAddress},
      ${userAgent},
      ${device},
      ${queryParams},
      NOW()
    )
  `
}

function mapTinyStatusToPlatform(codigoSituacao: string) {
  const code = (codigoSituacao || '').toLowerCase().trim()
  const map: Record<string, 'PENDENTE' | 'FATURADO' | 'ENVIADO' | 'ENTREGUE' | 'CANCELADO' | 'DADOS_INCOMPLETOS'> = {
    aprovado: 'PENDENTE',
    preparando_envio: 'PENDENTE',
    faturado: 'FATURADO',
    enviado: 'ENVIADO',
    entregue: 'ENTREGUE',
    cancelado: 'CANCELADO',
    dados_incompletos: 'DADOS_INCOMPLETOS',
  }
  return map[code] ?? null
}

async function handle(req: NextRequest) {
  const raw = await req.text()
  try {
    await logWebhook(req, raw)
  } catch {
    // Don't break status processing if webhook_log fails.
  }

  let payload: any = null
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (payload?.tipo !== 'atualizacao_pedido') {
    return NextResponse.json({ ok: true, ignored: true, reason: 'tipo_not_supported' })
  }

  const tinyOrderId = Number(payload?.dados?.id || 0)
  if (!Number.isFinite(tinyOrderId) || tinyOrderId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_tiny_order_id' }, { status: 400 })
  }

  const mappedStatus = mapTinyStatusToPlatform(String(payload?.dados?.codigoSituacao || ''))
  const notaFiscalIdRaw = String(payload?.dados?.idNotaFiscal || '').trim()
  const notaFiscalId = notaFiscalIdRaw && notaFiscalIdRaw !== '0' ? notaFiscalIdRaw : null

  const row = await prisma.platform_order.findFirst({
    where: { tiny_id: tinyOrderId },
    select: { id: true, numero: true },
  })

  if (!row) {
    return NextResponse.json({ ok: false, error: 'pedido_not_found_by_tiny_id', tiny_id: tinyOrderId }, { status: 404 })
  }

  const updateData: any = {}
  const current = await prisma.platform_order.findUnique({
    where: { id: row.id },
    select: { status: true, tiny_id: true },
  })

  const hasStatusChange = !!mappedStatus && current?.status !== mappedStatus
  if (mappedStatus) updateData.status = mappedStatus
  if (notaFiscalId) updateData.id_nota_fiscal = notaFiscalId

  if (Object.keys(updateData).length > 0) {
    await prisma.platform_order.update({
      where: { id: row.id },
      data: updateData,
    })
  }

  if (hasStatusChange) {
    await prisma.$executeRaw`
      INSERT INTO platform_order_status_history (tiny_id, status, changed_at)
      VALUES (${tinyOrderId}, ${String(mappedStatus)}, NOW())
    `
  }

  return NextResponse.json({
    ok: true,
    numero: row.numero,
    tiny_id: tinyOrderId,
    status_received: payload?.dados?.codigoSituacao ?? null,
    status_saved: mappedStatus,
    id_nota_fiscal_saved: notaFiscalId,
  })
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
