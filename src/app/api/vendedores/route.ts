import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.vendedor.findMany({ orderBy: { nome: 'asc' } })

    const externos = Array.from(
      new Set(rows.map((r) => r.id_vendedor_externo).filter((x): x is string => !!x))
    )

    const tipos =
      externos.length > 0
        ? await prisma.vendedor_tipo_acesso.findMany({
            where: { id_vendedor_externo: { in: externos } },
          })
        : []

    const tipoByExterno = new Map(tipos.map((t) => [t.id_vendedor_externo, t.tipo]))

    const data = rows.map((r) => ({
      ...r,
      tipo_acesso: r.id_vendedor_externo ? tipoByExterno.get(r.id_vendedor_externo) ?? null : null,
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar vendedores' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id: number | null = typeof body?.id === 'number' ? body.id : Number(body?.id) || null
    const nome: string | undefined = body?.nome?.toString?.().trim?.() || undefined
    const email: string | null | undefined =
      body?.email === null
        ? null
        : body?.email?.toString?.().trim?.()
        ? body.email.toString().trim()
        : undefined
    const id_vendedor_externo: string | undefined =
      body?.id_vendedor_externo?.toString?.().trim?.() || undefined
    const tipo_acesso: 'VENDEDOR' | 'TELEVENDAS' | undefined =
      body?.tipo_acesso === 'VENDEDOR' || body?.tipo_acesso === 'TELEVENDAS' ? body.tipo_acesso : undefined

    if (!id && nome === undefined && email === undefined && tipo_acesso === undefined) {
      return NextResponse.json({ ok: false, error: 'Nada para atualizar' }, { status: 400 })
    }

    if (id) {
      await prisma.vendedor.update({
        where: { id },
        data: {
          nome: nome ?? undefined,
          email: email,
        },
      })
    }

    if (tipo_acesso && id_vendedor_externo) {
      await prisma.vendedor_tipo_acesso.upsert({
        where: { id_vendedor_externo },
        update: { tipo: tipo_acesso as any },
        create: { id_vendedor_externo, tipo: tipo_acesso as any },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar vendedor' }, { status: 500 })
  }
}



