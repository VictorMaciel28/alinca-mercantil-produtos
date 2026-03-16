import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { tinyV3Fetch } from '@/lib/tinyOAuth'
import { Xslt, XmlParser } from 'xslt-processor'
import puppeteer from 'puppeteer'

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

const RASTREAMENTO_DIR = path.join(process.cwd(), 'src/app/api/public/rastreamento')
const SCHEMA_DIR = path.join(RASTREAMENTO_DIR, 'danfe-schema')
const NFE_XSL_PATH = path.join(SCHEMA_DIR, 'NFe.xsl')
const DANFE_XSL = fs.readFileSync(NFE_XSL_PATH, 'utf8')
const parser = new XmlParser()
const xslt = new Xslt({
  outputMethod: 'html',
  fetchFunction: async (uri: string) => {
    const normalized = uri.replace(/^[\\/]+/, '')
    const localSchema = path.join(SCHEMA_DIR, normalized)
    if (fs.existsSync(localSchema)) {
      return fs.readFileSync(localSchema, 'utf8')
    }
    const localRoot = path.join(RASTREAMENTO_DIR, normalized)
    if (fs.existsSync(localRoot)) {
      return fs.readFileSync(localRoot, 'utf8')
    }
    if (/^https?:\/\//i.test(uri)) {
      const res = await fetch(uri, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      })
      if (!res.ok) throw new Error(`xslt fetch ${uri}: ${res.status}`)
      return res.text()
    }
    const remoteUrl = new URL(uri, 'https://dfe-portal.svrs.rs.gov.br/Schemas/PRNFE/XSLT/NFe/').toString()
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })
    if (!res.ok) throw new Error(`xslt fetch ${remoteUrl}: ${res.status}`)
    return res.text()
  },
})
const PRECOMPILED_XSLT = parser.xmlParse(DANFE_XSL)

async function buildDanfeHtml(xml: string) {
  try {
    return await xslt.xsltProcess(parser.xmlParse(xml), PRECOMPILED_XSLT)
  } catch (error) {
    console.error('[buildDanfeHtml] xslt error', error)
    throw error
  }
}

async function renderHtmlToPdf(html: string) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
  })
  await browser.close()
  return pdf
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
      const html = await buildDanfeHtml(xml)
      const pdf = await renderHtmlToPdf(html)
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

