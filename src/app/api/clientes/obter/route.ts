import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const token = process.env.TINY_API_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Token da API não configurado' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const id = (searchParams.get('id') || '').trim()
  if (!id) {
    return NextResponse.json({ ok: false, erro: "Parâmetro 'id' é obrigatório" }, { status: 400 })
  }

  try {
    const tinyUrl = `https://api.tiny.com.br/api2/contato.obter.php?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}&formato=json`
    const res = await fetch(tinyUrl, { method: 'GET' })
    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? { ok: false, erro: 'Resposta inválida da API Tiny' }, { status: res.ok ? 200 : res.status })
  } catch {
    return NextResponse.json({ ok: false, erro: 'Falha ao obter contato no Tiny' }, { status: 500 })
  }
}
