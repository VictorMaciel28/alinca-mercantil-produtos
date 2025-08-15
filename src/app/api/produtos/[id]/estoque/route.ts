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
    const res = await fetch("https://api.tiny.com.br/api2/produto.obter.estoque.php", {
      method: "POST",
      headers: { 'Accept': 'application/json' },
      body: paramsBody,
    });

    if (!res.ok) {
      throw new Error(`Erro na API: ${res.status}`);
    }

    const json = await res.json();
    const produtoEstoque = json?.retorno?.produto;

    if (!produtoEstoque) {
      return NextResponse.json(
        { erro: "Estoque do produto não encontrado" },
        { status: 404 }
      );
    }

    // Calcula o total de estoque
    const depositos = produtoEstoque.depositos || [];
    const totalEstoque = depositos.reduce((total: number, dep: any) => {
      const saldo = dep.deposito.saldo || 0;
      return total + (saldo > 0 ? saldo : 0); // Soma apenas saldos positivos
    }, 0);

    // Filtra depósitos com estoque positivo para exibição
    const depositosComEstoque = depositos.filter((dep: any) => 
      dep.deposito.saldo > 0
    );

    return NextResponse.json({
      id: produtoEstoque.id,
      nome: produtoEstoque.nome,
      codigo: produtoEstoque.codigo,
      unidade: produtoEstoque.unidade,
      saldo: produtoEstoque.saldo,
      saldoReservado: produtoEstoque.saldoReservado,
      totalEstoque: totalEstoque,
      depositos: depositos,
      depositosComEstoque: depositosComEstoque
    });
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return NextResponse.json(
      { erro: "Falha ao buscar informações de estoque" },
      { status: 500 }
    );
  }
}
