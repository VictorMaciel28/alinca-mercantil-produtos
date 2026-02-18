import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET() {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: true, data: [] })

    const userEmail = session.user.email || null
    // Resolve vendedor for this session user (prefer lookup by email). Fallback: numeric session.user.id if it looks like a vendedor id.
    let vendedorId: number | null = null
    let id_vendedor_externo: string | null = null
    let isAdmin = false
    if (userEmail) {
      const vendRecord = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vendRecord?.id ?? null
      id_vendedor_externo = vendRecord?.id_vendedor_externo ?? null
      if (vendRecord?.id_vendedor_externo) {
        const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: vendRecord.id_vendedor_externo } }).catch(() => null)
        if (nivel?.nivel === 'ADMINISTRADOR') isAdmin = true
      }
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }

    let rows
    if (isAdmin) {
      rows = await prisma.platform_order.findMany({ where: { status: 'PROPOSTA' as any }, orderBy: { created_at: 'desc' } })
    } else {
      if (!vendedorId) return NextResponse.json({ ok: true, data: [] })
      rows = await prisma.platform_order.findMany({
        where: {
          status: 'PROPOSTA' as any,
          OR: id_vendedor_externo ? [{ vendedor_id: vendedorId }, { id_vendedor_externo }] : [{ vendedor_id: vendedorId }],
        },
        orderBy: { created_at: 'desc' },
      })
    }

    const data = rows.map((r) => ({
      numero: r.numero,
      data: r.data.toISOString().slice(0, 10),
      cliente: r.cliente,
      cnpj: r.cnpj,
      total: Number(r.total),
      status: 'Proposta',
      id_vendedor_externo: r.id_vendedor_externo,
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar propostas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const userEmail = session.user.email || null
    // Resolve vendedor id for this session user
    let vendedorId: number | null = null
    if (userEmail) {
      const vend = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vend?.id ?? null
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }
    if (!vendedorId) return NextResponse.json({ ok: false, error: 'Usuário não é vendedor autenticado' }, { status: 401 })

    const body = await req.json()
    const dataStr = (body?.data || '').toString().slice(0, 10)
    const cliente = (body?.cliente || '').toString().trim()
    const cnpj = (body?.cnpj || '').toString().trim()
    const total = Number(body?.total || 0)
    const id_vendedor_externo =
      body?.id_vendedor_externo != null ? body.id_vendedor_externo?.toString?.().trim?.() || null : null
    const client_vendor_externo: string | null =
      body?.client_vendor_externo != null ? body.client_vendor_externo?.toString?.().trim?.() || null : null

    if (!cliente) return NextResponse.json({ ok: false, error: 'Cliente obrigatório' }, { status: 400 })

    const maxRow = await prisma.platform_order.findFirst({
      select: { numero: true },
      orderBy: { numero: 'desc' },
    })
    const nextNumero = (maxRow?.numero || 1000) + 1

    const created = await prisma.platform_order.create({
      data: {
        numero: nextNumero,
        data: dataStr ? new Date(dataStr) : new Date(),
        cliente,
        cnpj,
        total,
        status: 'PROPOSTA' as any,
        id_vendedor_externo: id_vendedor_externo,
        client_vendor_externo: client_vendor_externo,
        vendedor_id: vendedorId,
      },
    })

    return NextResponse.json({ ok: true, numero: created.numero })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar proposta' }, { status: 500 })
  }
}
