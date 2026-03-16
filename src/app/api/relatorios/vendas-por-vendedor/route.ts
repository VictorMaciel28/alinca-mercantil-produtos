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

    type Grouped = { externo: string; nome: string | null; num_registros: number; total: number }
    const vendedorMap = new Map<string, Grouped>()
    const televendasMap = new Map<string, Grouped>()

    const addGroup = (
      map: Map<string, Grouped>,
      externo: string,
      amount: number
    ) => {
      if (!externo) return
      if (vendorExterno && externo !== vendorExterno) return
      const current =
        map.get(externo) || {
          externo,
          nome: nameByExt.get(externo) || null,
          num_registros: 0,
          total: 0,
        }
      current.num_registros += 1
      current.total = Number((current.total + amount).toFixed(2))
      map.set(externo, current)
    }

    for (const order of orders) {
      const total = Number(order.total || 0)
      if (!(total > 0)) continue
      const orderVendor = (order.id_vendedor_externo || '').trim()
      const clientVendor = (order.cliente_rel?.id_vendedor_externo || order.client_vendor_externo || '').trim()
      if (!orderVendor && !clientVendor) continue

      if (orderVendor && clientVendor && orderVendor === clientVendor) {
        addGroup(vendedorMap, orderVendor, Number(((total * 5) / 100).toFixed(2)))
        continue
      }

      if (orderVendor) {
        addGroup(televendasMap, orderVendor, Number(((total * 1) / 100).toFixed(2)))
      }

      if (clientVendor) {
        addGroup(vendedorMap, clientVendor, Number(((total * 4) / 100).toFixed(2)))
      }
    }

    async function groupByRole(
      role: 'VENDEDOR' | 'TELEVENDAS'
    ): Promise<{ externo: string; nome: string | null; num_registros: number; total: number }[]> {
      const map = role === 'VENDEDOR' ? vendedorMap : televendasMap
      return Array.from(map.values()).sort((a, b) => b.total - a.total)
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


