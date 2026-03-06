import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.payment_condition.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ ok: true, data: rows })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar condições' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Support bulk operations: { create: [{name,percent}], update: [{id,name,percent}], delete: [id...] }
    const toCreate: Array<{ name: string; percent: number }> = Array.isArray(body?.create) ? body.create : []
    const toUpdate: Array<{ id: number; name?: string; percent?: number }> = Array.isArray(body?.update) ? body.update : []
    const toDelete: number[] = Array.isArray(body?.delete) ? body.delete.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n)) : []

    // Validate payload minimally
    for (const c of toCreate) {
      if (!c?.name || Number.isNaN(Number(c.percent))) return NextResponse.json({ ok: false, error: 'Payload inválido (create)' }, { status: 400 })
    }
    for (const u of toUpdate) {
      if (!u?.id || (u.name == null && u.percent == null)) return NextResponse.json({ ok: false, error: 'Payload inválido (update)' }, { status: 400 })
    }

    try {
      const results = await prisma.$transaction(async (tx) => {
        // deletes
        if (toDelete.length > 0) {
          await tx.payment_condition.deleteMany({ where: { id: { in: toDelete } } })
        }
        // updates
        const updates = await Promise.all(
          toUpdate.map((u) =>
            tx.payment_condition.update({
              where: { id: u.id },
              data: {
                name: u.name?.toString().slice(0, 100),
                percent: typeof u.percent === 'number' ? u.percent : undefined,
              },
            }).catch(() => null)
          )
        )
        // creates
        const creates = await Promise.all(
          toCreate.map((c) =>
            tx.payment_condition.create({
              data: {
                name: c.name.toString().slice(0, 100),
                percent: c.percent,
              },
            })
          )
        )

        // return current list
        const rows = await tx.payment_condition.findMany({ orderBy: { name: 'asc' } })
        return { updates, creates, rows }
      })

      return NextResponse.json({ ok: true, data: results.rows })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message ?? 'Erro na operação' }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao criar condição' }, { status: 500 })
  }
}

