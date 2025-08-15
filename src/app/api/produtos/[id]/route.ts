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

    // Busca a primeira imagem dos anexos
    const primeiraImagem = produto.anexos && produto.anexos.length > 0 
      ? produto.anexos[0].anexo 
      : null;

    // Processa a categoria para breadcrumb
    const categorias = produto.categoria 
      ? produto.categoria.split(" >> ").filter((cat: string) => cat.trim())
      : [];

    return NextResponse.json({
      id: produto.id,
      nome: produto.nome,
      codigo: produto.codigo,
      unidade: produto.unidade,
      preco: produto.preco,
      precoPromocional: produto.preco_promocional,
      precoCusto: produto.preco_custo,
      ncm: produto.ncm,
      gtin: produto.gtin,
      categoria: produto.categoria,
      categorias: categorias,
      marca: produto.marca,
      descricao: produto.descricao_complementar,
      garantia: produto.garantia,
      pesoLiquido: produto.peso_liquido,
      pesoBruto: produto.peso_bruto,
      estoqueMinimo: produto.estoque_minimo,
      estoqueMaximo: produto.estoque_maximo,
      estoqueAtual: produto.estoqueAtual || 0,
      situacao: produto.situacao,
      fornecedor: {
        nome: produto.nome_fornecedor,
        codigo: produto.codigo_fornecedor
      },
      imagem: primeiraImagem,
      anexos: produto.anexos || [],
      imagensExternas: produto.imagens_externas || []
    });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json(
      { erro: "Falha ao buscar produto" },
      { status: 500 }
    );
  }
}
