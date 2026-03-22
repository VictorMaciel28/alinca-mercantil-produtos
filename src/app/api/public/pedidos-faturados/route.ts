import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/prisma';

const prisma = new PrismaClient();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendedorExterno = (searchParams.get('vendedor_externo') || '').trim() || null;
    const limitRaw = Number(searchParams.get('limit') || '25');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const where: { status: 'FATURADO'; id_vendedor_externo?: string } = {
      status: 'FATURADO',
    };
    if (vendedorExterno) {
      where.id_vendedor_externo = vendedorExterno;
    }

    const orders = await prisma.platform_order.findMany({
      where,
      take: limit,
      orderBy: { updated_at: 'desc' },
      select: {
        numero: true,
        cliente: true,
        cnpj: true,
        total: true,
        id_vendedor_externo: true,
        tiny_id: true,
      },
    });

    const vendorIds = Array.from(new Set(orders.map((o) => o.id_vendedor_externo).filter(Boolean))) as string[];
    const vendors = vendorIds.length
      ? await prisma.vendedor.findMany({
          where: { id_vendedor_externo: { in: vendorIds } },
          select: { id_vendedor_externo: true, nome: true },
        })
      : [];
    const vendorNameByExternal = new Map(vendors.map((v) => [v.id_vendedor_externo, v.nome]));

    const faturadoDates = await Promise.all(
      orders.map(async (order) => {
        if (!order.tiny_id) return null;
        const row = await prisma.platform_order_status_history.findFirst({
          where: { tiny_id: order.tiny_id, status: 'FATURADO' },
          orderBy: { changed_at: 'desc' },
          select: { changed_at: true },
        });
        return row?.changed_at ?? null;
      })
    );

    const data = orders.map((order, index) => ({
      numero: order.numero,
      cliente: order.cliente,
      cnpj: order.cnpj,
      vendedor: order.id_vendedor_externo ? vendorNameByExternal.get(order.id_vendedor_externo) || null : null,
      valor: Number(order.total),
      faturado_em: faturadoDates[index],
    }));

    return NextResponse.json({ ok: true, data }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Erro ao carregar pedidos' }, { status: 500, headers: corsHeaders });
  }
}
