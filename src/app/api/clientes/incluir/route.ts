import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const token = process.env.TINY_API_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Token da API não configurado' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido' }, { status: 400 })
  }

  const contato = body?.contato
  if (!contato || typeof contato !== 'object') {
    return NextResponse.json({ ok: false, erro: "Corpo deve conter 'contato'" }, { status: 400 })
  }

  const payload = {
    contatos: [
      {
        contato: {
          sequencia: '1',
          ...contato,
        },
      },
    ],
  }

  const formData = new URLSearchParams()
  formData.append('token', token)
  formData.append('formato', 'json')
  // Tiny contato.incluir expects parameter "contato".
  // Keep "contatos" as fallback for compatibility with batch-style payload.
  formData.append('contato', JSON.stringify(payload))
  formData.append('contatos', JSON.stringify(payload))

  try {
    const res = await fetch('https://api.tiny.com.br/api2/contato.incluir.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formData.toString(),
    })

    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? { ok: false, erro: 'Resposta inválida da API Tiny' }, { status: res.ok ? 200 : res.status })
  } catch (error) {
    return NextResponse.json({ ok: false, erro: 'Falha ao incluir contato no Tiny' }, { status: 500 })
  }
}
