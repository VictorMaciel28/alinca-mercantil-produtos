import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.telemarketing.findMany({ orderBy: { nome: 'asc' } })
    return NextResponse.json({ ok: true, data: rows })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar televendas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const vendedor_externo = (body?.vendedor_externo || '').toString().trim()
    const nome = (body?.nome || '').toString().trim() || null
    const cidade = (body?.cidade || '').toString().trim()
    if (!vendedor_externo) return NextResponse.json({ ok: false, error: 'Telemarketing externo obrigatório' }, { status: 400 })
    if (!cidade) return NextResponse.json({ ok: false, error: 'Cidade obrigatória' }, { status: 400 })

    await prisma.telemarketing.upsert({
      where: { id_vendedor_externo: vendedor_externo },
      update: { nome: nome ?? undefined, cidade },
      create: { id_vendedor_externo: vendedor_externo, nome, cidade },
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



