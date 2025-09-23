import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const busca = new URL(req.url).searchParams.get("q") || "";
  const token = process.env.TINY_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { erro: "Token da API não configurado" },
      { status: 500 }
    );
  }

  const formData = new URLSearchParams();
  formData.append("token", token);
  formData.append("pesquisa", busca);

  // Só enviar cpf_cnpj quando for um CNPJ válido (14 dígitos ou formatado)
  const onlyDigits = busca.replace(/\D/g, "");
  const looksLikeCnpjFormatted = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(busca);
  const looksLikeCnpjDigits = onlyDigits.length === 14;
  if (looksLikeCnpjFormatted || looksLikeCnpjDigits) {
    formData.append("cpf_cnpj", onlyDigits);
  }

  formData.append("formato", "json");
  formData.append("pagina", "1");
  formData.append("limite", "50");

  try {
    const res = await fetch("https://api.tiny.com.br/api2/contatos.pesquisa.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao buscar contatos:", error);
    return NextResponse.json({ erro: "Falha ao buscar contatos" }, { status: 500 });
  }
}
