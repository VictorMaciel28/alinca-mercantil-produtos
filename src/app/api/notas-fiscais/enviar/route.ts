import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const token = body?.token || body?.apiKey
    const nota = body?.nota
    const formato = body?.formato || 'JSON'

    if (!token || !nota) {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 })
    }

    const apiKey = body?.apiKey || token
    const notaString = typeof nota === 'string' ? nota : JSON.stringify(nota)
    const bodyParams = new URLSearchParams({
      token: String(token),
      apiKey: String(apiKey),
      nota: notaString,
      formato: String(formato),
    })

    const response = await fetch('https://api.tiny.com.br/api2/nota.fiscal.incluir.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: bodyParams.toString(),
    })

    const text = await response.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    return NextResponse.json({ ok: true, data }, { status: response.ok ? 200 : 502 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao enviar nota' }, { status: 500 })
  }
}
