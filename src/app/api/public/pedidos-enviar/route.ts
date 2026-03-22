import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/prisma';
import { tinyV3Fetch } from '@/lib/tinyOAuth';

const prisma = new PrismaClient();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { numeros?: number[]; motorista_id?: number };
    const numeros = Array.isArray(body?.numeros) ? body.numeros.filter((n) => Number.isFinite(n)) : [];
    const motoristaId = Number(body?.motorista_id || 0);

    if (!numeros.length) {
      return NextResponse.json({ ok: false, error: 'Informe os pedidos' }, { status: 400, headers: corsHeaders });
    }
    if (!motoristaId) {
      return NextResponse.json(
        { ok: false, error: 'Informe o motorista' },
        { status: 400, headers: corsHeaders }
      );
    }

    const motorista = await prisma.motorista.findUnique({ where: { id: motoristaId } });
    if (!motorista) {
      return NextResponse.json({ ok: false, error: 'Motorista não encontrado' }, { status: 404, headers: corsHeaders });
    }

    const rows = await prisma.platform_order.findMany({
      where: { numero: { in: numeros }, status: 'FATURADO' },
      select: { numero: true, tiny_id: true },
    });

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Nenhum pedido faturado encontrado' }, { status: 404, headers: corsHeaders });
    }

    const errors: Array<{ numero: number; mensagem: string; detalhes?: Array<{ campo: string; mensagem: string }> }> = [];
    const successNumeros: number[] = [];
    const situacao = 5;

    for (const row of rows) {
      if (!row.tiny_id) {
        errors.push({ numero: row.numero, mensagem: 'Pedido sem tiny_id' });
        continue;
      }
      const tinyRes = await tinyV3Fetch(`/pedidos/${row.tiny_id}/situacao`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao }),
      });
      if (tinyRes.status === 204) {
        successNumeros.push(row.numero);
        continue;
      }
      const tinyJson = await tinyRes.json().catch(() => null);
      const mensagem = tinyJson?.mensagem || `Falha Tiny: status=${tinyRes.status}`;
      const detalhes = Array.isArray(tinyJson?.detalhes)
        ? tinyJson.detalhes.map((d: any) => ({
            campo: String(d?.campo || ''),
            mensagem: String(d?.mensagem || ''),
          }))
        : undefined;
      errors.push({ numero: row.numero, mensagem, detalhes });
    }

    if (!successNumeros.length) {
      return NextResponse.json(
        { ok: false, error: 'Não foi possível atualizar pedidos no Tiny', detalhes: errors },
        { status: 502, headers: corsHeaders }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.platform_order.updateMany({
        where: { numero: { in: successNumeros }, status: 'FATURADO' },
        data: { status: 'ENVIADO' },
      });

      const historyData = rows
        .filter((r) => r.tiny_id != null && successNumeros.includes(r.numero))
        .map((r) => ({
          tiny_id: r.tiny_id as number,
          status: 'ENVIADO' as const,
        }));

      if (historyData.length) {
        await tx.platform_order_status_history.createMany({ data: historyData });
      }

      const envioData = successNumeros.map((numero) => ({
        order_num: numero,
        motorista_id: motorista.id,
      }));
      if (envioData.length) {
        await tx.platform_order_envio.createMany({ data: envioData, skipDuplicates: true });
      }

      return { updated: updateResult.count };
    });

    if (errors.length) {
      return NextResponse.json(
        { ok: false, error: 'Alguns pedidos não puderam ser enviados', updated: updated.updated, detalhes: errors },
        { status: 207, headers: corsHeaders }
      );
    }

    return NextResponse.json({ ok: true, updated: updated.updated }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar pedidos' }, { status: 500, headers: corsHeaders });
  }
}
