import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(_: Request, { params }: { params: { numero: string } }) {
  try {
    const session = await getServerSession(options as any)
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userId = BigInt(session.user.id)
    const numero = Number(params?.numero || 0)
    if (!numero) return NextResponse.json({ ok: false, error: 'Número inválido' }, { status: 400 })

    const row = await prisma.platform_order.findUnique({ where: { numero } })
    if (!row || row.user_id !== userId) {
      return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
    }

    const data = {
      numero: row.numero,
      data: row.data.toISOString().slice(0, 10),
      cliente: row.cliente,
      cnpj: row.cnpj,
      total: Number(row.total),
      status:
        row.status === 'PENDENTE'
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


