import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(_: Request, { params }: { params: { numero: string } }) {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve external vendor id for this session and detect admin
    const userEmail = session.user.email || null
    let vendedorExterno: string | null = null
    let isAdmin = false
    let vendRecord = null
    if (userEmail) {
      vendRecord = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorExterno = vendRecord?.id_vendedor_externo ?? null
      if (vendRecord?.id_vendedor_externo) {
        const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: vendRecord.id_vendedor_externo } }).catch(() => null)
        if (nivel?.nivel === 'ADMINISTRADOR') isAdmin = true
      }
    }
    const numero = Number(params?.numero || 0)
    if (!numero) return NextResponse.json({ ok: false, error: 'Número inválido' }, { status: 400 })

    const row = await prisma.platform_order.findUnique({
      where: { numero },
      include: {
        cliente_rel: true,
        products: {
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!row || (!isAdmin && row.id_vendedor_externo !== vendedorExterno)) {
      return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
    }

    let selectedVendedor: any = null
    if (row.id_vendedor_externo) {
      const vend = await prisma.vendedor.findFirst({
        where: { id_vendedor_externo: row.id_vendedor_externo },
        select: { id_vendedor_externo: true, nome: true },
      })
      const tipo = await prisma.vendedor_tipo_acesso
        .findUnique({
          where: { id_vendedor_externo: row.id_vendedor_externo },
          select: { tipo: true },
        })
        .catch(() => null)

      selectedVendedor = {
        id_vendedor_externo: row.id_vendedor_externo,
        nome: vend?.nome ?? null,
        tipo: tipo?.tipo ?? null,
      }
    }

    const data = {
      numero: row.numero,
      data: row.data.toISOString().slice(0, 10),
      cliente: row.cliente,
      cnpj: row.cnpj,
      id_client_externo: row.id_client_externo?.toString?.() ?? null,
      total: Number(row.total),
      forma_recebimento: row.forma_recebimento,
      condicao_pagamento: row.condicao_pagamento,
      endereco_entrega: row.endereco_entrega,
      selected_vendedor: selectedVendedor,
      selected_client: row.cliente_rel
        ? {
            id: row.cliente_rel.id,
            external_id: row.cliente_rel.external_id?.toString?.() ?? null,
            nome: row.cliente_rel.nome,
            cpf_cnpj: row.cliente_rel.cpf_cnpj ?? '',
            id_vendedor_externo: row.cliente_rel.id_vendedor_externo ?? null,
            nome_vendedor: row.cliente_rel.nome_vendedor ?? null,
            cidade: row.cliente_rel.cidade ?? null,
            endereco: row.cliente_rel.endereco ?? null,
            numero: row.cliente_rel.numero ?? null,
            complemento: row.cliente_rel.complemento ?? null,
            bairro: row.cliente_rel.bairro ?? null,
            cep: row.cliente_rel.cep ?? null,
            uf: row.cliente_rel.uf ?? null,
            email: row.cliente_rel.email ?? null,
          }
        : null,
      itens: (row.products || []).map((p: any) => ({
        produtoId: p.produto_id ?? null,
        codigo: p.codigo ?? undefined,
        nome: p.nome,
        quantidade: Number(p.quantidade || 0),
        unidade: p.unidade || 'UN',
        preco: Number(p.preco || 0),
      })),
      status:
      (row.status as any) === 'PROPOSTA'
        ? 'Proposta'
        : row.status === 'APROVADO'
        ? 'Aprovado'
        : row.status === 'PENDENTE'
        ? 'Pendente'
        : row.status === 'CANCELADO'
        ? 'Cancelado'
        : row.status === 'FATURADO'
        ? 'Faturado'
        : row.status === 'ENVIADO'
        ? 'Enviado'
        : row.status === 'DADOS_INCOMPLETOS'
        ? 'Dados incompletos'
        : 'Entregue',
      id_vendedor_externo: row.id_vendedor_externo,
    }

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao buscar pedido' }, { status: 500 })
  }
}


