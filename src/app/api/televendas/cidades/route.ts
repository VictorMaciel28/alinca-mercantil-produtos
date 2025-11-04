import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.cliente.findMany({
      where: { cidade: { not: null }, NOT: { cidade: '' } },
      distinct: ['cidade'],
      select: { cidade: true },
      orderBy: { cidade: 'asc' },
      take: 2000,
    })
    const cidades = rows.map((r) => r.cidade!)
    return NextResponse.json({ ok: true, data: cidades })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar cidades' }, { status: 500 })
  }
}



