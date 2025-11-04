import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const vendedorExterno = searchParams.get('vendedor_externo')?.toString() || null

    const rows = await prisma.cliente.findMany({
      where: vendedorExterno ? { id_vendedor_externo: vendedorExterno } : undefined,
      orderBy: { nome: 'asc' },
      include: { vendedor: true },
      take: 1000,
    })

    // BigInt -> string for JSON safety
    const clientes = rows.map((c: any) => ({ ...c, external_id: c.external_id?.toString?.() ?? null }))

    return NextResponse.json({ ok: true, data: clientes })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar clientes' }, { status: 500 })
  }
}


