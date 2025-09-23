import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const token = process.env.TINY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ erro: "Token da API não configurado" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const pedido = body?.pedido;
  if (!pedido) {
    return NextResponse.json({ erro: "Corpo deve conter 'pedido'" }, { status: 400 });
  }

  const formData = new URLSearchParams();
  formData.append("token", token);
  formData.append("formato", "json");
  // Tiny espera o objeto 'pedido' como JSON string
  formData.append("pedido", JSON.stringify({ pedido }));

  try {
    const res = await fetch("https://api.tiny.com.br/api2/pedido.incluir.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formData.toString(),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error) {
    console.error("Erro ao incluir pedido:", error);
    return NextResponse.json({ erro: "Falha ao incluir pedido" }, { status: 500 });
  }
}
