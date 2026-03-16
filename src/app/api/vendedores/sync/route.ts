import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type TinyVendedor = {
  id?: number
  codigo?: string
  nome?: string
  fantasia?: string
  tipo_pessoa?: string
  cpf_cnpj?: string
  email?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  cidade?: string
  uf?: string
  situacao?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
let tinyVendedoresCache: { fetchedAt: number; data: TinyVendedor[] } | null = null

async function fetchTinyVendedoresPage(pagina: number) {
  const token = process.env.TINY_API_TOKEN
  if (!token) throw new Error('Token da API não configurado')

  const form = new URLSearchParams()
  form.append('token', token)
  form.append('pesquisa', '')
  form.append('formato', 'json')
  form.append('pagina', String(pagina))

  const res = await fetch('https://api.tiny.com.br/api2/vendedores.pesquisa.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  })

  const data = await res.json()
  if (!res.ok) throw new Error('Falha ao consultar Tiny')
  if (!data?.retorno || data?.retorno?.status !== 'OK') {
    const err = data?.retorno?.erros?.[0]?.erro || 'Retorno inválido'
    throw new Error(err)
  }
  return data?.retorno
}

export async function POST() {
  try {
    const now = Date.now()

    // 1) Load Tiny vendors using short-lived cache
    let tinyRows: TinyVendedor[] = []
    if (tinyVendedoresCache && now - tinyVendedoresCache.fetchedAt < CACHE_TTL_MS) {
      tinyRows = tinyVendedoresCache.data
    } else {
      let pagina = 1
      let numero_paginas = 1
      const fetched: TinyVendedor[] = []
      while (pagina <= numero_paginas) {
        const retorno = await fetchTinyVendedoresPage(pagina)
        numero_paginas = retorno?.numero_paginas ?? 1
        const vendedores: { vendedor: TinyVendedor }[] = retorno?.vendedores ?? []
        for (const v of vendedores) {
          const vd = v?.vendedor || {}
          if (!vd?.id || !vd?.nome) continue
          fetched.push(vd)
        }
        pagina += 1
      }
      tinyRows = fetched
      tinyVendedoresCache = { fetchedAt: now, data: fetched }
    }

    // 2) Read all vendors from DB and add only missing ones by external id
    const existingVendors = await prisma.vendedor.findMany({
      select: { id_vendedor_externo: true },
    })
    const existingExternalSet = new Set(
      existingVendors
        .map((e) => (e.id_vendedor_externo || '').trim())
        .filter((x): x is string => !!x)
    )

    const toCreate: any[] = []
    for (const vd of tinyRows) {
      const externo = String(vd.id)
      if (existingExternalSet.has(externo)) continue
      toCreate.push({
        id_vendedor_externo: externo,
        nome: vd.nome,
        email: vd.email ?? null,
      })
      existingExternalSet.add(externo)
    }

    // 3) Persist only new records
    let created = 0
    if (toCreate.length > 0) {
      await prisma.vendedor.createMany({ data: toCreate })
      created = toCreate.length
    }

    const updated = 0

    // keep response keys compatible with existing UIs
    return NextResponse.json({ ok: true, created, imported: created, updated, cached: !!tinyVendedoresCache && now - tinyVendedoresCache.fetchedAt < CACHE_TTL_MS })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao atualizar vendedores' }, { status: 500 })
  }
}



