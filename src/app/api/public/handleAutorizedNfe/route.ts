import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const raw = await req.text()
  let json: any = null

  try {
    json = JSON.parse(raw)
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const idNotaFiscal = json?.dados?.idNotaFiscalTiny
  if (!idNotaFiscal) {
    return NextResponse.json({ ok: true, message: 'no idNotaFiscalTiny' })
  }

  const token = process.env.TINY_API_TOKEN || ''
  const tinyUrl = `https://api.tiny.com.br/api2/nota.fiscal.obter.php?token=${encodeURIComponent(
    token
  )}&id=${encodeURIComponent(String(idNotaFiscal))}&formato=json`

  let apiResponseText = ''
  try {
    const r = await fetch(tinyUrl)
    apiResponseText = await r.text()
    if (r.status !== 200) {
      return NextResponse.json({ ok: false, error: 'tiny_http_error', status: r.status }, { status: 502 })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'tiny_fetch_error', detail: String(e) }, { status: 500 })
  }

  let data: any = null
  try {
    data = JSON.parse(apiResponseText)
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'invalid_tiny_json' }, { status: 500 })
  }

  const nota = data?.retorno?.nota_fiscal ?? null
  if (!nota) {
    return NextResponse.json({ ok: false, error: 'nota_not_found' }, { status: 404 })
  }

  const numero = nota.numero ?? ''
  const emiter = 'L1 ALIANCA MERCANTIL'
  const destine = nota.cliente?.nome ?? ''
  const formaPagamento = String((nota.forma_pagamento ?? nota.meio_pagamento) || '')
  const valor = nota.valor_nota ?? nota.total ?? 0

  // format value as "1.234,56"
  const valorFormatted = Number(valor).toFixed(2).replace('.', ',')

  const message = `Nota ${numero} emitida para ${destine} (origem: ${emiter}) com forma de pagamento ${formaPagamento} no valor de R$ ${valorFormatted}.`

  // send via existing internal whatsapp API
  const whatsappEndpoint =
    (process.env.NEXT_PUBLIC_INTERNAL_URL ? `${process.env.NEXT_PUBLIC_INTERNAL_URL}/api/whatsapp` : '') ||
    'http://localhost:3000/api/whatsapp'

  try {
    const resp = await fetch(whatsappEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5524999946480',
        message,
      }),
    })
    const jsonResp = await resp.json().catch(() => null)
    return NextResponse.json({ ok: true, forwarded: !!jsonResp, result: jsonResp })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'whatsapp_send_failed', detail: String(e) }, { status: 500 })
  }
}

