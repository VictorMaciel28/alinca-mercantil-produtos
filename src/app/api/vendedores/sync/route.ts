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
    // First: collect all vendedores from Tiny (all pages) into an array
    let pagina = 1
    let numero_paginas = 1
    const tinyAll: { vendedor: TinyVendedor }[] = []
    while (pagina <= numero_paginas) {
      const retorno = await fetchTinyVendedoresPage(pagina)
      numero_paginas = retorno?.numero_paginas ?? 1
      const vendedores: { vendedor: TinyVendedor }[] = retorno?.vendedores ?? []
      for (const v of vendedores) {
        const vd = v?.vendedor || {}
        if (!vd?.id || !vd?.nome) continue
        tinyAll.push({ vendedor: vd })
      }
      pagina += 1
    }

    // Build maps and lists for efficient DB operations
    const externals = Array.from(new Set(tinyAll.map((t) => String(t.vendedor.id))))
    const existingVendors = externals.length > 0 ? await prisma.vendedor.findMany({ where: { id_vendedor_externo: { in: externals } } }) : []
    const existingByExternal = new Map(existingVendors.map((e) => [e.id_vendedor_externo, e]))

    const toCreate: any[] = []
    const toUpdate: { id: number; data: any }[] = []

    for (const t of tinyAll) {
      const vd = t.vendedor
      const externo = String(vd.id)
      const data = {
        id_vendedor_externo: externo,
        nome: vd.nome,
        email: vd.email ?? null,
      }
      const existing = existingByExternal.get(externo)
      if (existing) {
        toUpdate.push({ id: existing.id, data })
      } else {
        toCreate.push(data)
      }
    }

    // Perform DB writes: createMany for new, parallel updates for existing
    let created = 0
    let updated = 0
    if (toCreate.length > 0) {
      // createMany ignores duplicates; safe to use
      await prisma.vendedor.createMany({ data: toCreate })
      created = toCreate.length
    }

    if (toUpdate.length > 0) {
      // run updates in parallel (transaction could be used if desired)
      await Promise.all(
        toUpdate.map((u) => prisma.vendedor.update({ where: { id: u.id }, data: u.data }))
      )
      updated = toUpdate.length
    }

    return NextResponse.json({ ok: true, created, updated })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao atualizar vendedores' }, { status: 500 })
  }
}



