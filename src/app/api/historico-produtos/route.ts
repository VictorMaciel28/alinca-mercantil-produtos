import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/historico-produtos?cliente=Nome%20do%20Cliente
// Optional filters: sku, limit (default 100)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const cliente = url.searchParams.get('cliente')?.trim() || ''
    const sku = url.searchParams.get('sku')?.trim() || ''
    const limitParam = Number(url.searchParams.get('limit') || 100)
    const take = Math.min(Math.max(limitParam, 1), 500)

    if (!cliente) {
      return NextResponse.json({ erro: 'Parâmetro cliente é obrigatório' }, { status: 400 })
    }

    const where: any = {
      tiny_orders: {
        cliente_nome: cliente,
      },
    }

    if (sku) {
      where.codigo = sku
    }

    const rows = await prisma.tiny_order_products.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        pedido_id: true,
        produto_id: true,
        codigo: true,
        nome: true,
        categoria: true,
        preco: true,
        preco_custo: true,
        quantidade: true,
        created_at: true,
        tiny_orders: {
          select: {
            cliente_nome: true,
            numero_pedido: true,
          },
        },
      },
    })

    // Normalize BigInt/Decimal for JSON
    const items = rows.map((r: any) => ({
      id: r.id,
      pedido_id: r.pedido_id != null ? String(r.pedido_id) : null,
      produto_id: r.produto_id != null ? String(r.produto_id) : null,
      codigo: r.codigo ?? null,
      nome: r.nome ?? null,
      categoria: r.categoria ?? null,
      preco: r.preco != null ? Number(r.preco) : null,
      preco_custo: r.preco_custo != null ? Number(r.preco_custo) : null,
      quantidade: r.quantidade != null ? Number(r.quantidade) : 0,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      tiny_orders: r.tiny_orders
        ? {
            cliente_nome: r.tiny_orders.cliente_nome ?? null,
            numero_pedido: r.tiny_orders.numero_pedido ?? null,
          }
        : null,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Erro ao buscar histórico de produtos:', error)
    return NextResponse.json({ erro: 'Falha ao buscar histórico de produtos' }, { status: 500 })
  }
}


