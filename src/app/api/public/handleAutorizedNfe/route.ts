import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import nodemailer from 'nodemailer'

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
  const chave = nota.chave_acesso ?? ''

  // send via existing internal whatsapp API
  const whatsappEndpoint =
    (process.env.NEXT_PUBLIC_INTERNAL_URL ? `${process.env.NEXT_PUBLIC_INTERNAL_URL}/api/whatsapp` : '') ||
    'http://localhost:3000/api/whatsapp'

  const results: any = { whatsapp: null, email: null }

  // attempt WhatsApp send
  try {
    const resp = await fetch(whatsappEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '5524999946480',
        message,
      }),
    })
    results.whatsapp = await resp.json().catch(() => null)
  } catch (e: any) {
    results.whatsapp = { error: String(e) }
  }

  // send email notification
  try {
    const smtpHost = process.env.SMTP_HOST || 'br590.hostgator.com.br'
    const smtpPort = Number(process.env.SMTP_PORT || '587')
    const smtpUser = process.env.SMTP_USER || 'sama@aliancamercantil.com'
    const smtpPass = process.env.SMTP_PASS || 'sama@aliancamercantil.com'
    const from = process.env.EMAIL_FROM || smtpUser
    const toEmail = process.env.NOTIFY_EMAIL || 'sama@aliancamercantil.com'

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    const subject = `Nota ${numero} emitida — ${valorFormatted}`
    const html = `<p>${message}</p><p><strong>Chave de acesso:</strong> ${chave}</p>`

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      html,
    })
    results.email = { ok: true, info }
  } catch (e: any) {
    results.email = { error: String(e) }
  }

  return NextResponse.json({ ok: true, results })
}

