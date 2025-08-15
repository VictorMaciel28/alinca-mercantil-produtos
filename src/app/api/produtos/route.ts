// src/app/api/produtos/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const busca = new URL(req.url).searchParams.get("q") || "";
  const token = process.env.TINY_API_TOKEN;

  const formData = new URLSearchParams();
  formData.append("token", token || "");
  formData.append("pesquisa", busca);
  formData.append("formato", "json");
  formData.append("pagina", "1");
  formData.append("limite", "100");

  try {
    const res = await fetch("https://api.tiny.com.br/api2/produtos.pesquisa.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await res.json(); // pega como objeto
    return NextResponse.json(data); // devolve direto
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json({ erro: "Falha ao buscar produtos" }, { status: 500 });
  }
}
