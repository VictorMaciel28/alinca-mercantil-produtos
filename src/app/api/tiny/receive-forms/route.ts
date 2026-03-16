import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.tiny_receive_form.findMany({
      where: { situacao: 1 },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({
      ok: true,
      data: rows.map((r) => ({
        id: Number(r.tiny_id),
        nome: r.nome,
        situacao: r.situacao,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Erro ao listar formas de recebimento' },
      { status: 500 }
    )
  }
}
