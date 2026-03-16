import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tinyV3Fetch } from '@/lib/tinyOAuth'

function onlyDigits(v: string | null | undefined) {
  return (v || '').replace(/\D/g, '')
}

function mapStatusLabel(status: string | null | undefined) {
  const s = String(status || '').toUpperCase()
  if (s === 'PENDENTE') return 'Pendente'
  if (s === 'APROVADO') return 'Aprovado'
  if (s === 'FATURADO') return 'Faturado'
  if (s === 'ENVIADO') return 'Enviado'
  if (s === 'ENTREGUE') return 'Entregue'
  if (s === 'CANCELADO') return 'Cancelado'
  if (s === 'DADOS_INCOMPLETOS') return 'Dados incompletos'
  if (s === 'PROPOSTA') return 'Proposta'
  return s || 'Pendente'
}

function buildEnderecoEntrega(tinyPedido: any) {
  if (tinyPedido?.enderecoEntrega) {
    return {
      endereco: tinyPedido.enderecoEntrega?.endereco || '',
      numero: tinyPedido.enderecoEntrega?.numero || '',
      complemento: tinyPedido.enderecoEntrega?.complemento || '',
      bairro: tinyPedido.enderecoEntrega?.bairro || '',
      cep: tinyPedido.enderecoEntrega?.cep || '',
      cidade: tinyPedido.enderecoEntrega?.municipio || '',
      uf: tinyPedido.enderecoEntrega?.uf || '',
      endereco_diferente: true,
    }
  }

  if (tinyPedido?.cliente?.endereco) {
    return {
      endereco: tinyPedido.cliente.endereco?.endereco || '',
      numero: tinyPedido.cliente.endereco?.numero || '',
      complemento: tinyPedido.cliente.endereco?.complemento || '',
      bairro: tinyPedido.cliente.endereco?.bairro || '',
      cep: tinyPedido.cliente.endereco?.cep || '',
      cidade: tinyPedido.cliente.endereco?.municipio || '',
      uf: tinyPedido.cliente.endereco?.uf || '',
      endereco_diferente: false,
    }
  }

  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const numero = Number(body?.numero || 0)
    const cnpj = onlyDigits(String(body?.cnpj || ''))
    if (!numero || !cnpj) {
      return NextResponse.json({ ok: false, error: 'numero_e_cnpj_obrigatorios' }, { status: 400 })
    }

    const row = await prisma.platform_order.findUnique({
      where: { numero },
      include: { cliente_rel: true },
    })
    if (!row) return NextResponse.json({ ok: false, error: 'pedido_nao_encontrado' }, { status: 404 })

    const orderCnpjDigits = onlyDigits(row.cnpj)
    if (!orderCnpjDigits || orderCnpjDigits !== cnpj) {
      return NextResponse.json({ ok: false, error: 'pedido_nao_encontrado' }, { status: 404 })
    }

    const status = String(row.status || '').toUpperCase()
    if (status === 'PROPOSTA' || status === 'CANCELADO' || status === 'DADOS_INCOMPLETOS') {
      return NextResponse.json(
        { ok: false, error: 'status_nao_rastreavel', status: mapStatusLabel(status) },
        { status: 400 }
      )
    }

    let tinyPedido: any = null
    const shouldFetchTiny =
      !!row.tiny_id &&
      (!row.id_nota_fiscal || !row.endereco_entrega)
    if (shouldFetchTiny) {
      try {
        const tinyRes = await tinyV3Fetch(`/pedidos/${row.tiny_id}`, { method: 'GET' })
        const tinyJson = await tinyRes.json().catch(() => null)
        const rootHasId = !!tinyJson && typeof tinyJson === 'object' && Number((tinyJson as any)?.id || 0) > 0
        tinyPedido = rootHasId
          ? tinyJson
          : tinyJson?.item || tinyJson?.pedido || tinyJson?.data || tinyJson?.retorno?.pedido || tinyJson

        const idNotaFromTiny = Number(tinyPedido?.idNotaFiscal || 0)
        const enderecoFromTiny = buildEnderecoEntrega(tinyPedido)
        const updateData: any = {}
        if (!row.id_nota_fiscal && idNotaFromTiny > 0) {
          updateData.id_nota_fiscal = String(idNotaFromTiny)
        }
        if (!row.endereco_entrega && enderecoFromTiny) {
          updateData.endereco_entrega = enderecoFromTiny
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.platform_order.update({
            where: { id: row.id },
            data: updateData,
          })
        }

        const itens = Array.isArray(tinyPedido?.itens) ? tinyPedido.itens : []
        if (row.tiny_id && itens.length > 0) {
          await prisma.platform_order_product.deleteMany({ where: { tiny_id: row.tiny_id } as any })
          await prisma.platform_order_product.createMany({
            data: itens.map((it: any) => ({
              tiny_id: row.tiny_id,
              produto_id: it?.produto?.id != null ? Number(it.produto.id) : null,
              codigo: it?.produto?.sku ? String(it.produto.sku) : null,
              nome: String(it?.produto?.descricao || 'Produto'),
              preco: Number(it?.valorUnitario || 0),
              quantidade: Number(it?.quantidade || 0),
              unidade: 'UN',
            })) as any,
          })
        }
      } catch {
        // keep endpoint resilient; fallback to local data
      }
    }

    const produtosFromDb = row.tiny_id
      ? await prisma.platform_order_product.findMany({
          where: { tiny_id: row.tiny_id } as any,
          orderBy: { id: 'asc' },
        })
      : []

    const produtos = Array.isArray(tinyPedido?.itens)
      ? tinyPedido.itens.map((it: any) => ({
          nome: String(it?.produto?.descricao || 'Produto'),
          codigo: it?.produto?.sku ? String(it.produto.sku) : null,
          quantidade: Number(it?.quantidade || 0),
          unidade: 'UN',
          valor_unitario: Number(it?.valorUnitario || 0),
        }))
      : produtosFromDb.map((p: any) => ({
          nome: String(p.nome || 'Produto'),
          codigo: p.codigo || null,
          quantidade: Number(p.quantidade || 0),
          unidade: p.unidade || 'UN',
          valor_unitario: Number(p.preco || 0),
        }))

    const parcelas = Array.isArray(tinyPedido?.pagamento?.parcelas)
      ? tinyPedido.pagamento.parcelas.map((p: any) => ({
          dias: Number(p?.dias || 0),
          data: String(p?.data || '').slice(0, 10),
          valor: Number(p?.valor || 0),
        }))
      : []

    const endereco = buildEnderecoEntrega(tinyPedido) || (row.endereco_entrega as any) || null

    let vendedorNome: string | null = null
    if (row.id_vendedor_externo) {
      const vend = await prisma.vendedor.findFirst({
        where: { id_vendedor_externo: row.id_vendedor_externo },
        select: { nome: true },
      })
      vendedorNome = vend?.nome || null
    }

    return NextResponse.json({
      ok: true,
      data: {
        numero: row.numero,
        status: status,
        status_label: mapStatusLabel(status),
        id_nota_fiscal: row.id_nota_fiscal || (tinyPedido?.idNotaFiscal ? String(tinyPedido.idNotaFiscal) : null),
        cliente: row.cliente,
        cnpj: row.cnpj,
        vendedor: vendedorNome || row.id_vendedor_externo || '-',
        produtos,
        parcelas,
        endereco_entrega: endereco,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'erro_inesperado' }, { status: 500 })
  }
}

