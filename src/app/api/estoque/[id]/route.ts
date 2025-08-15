import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const token = process.env.TINY_API_TOKEN;
  const id = params.id;

  if (!token) {
    return NextResponse.json(
      { erro: "Token da API não configurado" },
      { status: 500 }
    );
  }

  const paramsBody = new URLSearchParams();
  paramsBody.set("token", token);
  paramsBody.set("id", id);
  paramsBody.set("formato", "JSON");

  try {
    const res = await fetch("https://api.tiny.com.br/api2/produto.obter.php", {
      method: "POST",
      headers: { 'Accept': 'application/json' },
      body: paramsBody,
    });

    if (!res.ok) {
      throw new Error(`Erro na API: ${res.status}`);
    }

    const json = await res.json();
    const produto = json?.retorno?.produto;

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Retorna informações de estoque do produto
    return NextResponse.json({
      id: produto.id,
      nome: produto.nome,
      estoqueAtual: produto.estoqueAtual,
      estoqueMinimo: produto.estoqueMinimo,
      estoqueMaximo: produto.estoqueMaximo,
      depositos: produto.depositos || [],
      estoques: produto.estoques || [],
    });
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return NextResponse.json(
      { erro: "Falha ao buscar informações de estoque" },
      { status: 500 }
    );
  }
}
