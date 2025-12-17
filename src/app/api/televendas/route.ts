import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const teles = await prisma.telemarketing.findMany({
      orderBy: { nome: 'asc' },
      include: { cidades: true },
    })

    const data = teles.map((t) => ({
      id: t.id,
      id_vendedor_externo: t.id_vendedor_externo,
      nome: t.nome,
      cidades: (t.cidades || []).map((c) => c.cidade),
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar televendas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const vendedor_externo = (body?.vendedor_externo || '').toString().trim()
    const nome = (body?.nome || '').toString().trim() || null
    const cidades: string[] = Array.isArray(body?.cidades)
      ? body.cidades.map((c: any) => c?.toString?.().trim?.()).filter(Boolean)
      : []
    if (!vendedor_externo) return NextResponse.json({ ok: false, error: 'Telemarketing externo obrigatório' }, { status: 400 })
    if (cidades.length === 0) return NextResponse.json({ ok: false, error: 'Informe pelo menos uma cidade' }, { status: 400 })

    const tel = await prisma.telemarketing.upsert({
      where: { id_vendedor_externo: vendedor_externo },
      update: { nome: nome ?? undefined },
      create: { id_vendedor_externo: vendedor_externo, nome },
    })

    // replace cities
    await prisma.telemarketing_city.deleteMany({ where: { telemarketing_id: tel.id } })
    await prisma.telemarketing_city.createMany({
      data: Array.from(new Set(cidades)).map((cidade) => ({ telemarketing_id: tel.id, cidade })),
      skipDuplicates: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar televendas' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const id = Number(body?.id)
    if (!id || Number.isNaN(id)) return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 })
    await prisma.telemarketing.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao excluir televendas' }, { status: 500 })
  }
}



