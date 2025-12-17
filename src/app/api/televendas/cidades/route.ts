import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const fromClients = await prisma.cliente.findMany({
      where: { cidade: { not: null } },
      select: { cidade: true },
      distinct: ['cidade'],
      orderBy: { cidade: 'asc' },
    })

    const fromLinks = await prisma.telemarketing_city.findMany({
      select: { cidade: true },
      distinct: ['cidade'],
      orderBy: { cidade: 'asc' },
    })

    const set = new Set<string>()
    for (const r of fromClients) if (r.cidade) set.add(r.cidade)
    for (const r of fromLinks) if (r.cidade) set.add(r.cidade)

    const data = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar cidades' }, { status: 500 })
  }
}
