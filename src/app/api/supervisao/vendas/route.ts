import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(options as any)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ ok: true, data: [], vendors: [] })

    const me = await prisma.vendedor.findFirst({ where: { email } })
    const myExterno = me?.id_vendedor_externo || null
    if (!myExterno) return NextResponse.json({ ok: true, data: [], vendors: [] })

    const sup = await prisma.supervisor.findUnique({
      where: { id_vendedor_externo: myExterno },
      include: { links: true },
    })
    if (!sup) return NextResponse.json({ ok: true, data: [], vendors: [] })

    const externos = sup.links.map((l) => l.vendedor_externo).filter(Boolean)
    if (externos.length === 0) return NextResponse.json({ ok: true, data: [], vendors: [] })

    const { searchParams } = new URL(req.url)
    const vendFilter = (searchParams.get('vendedor_externo') || '').toString().trim()
    const startStr = (searchParams.get('start') || '').toString().slice(0, 10)
    const endStr = (searchParams.get('end') || '').toString().slice(0, 10)

    const where: any = {}
    if (vendFilter) {
      // allow filtering by vendedor_externo or numeric vendedor id
      const maybeNum = Number(vendFilter)
      if (!Number.isNaN(maybeNum)) {
        where.vendedor_id = maybeNum
      } else {
        where.id_vendedor_externo = vendFilter
      }
    } else {
      // default to externals list
      where.OR = [{ id_vendedor_externo: { in: externos } }, { vendedor_id: { in: await prisma.vendedor.findMany({ where: { id_vendedor_externo: { in: externos } }, select: { id: true } }).then(rs => rs.map(r => r.id)) } }]
    }
    if (startStr || endStr) {
      where.data = {}
      if (startStr) where.data.gte = new Date(startStr + 'T00:00:00.000Z')
      if (endStr) where.data.lte = new Date(endStr + 'T23:59:59.999Z')
    }

    const orders = await prisma.platform_order.findMany({
      where,
      orderBy: { data: 'desc' },
    })

    const vendRows = await prisma.vendedor.findMany({
      where: { id_vendedor_externo: { in: externos } },
      select: { id_vendedor_externo: true, nome: true },
      orderBy: { nome: 'asc' },
    })
    const vendNameByExt = new Map(vendRows.map((v) => [v.id_vendedor_externo!, v.nome]))

    const data = orders.map((o) => ({
      numero: o.numero,
      data: o.data.toISOString().slice(0, 10),
      cliente: o.cliente,
      cnpj: o.cnpj,
      total: Number(o.total),
      vendedor_externo: o.id_vendedor_externo,
      vendedor_nome: o.id_vendedor_externo ? vendNameByExt.get(o.id_vendedor_externo) || null : null,
      status: o.status,
    }))

    const vendors = vendRows.map((v) => ({ externo: v.id_vendedor_externo!, nome: v.nome }))

    return NextResponse.json({ ok: true, data, vendors })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar vendas supervisionadas' }, { status: 500 })
  }
}

