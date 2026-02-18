import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(_: Request, { params }: { params: { numero: string } }) {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve vendedor id for this session and detect admin
    const userEmail = session.user.email || null
    let vendedorId: number | null = null
    let isAdmin = false
    let vendRecord = null
    if (userEmail) {
      vendRecord = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vendRecord?.id ?? null
      if (vendRecord?.id_vendedor_externo) {
        const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: vendRecord.id_vendedor_externo } }).catch(() => null)
        if (nivel?.nivel === 'ADMINISTRADOR') isAdmin = true
      }
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }
    const numero = Number(params?.numero || 0)
    if (!numero) return NextResponse.json({ ok: false, error: 'Número inválido' }, { status: 400 })

    const row = await prisma.platform_order.findUnique({ where: { numero } })
    if (!row || (!isAdmin && row.vendedor_id !== vendedorId)) {
      return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
    }

    const data = {
      numero: row.numero,
      data: row.data.toISOString().slice(0, 10),
      cliente: row.cliente,
      cnpj: row.cnpj,
      total: Number(row.total),
      status:
      (row.status as any) === 'PROPOSTA'
        ? 'Proposta'
        : row.status === 'PENDENTE'
        ? 'Pendente'
        : row.status === 'PAGO'
        ? 'Pago'
        : row.status === 'CANCELADO'
        ? 'Cancelado'
        : row.status === 'FATURADO'
        ? 'Faturado'
        : row.status === 'EM_ABERTO'
        ? 'Em aberto'
        : 'Entregue',
      id_vendedor_externo: row.id_vendedor_externo,
    }

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao buscar pedido' }, { status: 500 })
  }
}


