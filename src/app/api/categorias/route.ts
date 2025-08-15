import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TINY_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { erro: "Token da API não configurado" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`https://api.tiny.com.br/api2/produtos.categorias.arvore.php?token=${token}&formato=json`, {
      method: "GET",
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Erro na API: ${res.status}`);
    }

    const json = await res.json();
    const categorias = json?.retorno || [];

    return NextResponse.json(categorias);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    return NextResponse.json(
      { erro: "Falha ao buscar categorias" },
      { status: 500 }
    );
  }
}
