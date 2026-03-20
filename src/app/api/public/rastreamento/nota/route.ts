import { NextResponse } from 'next/server'
import { tinyV3Fetch } from '@/lib/tinyOAuth'

function extractXmlString(payload: any): string | null {
  if (!payload) return null
  const candidates = [
    payload.xmlNfe,
    payload.xmlNFe,
    payload.xml,
    payload?.data?.xmlNfe,
    payload?.data?.xmlNFe,
    payload?.data?.xml,
  ]
  const found = candidates.find((c) => typeof c === 'string' && c.trim())
  if (!found) return null
  const raw = String(found).trim()
  if (raw.startsWith('<')) return raw
  try {
    return Buffer.from(raw, 'base64').toString('utf-8')
  } catch {
    return raw
  }
}

const DANFE_API_URL = 'https://api.meudanfe.com.br/v2/fd/convert/xml-to-da'
const DANFE_API_KEY = process.env.DANFE_API_KEY || 'a23c472e-6b4e-40d6-a8bc-4099eb0ff1ef'

async function fetchDanfePdf(xml: string) {
  const res = await fetch(DANFE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Api-Key': DANFE_API_KEY,
    },
    body: xml,
  })

  const json = await res.json().catch(() => null)
  const data = json?.data
  if (!res.ok || !data || typeof data !== 'string') {
    const message = json?.message || json?.error || `danfe_api_error_${res.status}`
    throw new Error(message)
  }

  return Buffer.from(data, 'base64')
}

async function fetchTinyXml(idNota: string) {
  const paths = [`/nots/${idNota}/xml`, `/notas/${idNota}/xml`]
  let lastRes: Response | null = null
  for (const p of paths) {
    const res = await tinyV3Fetch(p, { method: 'GET' })
    lastRes = res
    if (res.ok) {
      const json = await res.json().catch(() => null)
      const xml = extractXmlString(json)
      if (xml) return { xml, json }
    }
  }
  if (lastRes) {
    const text = await lastRes.text().catch(() => '')
    throw new Error(`tiny_xml_error: status=${lastRes.status} body=${text}`)
  }
  throw new Error('tiny_xml_error')
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const idNota = (searchParams.get('id') || '').toString().trim()
    const type = (searchParams.get('type') || 'xml').toString().trim().toLowerCase()
    if (!idNota) {
      return NextResponse.json({ ok: false, error: 'id_nota_obrigatorio' }, { status: 400 })
    }

    const { xml } = await fetchTinyXml(idNota)

    if (type === 'pdf') {
      const pdf = await fetchDanfePdf(xml)
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="danfe-${idNota}.pdf"`,
        },
      })
    }

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="nfe-${idNota}.xml"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'erro_ao_baixar_nota' }, { status: 500 })
  }
}

