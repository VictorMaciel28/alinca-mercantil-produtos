import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/prisma';
import { decryptPassword } from '@/lib/crypto';

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
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body?.email?.toString().trim() || '';
    const password = body?.password?.toString() || '';

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email e senha são obrigatórios' },
        { status: 400, headers: corsHeaders }
      );
    }

    const motorista = await prisma.motorista.findFirst({ where: { email } });
    if (!motorista?.senha_encrypted) {
      return NextResponse.json({ ok: false, error: 'Credenciais inválidas' }, { status: 401, headers: corsHeaders });
    }

    let plain = '';
    try {
      plain = decryptPassword(motorista.senha_encrypted);
    } catch (error) {
      return NextResponse.json({ ok: false, error: 'Credenciais inválidas' }, { status: 401, headers: corsHeaders });
    }

    if (plain !== password) {
      return NextResponse.json({ ok: false, error: 'Credenciais inválidas' }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        ok: true,
      user: {
        id: String(motorista.id),
        name: motorista.nome ?? null,
        email: motorista.email ?? email,
      },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Erro ao autenticar' }, { status: 500, headers: corsHeaders });
  }
}
