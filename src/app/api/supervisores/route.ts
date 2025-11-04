import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supervisors = await prisma.supervisor.findMany({ orderBy: { nome: 'asc' } })
    const links = await prisma.supervisor_vendor_links.findMany({ where: { supervisor_id: { in: supervisors.map((s) => s.id) } } })

    // Optional: map vendor names by joining current vendedores
    const uniqueVendorExternals = Array.from(new Set(links.map((l) => l.vendedor_externo)))
    const vendedores = await prisma.vendedor.findMany({ where: { id_vendedor_externo: { in: uniqueVendorExternals } }, select: { id_vendedor_externo: true, nome: true } })
    const vendNameByExt = new Map(vendedores.map((v) => [v.id_vendedor_externo!, v.nome]))

    const data = supervisors.map((s) => {
      const myLinks = links.filter((l) => l.supervisor_id === s.id)
      return {
        ...s,
        supervised: myLinks.map((l) => ({ vendedor_externo: l.vendedor_externo, nome: vendNameByExt.get(l.vendedor_externo) || null })),
      }
    })

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar supervisores' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supervisor_externo = (body?.supervisor_externo || '').toString().trim()
    const supervisor_nome = (body?.supervisor_nome || '').toString().trim() || null
    const supervised: string[] = Array.isArray(body?.supervised) ? body.supervised.map((s: any) => s?.toString?.().trim()).filter(Boolean) : []

    if (!supervisor_externo) return NextResponse.json({ ok: false, error: 'Supervisor externo obrigatório' }, { status: 400 })

    const sup = await prisma.supervisor.upsert({
      where: { id_vendedor_externo: supervisor_externo },
      update: { nome: supervisor_nome ?? undefined },
      create: { id_vendedor_externo: supervisor_externo, nome: supervisor_nome },
    })

    // replace links
    await prisma.supervisor_vendor_links.deleteMany({ where: { supervisor_id: sup.id } })
    if (supervised.length > 0) {
      await prisma.supervisor_vendor_links.createMany({
        data: supervised.map((ext) => ({ supervisor_id: sup.id, vendedor_externo: ext })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar supervisor' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const id = Number(body?.id)
    if (!id || Number.isNaN(id)) return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 })

    await prisma.supervisor.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao deletar supervisor' }, { status: 500 })
  }
}


