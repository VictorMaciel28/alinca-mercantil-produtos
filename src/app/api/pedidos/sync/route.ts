import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tinyV3Fetch } from '@/lib/tinyOAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TinyPedidoListItem = {
  id?: number
  situacao?: number
  numeroPedido?: number
  dataCriacao?: string
  cliente?: {
    nome?: string
    cpfCnpj?: string
    id?: number
  }
  valor?: string | number
  vendedor?: {
    id?: number
  }
}

function toIsoDate(input: unknown) {
  const raw = String(input || '').trim()
  if (!raw) return new Date().toISOString().slice(0, 10)
  return raw.slice(0, 10)
}

function mapTinySituacaoToPedidoStatus(situacao: number | null | undefined) {
  const code = Number(situacao ?? -1)
  // Mapping based on Tiny status table provided by business:
  // 8 Dados Incompletos, 0 Aberta, 3 Aprovada, 4 Preparando Envio,
  // 1 Faturada, 7 Pronto Envio, 5 Enviada, 6 Entregue, 2 Cancelada, 9 Nao Entregue.
  const map: Record<number, 'APROVADO' | 'PENDENTE' | 'FATURADO' | 'ENVIADO' | 'ENTREGUE' | 'CANCELADO' | 'DADOS_INCOMPLETOS'> = {
    0: 'PENDENTE',          // Aberta
    1: 'FATURADO',          // Faturada
    2: 'CANCELADO',         // Cancelada
    3: 'APROVADO',          // Aprovada
    4: 'PENDENTE',          // Preparando Envio
    5: 'ENVIADO',           // Enviada
    6: 'ENTREGUE',          // Entregue
    7: 'ENVIADO',           // Pronto Envio
    8: 'DADOS_INCOMPLETOS', // Dados Incompletos
    9: 'CANCELADO',         // Nao Entregue (aproximação para status interno existente)
  }
  return map[code] ?? 'PENDENTE'
}

async function fetchTinyPage(limit: number, offset: number) {
  const path = `/pedidos?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`
  const res = await tinyV3Fetch(path, { method: 'GET' })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`tiny_v3_list_failed: status=${res.status}`)
  }
  const itens = Array.isArray(json?.itens) ? json.itens : []
  const total = Number(json?.paginacao?.total ?? 0)
  return { itens: itens as TinyPedidoListItem[], total }
}

export async function POST() {
  try {
    const limit = 100
    let offset = 0
    let total = 0
    const all: TinyPedidoListItem[] = []

    do {
      const page = await fetchTinyPage(limit, offset)
      total = page.total
      if (page.itens.length === 0) break
      all.push(...page.itens)
      offset += limit
    } while (offset < total)

    await prisma.platform_order.deleteMany()

    const parsedRows = all
      .map((row) => {
        const tinyId = Number(row?.id || 0)
        const numero = Number(row?.numeroPedido || 0)
        if (!(tinyId > 0) || !(numero > 0)) return null

        const idClientExterno =
          row?.cliente?.id != null && Number(row.cliente.id) > 0
            ? BigInt(String(row.cliente.id))
            : null

        return {
          numero,
          tiny_id: tinyId,
          data: new Date(toIsoDate(row?.dataCriacao)),
          cliente: String(row?.cliente?.nome || 'Cliente não informado'),
          cnpj: String(row?.cliente?.cpfCnpj || ''),
          total: Number(row?.valor || 0),
          status: mapTinySituacaoToPedidoStatus(row?.situacao) as any,
          id_vendedor_externo: row?.vendedor?.id != null ? String(row.vendedor.id) : null,
          id_client_externo: idClientExterno,
        }
      })
      .filter(Boolean) as Array<{
      numero: number
      tiny_id: number
      data: Date
      cliente: string
      cnpj: string
      total: number
      status: any
      id_vendedor_externo: string | null
      id_client_externo: bigint | null
    }>

    const clientIds = Array.from(
      new Set(parsedRows.map((r) => r.id_client_externo).filter((v): v is bigint => v != null))
    )
    const clients = clientIds.length
      ? await prisma.cliente.findMany({
          where: { external_id: { in: clientIds } },
          select: { external_id: true, id_vendedor_externo: true },
        })
      : []
    const clientVendorByExternalId = new Map<string, string | null>()
    for (const c of clients) {
      clientVendorByExternalId.set(String(c.external_id), c.id_vendedor_externo || null)
    }

    const rowsToInsert = parsedRows.map((r) => {
      const idClienteKey = r.id_client_externo != null ? String(r.id_client_externo) : null
      const clienteExisteLocalmente = idClienteKey != null && clientVendorByExternalId.has(idClienteKey)
      const idClientExternoSafe = clienteExisteLocalmente ? r.id_client_externo : null
      const carteiraVendor =
        idClienteKey != null && clienteExisteLocalmente
          ? clientVendorByExternalId.get(idClienteKey) || null
          : null

      return {
        ...r,
        id_client_externo: idClientExternoSafe,
        client_vendor_externo: carteiraVendor,
      }
    })

    const batchSize = 100
    let imported = 0
    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize)
      if (batch.length === 0) continue
      const result = await prisma.platform_order.createMany({
        data: batch,
      })
      imported += result.count
    }

    return NextResponse.json({
      ok: true,
      totalRecebido: all.length,
      imported,
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Erro ao sincronizar pedidos' },
      { status: 500 }
    )
  }
}

