import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const roleParam = (searchParams.get('role') || '').toString().trim().toUpperCase()
    const vendorExterno = (searchParams.get('vendor_externo') || '').toString().trim()
    const startStr = (searchParams.get('start') || '').toString().slice(0, 10)
    const endStr = (searchParams.get('end') || '').toString().slice(0, 10)

    const whereBase: any = {
      status: {
        in: ['FATURADO', 'ENVIADO', 'ENTREGUE'],
      },
    }
    if (startStr || endStr) {
      whereBase.data = {}
      if (startStr) whereBase.data.gte = new Date(startStr + 'T00:00:00.000Z')
      if (endStr) whereBase.data.lte = new Date(endStr + 'T23:59:59.999Z')
    }

    const orders = await prisma.platform_order.findMany({
      where: whereBase,
      include: { cliente_rel: true },
      orderBy: { data: 'desc' },
      take: 10000,
    })

    const externosSet = new Set<string>()
    for (const order of orders) {
      if (order.id_vendedor_externo) externosSet.add(order.id_vendedor_externo)
      const clientVendor = order.cliente_rel?.id_vendedor_externo || order.client_vendor_externo || null
      if (clientVendor) externosSet.add(clientVendor)
    }
    const externos = Array.from(externosSet)
    const vendors =
      externos.length > 0
        ? await prisma.vendedor.findMany({
            where: { id_vendedor_externo: { in: externos } },
            select: { id_vendedor_externo: true, nome: true },
          })
        : []
    const nameByExt = new Map(vendors.map((v) => [v.id_vendedor_externo || '', v.nome]))

    type ClientBreakdown = {
      cliente: string
      cnpj: string
      num_registros: number
      total: number
      order_total: number
    }

    type Grouped = {
      externo: string
      nome: string | null
      num_registros: number
      total: number
      order_total: number
    }

    const vendedorMap = new Map<string, Grouped>()
    const televendasMap = new Map<string, Grouped>()
    const vendedorByClient = new Map<string, Map<string, ClientBreakdown>>()
    const televendasByClient = new Map<string, Map<string, ClientBreakdown>>()

    const clientKey = (cliente: string, cnpj: string) => `${cnpj.trim()}|${cliente.trim()}`

    const addGroup = (
      map: Map<string, Grouped>,
      byClient: Map<string, Map<string, ClientBreakdown>>,
      externo: string,
      amount: number,
      orderAmount: number,
      clienteNome: string,
      clienteCnpj: string,
    ) => {
      if (!externo) return
      if (vendorExterno && externo !== vendorExterno) return
      const current =
        map.get(externo) || {
          externo,
          nome: nameByExt.get(externo) || null,
          num_registros: 0,
          total: 0,
          order_total: 0,
        }
      current.num_registros += 1
      current.total = Number((current.total + amount).toFixed(2))
      current.order_total = Number((current.order_total + orderAmount).toFixed(2))
      map.set(externo, current)

      const key = clientKey(clienteNome, clienteCnpj)
      let inner = byClient.get(externo)
      if (!inner) {
        inner = new Map()
        byClient.set(externo, inner)
      }
      const prev =
        inner.get(key) || {
          cliente: clienteNome || '—',
          cnpj: clienteCnpj || '',
          num_registros: 0,
          total: 0,
          order_total: 0,
        }
      prev.num_registros += 1
      prev.total = Number((prev.total + amount).toFixed(2))
      prev.order_total = Number((prev.order_total + orderAmount).toFixed(2))
      inner.set(key, prev)
    }

    for (const order of orders) {
      const total = Number(order.total || 0)
      if (!(total > 0)) continue
      const orderVendor = (order.id_vendedor_externo || '').trim()
      const clientVendor = (order.cliente_rel?.id_vendedor_externo || order.client_vendor_externo || '').trim()
      if (!orderVendor && !clientVendor) continue

      const clienteNome = order.cliente_rel?.nome ?? order.cliente ?? '—'
      const clienteCnpj = order.cliente_rel?.cpf_cnpj ?? order.cnpj ?? ''

      if (orderVendor && clientVendor && orderVendor === clientVendor) {
        addGroup(
          vendedorMap,
          vendedorByClient,
          orderVendor,
          Number(((total * 5) / 100).toFixed(2)),
          total,
          clienteNome,
          clienteCnpj,
        )
        continue
      }

      if (orderVendor) {
        addGroup(
          televendasMap,
          televendasByClient,
          orderVendor,
          Number(((total * 1) / 100).toFixed(2)),
          total,
          clienteNome,
          clienteCnpj,
        )
      }

      if (clientVendor) {
        addGroup(
          vendedorMap,
          vendedorByClient,
          clientVendor,
          Number(((total * 4) / 100).toFixed(2)),
          total,
          clienteNome,
          clienteCnpj,
        )
      }
    }

    type GroupedWithClients = Grouped & { por_cliente: ClientBreakdown[] }

    function finalizeGroups(
      map: Map<string, Grouped>,
      byClient: Map<string, Map<string, ClientBreakdown>>,
    ): GroupedWithClients[] {
      return Array.from(map.values())
        .map((g) => {
          const clients = Array.from((byClient.get(g.externo) || new Map()).values()).sort((a, b) => b.total - a.total)
          return { ...g, por_cliente: clients }
        })
        .sort((a, b) => b.total - a.total)
    }

    async function groupByRole(role: 'VENDEDOR' | 'TELEVENDAS'): Promise<GroupedWithClients[]> {
      const map = role === 'VENDEDOR' ? vendedorMap : televendasMap
      const byClient = role === 'VENDEDOR' ? vendedorByClient : televendasByClient
      return finalizeGroups(map, byClient)
    }

    if (roleParam === 'VENDEDOR') {
      const data = await groupByRole('VENDEDOR')
      return NextResponse.json({ ok: true, data })
    }
    if (roleParam === 'TELEVENDAS') {
      const data = await groupByRole('TELEVENDAS')
      return NextResponse.json({ ok: true, data })
    }

    // No role: return both sections
    const [vendedores, televendas] = await Promise.all([groupByRole('VENDEDOR'), groupByRole('TELEVENDAS')])

    return NextResponse.json({ ok: true, vendedores, televendas })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao gerar relatório' }, { status: 500 })
  }
}


