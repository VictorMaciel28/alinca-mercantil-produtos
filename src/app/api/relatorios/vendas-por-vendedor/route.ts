import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const roleParam = (searchParams.get('role') || '').toString().trim().toUpperCase()
    const vendorExterno = (searchParams.get('vendor_externo') || '').toString().trim()
    const startStr = (searchParams.get('start') || '').toString().slice(0, 10)
    const endStr = (searchParams.get('end') || '').toString().slice(0, 10)

    const whereBase: any = {}
    if (startStr || endStr) {
      whereBase.created_at = {}
      if (startStr) whereBase.created_at.gte = new Date(startStr + 'T00:00:00.000Z')
      if (endStr) whereBase.created_at.lte = new Date(endStr + 'T23:59:59.999Z')
    }

    async function groupByRole(
      role: 'VENDEDOR' | 'TELEVENDAS'
    ): Promise<{ externo: string; nome: string | null; num_registros: number; total: number }[]> {
      const where: any = { ...whereBase, role }
      if (vendorExterno) where.beneficiary_externo = vendorExterno

      const groups = await prisma.platform_commission.groupBy({
        by: ['beneficiary_externo'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      })

      const externos = groups.map((g) => g.beneficiary_externo).filter((x): x is string => !!x)
      const vendNames =
        externos.length > 0
          ? await prisma.vendedor.findMany({
              where: { id_vendedor_externo: { in: externos } },
              select: { id_vendedor_externo: true, nome: true },
            })
          : []
      const nameByExt = new Map(vendNames.map((v) => [v.id_vendedor_externo!, v.nome]))

      return groups
        .filter((g) => !!g.beneficiary_externo)
        .map((g) => ({
          externo: g.beneficiary_externo as string,
          nome: nameByExt.get(g.beneficiary_externo as string) || null,
          num_registros: Number(g._count?._all || 0),
          total: Number(g._sum?.amount || 0),
        }))
        .sort((a, b) => b.total - a.total)
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


