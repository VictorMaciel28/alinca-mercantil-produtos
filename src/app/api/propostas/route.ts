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

    // Include products for each proposal (if any)
    const data = await Promise.all(
      rows.map(async (r) => {
        const products = await prisma.platform_order_product.findMany({ where: { order_num: r.numero } })
        return {
          numero: r.numero,
          data: r.data.toISOString().slice(0, 10),
          cliente: r.cliente,
          cnpj: r.cnpj,
          total: Number(r.total),
          status: 'Proposta',
          id_vendedor_externo: r.id_vendedor_externo,
          itens: products.map((p) => ({
            produtoId: p.produto_id,
            codigo: p.codigo,
            nome: p.nome,
            quantidade: Number(p.quantidade),
            unidade: p.unidade,
            preco: Number(p.preco),
          })),
        }
      })
    )

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
    // Accept cliente sent either as string or as an object { nome, cpf_cnpj }.
    let cliente = ''
    let cnpj = ''
    if (body?.cliente && typeof body.cliente === 'object') {
      cliente = (body.cliente?.nome || '').toString().trim()
      cnpj = (body.cliente?.cpf_cnpj || body.cliente?.cnpj || body?.cnpj || '').toString().trim()
    } else {
      cliente = (body?.cliente || '').toString().trim()
      cnpj = (body?.cnpj || '').toString().trim()
    }
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

    // Persist any provided items linked to this proposal (do not send to Tiny here)
    try {
      const itens = Array.isArray(body?.itens) ? body.itens : []
      if (itens.length > 0) {
        const toCreate = itens.map((it: any) => ({
          order_num: created.numero,
          produto_id: it.produtoId != null ? Number(it.produtoId) : null,
          codigo: it.codigo || (it.sku || null),
          nome: it.nome || it.descricao || '',
          quantidade: typeof it.quantidade === 'number' ? it.quantidade : Number(it.quantidade || 0),
          unidade: it.unidade || 'UN',
          preco: typeof it.preco === 'number' ? it.preco : Number(it.preco || 0),
        }))
        await prisma.platform_order_product.createMany({ data: toCreate })
      }
    } catch (e) {
      // ignore product persistence errors to avoid blocking proposal creation
      console.error('Failed saving proposal items', e)
    }

    return NextResponse.json({ ok: true, numero: created.numero })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar proposta' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const numero = Number(url.searchParams.get('id') || 0)
    if (!numero) return NextResponse.json({ ok: false, error: 'Número obrigatório' }, { status: 400 })

    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // resolve vendedor/admin
    const userEmail = session.user.email || null
    let vendedorId: number | null = null
    let isAdmin = false
    if (userEmail) {
      const vend = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vend?.id ?? null
      if (vend?.id_vendedor_externo) {
        const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: vend.id_vendedor_externo } }).catch(() => null)
        if (nivel?.nivel === 'ADMINISTRADOR') isAdmin = true
      }
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }
    if (!vendedorId && !isAdmin) return NextResponse.json({ ok: false, error: 'Usuário sem permissão' }, { status: 403 })

    const row = await prisma.platform_order.findUnique({ where: { numero } })
    if (!row || row.status !== ('PROPOSTA' as any)) return NextResponse.json({ ok: false, error: 'Proposta não encontrada' }, { status: 404 })
    if (!isAdmin && row.vendedor_id !== vendedorId) return NextResponse.json({ ok: false, error: 'Proposta não encontrada' }, { status: 404 })

    await prisma.platform_order.delete({ where: { numero } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao deletar proposta' }, { status: 500 })
  }
}
