import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tinyV3Fetch } from '@/lib/tinyOAuth'
import { recomputeCommissionsForOrder } from '@/services/commission'

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
  const method = req.method.toUpperCase()
  detectDevice(userAgent ?? '')

  await prisma.$executeRaw`
    INSERT INTO tiny_raw_logs (
      method, headers, body, ip_address, user_agent, received_at
    ) VALUES (
      ${method},
      ${JSON.stringify(headers)},
      ${rawBody || null},
      ${ipAddress},
      ${userAgent},
      NOW()
    )
  `
}

function mapTinyStatusToPlatform(codigoSituacao: string) {
  const code = (codigoSituacao || '').toLowerCase().trim()
  const map: Record<string, 'APROVADO' | 'PENDENTE' | 'FATURADO' | 'ENVIADO' | 'ENTREGUE' | 'CANCELADO' | 'DADOS_INCOMPLETOS'> = {
    aprovado: 'APROVADO',
    preparando_envio: 'PENDENTE',
    faturado: 'FATURADO',
    enviado: 'ENVIADO',
    entregue: 'ENTREGUE',
    cancelado: 'CANCELADO',
    dados_incompletos: 'DADOS_INCOMPLETOS',
  }
  return map[code] ?? null
}

function normalizeCondicaoPagamento(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  // Tiny v3 often returns "21 28"; UI/options use "21/28D".
  const onlyNumbersAndSpaces = raw.replace(/\s+/g, ' ').trim()
  const parts = onlyNumbersAndSpaces
    .split(' ')
    .map((p) => p.trim())
    .filter((p) => /^\d+$/.test(p))

  if (parts.length > 0 && parts.join(' ') === onlyNumbersAndSpaces) {
    return `${parts.join('/')}D`
  }

  return raw
}

function buildEnderecoEntrega(tinyPedido: any) {
  if (tinyPedido?.enderecoEntrega) {
    return {
      endereco: tinyPedido.enderecoEntrega?.endereco || '',
      numero: tinyPedido.enderecoEntrega?.numero || '',
      complemento: tinyPedido.enderecoEntrega?.complemento || '',
      bairro: tinyPedido.enderecoEntrega?.bairro || '',
      cep: tinyPedido.enderecoEntrega?.cep || '',
      cidade: tinyPedido.enderecoEntrega?.municipio || '',
      uf: tinyPedido.enderecoEntrega?.uf || '',
      endereco_diferente: true,
    }
  }

  if (tinyPedido?.cliente?.endereco) {
    return {
      endereco: tinyPedido.cliente.endereco?.endereco || '',
      numero: tinyPedido.cliente.endereco?.numero || '',
      complemento: tinyPedido.cliente.endereco?.complemento || '',
      bairro: tinyPedido.cliente.endereco?.bairro || '',
      cep: tinyPedido.cliente.endereco?.cep || '',
      cidade: tinyPedido.cliente.endereco?.municipio || '',
      uf: tinyPedido.cliente.endereco?.uf || '',
      endereco_diferente: false,
    }
  }

  return null
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

  let row = await prisma.platform_order.findFirst({
    where: { tiny_id: tinyOrderId },
    select: { id: true, numero: true },
  })
  let tinyPedidoFromV3: any = null

  // If not found locally by tiny_id, fetch from Tiny v3 and persist.
  let tinyFetchError: string | null = null
  if (!row) {
    try {
      const tinyRes = await tinyV3Fetch(`/pedidos/${tinyOrderId}`, { method: 'GET' })
      const tinyJson = await tinyRes.json().catch(() => null)
      const tinyJsonIsObject = !!tinyJson && typeof tinyJson === 'object' && !Array.isArray(tinyJson)
      const rootHasId = tinyJsonIsObject && Number((tinyJson as any)?.id || 0) > 0
      const tinyPedido = rootHasId
        ? tinyJson
        : tinyJson?.item ||
          tinyJson?.pedido ||
          tinyJson?.data ||
          tinyJson?.retorno?.pedido ||
          tinyJson?.retorno?.item ||
          tinyJson
      tinyPedidoFromV3 = tinyPedido

      const numero = Number(tinyPedido?.numeroPedido || tinyPedido?.numero || payload?.dados?.numero || 0)
      const tinyPedidoId = Number(tinyPedido?.id || 0)

      if (tinyRes.ok && tinyPedidoId > 0) {
        if (tinyPedidoId !== tinyOrderId) {
          tinyFetchError = `tiny_v3_id_mismatch: expected=${tinyOrderId}, got=${tinyPedidoId}`
          throw new Error(tinyFetchError)
        }
        if (!Number.isFinite(numero) || numero <= 0) {
          tinyFetchError = `tiny_v3_missing_numero: status=${tinyRes.status}, keys=${Object.keys(tinyJson || {}).join(',')}`
          throw new Error(tinyFetchError)
        }
        const dataStr = String(tinyPedido?.data || '').slice(0, 10)
        const clienteNome = String(tinyPedido?.cliente?.nome || '').trim()
        const clienteCpfCnpj = String(tinyPedido?.cliente?.cpfCnpj || '').trim()
        const vendedorExterno =
          tinyPedido?.vendedor?.id != null ? String(tinyPedido.vendedor.id).trim() : null
        const idClientExterno =
          tinyPedido?.cliente?.id != null ? BigInt(String(tinyPedido.cliente.id)) : null
        const formaRecebimento = tinyPedido?.pagamento?.formaRecebimento?.nome
          ? String(tinyPedido.pagamento.formaRecebimento.nome)
          : null
        const condicaoPagamento = normalizeCondicaoPagamento(tinyPedido?.pagamento?.condicaoPagamento)
        const enderecoEntrega = buildEnderecoEntrega(tinyPedido)

        const existingByTinyId = await prisma.platform_order.findFirst({
          where: { tiny_id: tinyOrderId },
          select: { id: true, numero: true },
        })
        const existingByNumero = await prisma.platform_order.findUnique({ where: { numero } })
        const baseData: any = {
          numero,
          data: dataStr ? new Date(dataStr) : new Date(),
          cliente: clienteNome || 'Cliente não informado',
          cnpj: clienteCpfCnpj || '',
          total: Number(tinyPedido?.valorTotalPedido || tinyPedido?.valorTotalProdutos || 0),
          status: mappedStatus || 'PENDENTE',
          forma_recebimento: formaRecebimento,
          condicao_pagamento: condicaoPagamento,
          endereco_entrega: enderecoEntrega,
          id_vendedor_externo: vendedorExterno,
          id_client_externo: idClientExterno,
          tiny_id: tinyOrderId,
          id_nota_fiscal: notaFiscalId || null,
        }

        if (existingByTinyId) {
          await prisma.platform_order.update({
            where: { id: existingByTinyId.id },
            data: baseData,
          })
        } else if (existingByNumero) {
          await prisma.platform_order.update({
            where: { numero },
            data: baseData,
          })
        } else {
          await prisma.platform_order.create({ data: baseData })
        }

        row = await prisma.platform_order.findFirst({
          where: { tiny_id: tinyOrderId },
          select: { id: true, numero: true },
        })
      } else {
        tinyFetchError = `tiny_v3_not_found_or_invalid: status=${tinyRes.status}, tinyPedidoId=${tinyPedidoId}, rootHasId=${rootHasId ? 1 : 0}, keys=${Object.keys(tinyJson || {}).join(',')}`
      }
    } catch (e: any) {
      tinyFetchError = e?.message || 'tiny_v3_fetch_failed'
    }
  }

  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: 'pedido_not_found_by_tiny_id',
        tiny_id: tinyOrderId,
        detail: tinyFetchError,
      },
      { status: 404 }
    )
  }

  // For existing orders, we still refresh full Tiny payload and items.
  // This keeps platform_order_product in sync when webhook arrives after order already exists.
  if (!tinyPedidoFromV3) {
    try {
      const tinyRes = await tinyV3Fetch(`/pedidos/${tinyOrderId}`, { method: 'GET' })
      const tinyJson = await tinyRes.json().catch(() => null)
      const tinyJsonIsObject = !!tinyJson && typeof tinyJson === 'object' && !Array.isArray(tinyJson)
      const rootHasId = tinyJsonIsObject && Number((tinyJson as any)?.id || 0) > 0
      const tinyPedido = rootHasId
        ? tinyJson
        : tinyJson?.item ||
          tinyJson?.pedido ||
          tinyJson?.data ||
          tinyJson?.retorno?.pedido ||
          tinyJson?.retorno?.item ||
          tinyJson
      if (tinyRes.ok && Number(tinyPedido?.id || 0) === tinyOrderId) {
        tinyPedidoFromV3 = tinyPedido
      }
    } catch {
      // Keep flow resilient; status update should not fail if Tiny detail fetch fails here.
    }
  }

  if (tinyPedidoFromV3) {
    const enderecoEntrega = buildEnderecoEntrega(tinyPedidoFromV3)
    if (enderecoEntrega) {
      await prisma.platform_order.update({
        where: { id: row.id },
        data: { endereco_entrega: enderecoEntrega },
      })
    }

    const itens = Array.isArray(tinyPedidoFromV3?.itens) ? tinyPedidoFromV3.itens : []
    await prisma.platform_order_product.deleteMany({ where: { tiny_id: tinyOrderId } as any })
    if (itens.length > 0) {
      await prisma.platform_order_product.createMany({
        data: itens.map((it: any) => ({
          tiny_id: tinyOrderId,
          produto_id: it?.produto?.id != null ? Number(it.produto.id) : null,
          codigo: it?.produto?.sku ? String(it.produto.sku) : null,
          nome: String(it?.produto?.descricao || 'Produto'),
          preco: Number(it?.valorUnitario || 0),
          quantidade: Number(it?.quantidade || 0),
          unidade: 'UN',
        })) as any,
      })
    }
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

  let commission: any = null
  if (mappedStatus === 'FATURADO') {
    try {
      commission = await recomputeCommissionsForOrder(row.numero)
    } catch (e: any) {
      commission = { ok: false, reason: 'commission_failed', detail: String(e?.message || e) }
    }
  }

  return NextResponse.json({
    ok: true,
    numero: row.numero,
    tiny_id: tinyOrderId,
    status_received: payload?.dados?.codigoSituacao ?? null,
    status_saved: mappedStatus,
    id_nota_fiscal_saved: notaFiscalId,
    commission,
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
