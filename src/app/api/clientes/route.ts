import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const vendedorExternoParam = searchParams.get('vendedor_externo')?.toString() || null
    const q = (searchParams.get('q') || '').toString().trim()

    // Decide filter by session role if no explicit vendedor_externo is provided
    let where: any = undefined
    if (vendedorExternoParam) {
      where = { id_vendedor_externo: vendedorExternoParam }
    } else {
      const session = await getServerSession(options as any)
      const userEmail = session?.user?.email || null
      if (userEmail) {
        const vend = await prisma.vendedor.findFirst({ where: { email: userEmail } })
        const externo = vend?.id_vendedor_externo || null
        if (externo) {
          const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: externo } })
          // Supervisores/Administradores veem todos os clientes
          if (nivel?.nivel === 'ADMINISTRADOR' || nivel?.nivel === 'SUPERVISOR') {
            where = undefined
          } else {
            const tipo = await prisma.vendedor_tipo_acesso.findUnique({ where: { id_vendedor_externo: externo } })
            if (tipo?.tipo === 'TELEVENDAS') {
              // Filter by cities linked to this telemarketing external id
              const tel = await prisma.telemarketing.findUnique({
                where: { id_vendedor_externo: externo },
                include: { cidades: true },
              })
              const cities = (tel?.cidades || []).map((c) => c.cidade)
              where = cities.length > 0 ? { cidade: { in: cities } } : { id: -1 } // none
            } else {
              // Default to VENDEDOR rule (also when no mapping)
              where = { id_vendedor_externo: externo }
            }
          }
        }
      }
    }

    // Apply name search if provided
    if (q) {
      // First try Tiny contatos.pesquisa (live search) when query provided and token exists
      try {
        const token = process.env.TINY_API_TOKEN
        if (token) {
          const tinyRes = await fetch(`https://api.tiny.com.br/api2/contatos.pesquisa.php?token=${encodeURIComponent(token)}&pesquisa=${encodeURIComponent(q)}&formato=json`)
          const tinyJson = await tinyRes.json().catch(() => null)
          const contatos = tinyJson?.retorno?.contatos || []
          if (Array.isArray(contatos) && contatos.length > 0) {
            const clientesFromTiny = contatos.map((entry: any) => {
              const c = entry?.contato || {}
              return {
                id: Number(c.id || 0),
                nome: c.nome || '',
                cpf_cnpj: c.cpf_cnpj || '',
                id_vendedor_externo: c.id_vendedor || null,
                nome_vendedor: c.nome_vendedor || null,
                cidade: c.cidade || null,
                endereco: c.endereco || null,
                bairro: c.bairro || null,
                cep: c.cep || null,
                uf: c.uf || null,
                fone: c.fone || null,
              }
            }).filter((c: any) => !!c.nome)
            return NextResponse.json({ ok: true, data: clientesFromTiny })
          }
        }
      } catch (e) {
        // ignore tiny errors and fallback to DB search below
      }
      // fallback to DB search
      where = { ...(where || {}), nome: { contains: q } }
    }

    const rows = await prisma.cliente.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { vendedor: true },
      take: 200,
    })

    // BigInt -> string for JSON safety
    const clientes = rows.map((c: any) => ({ ...c, external_id: c.external_id?.toString?.() ?? null }))

    return NextResponse.json({ ok: true, data: clientes })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar clientes' }, { status: 500 })
  }
}


