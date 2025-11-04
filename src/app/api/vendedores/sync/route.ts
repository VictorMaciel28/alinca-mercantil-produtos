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
    let pagina = 1
    let numero_paginas = 1
    let imported = 0

    await prisma.vendedor.deleteMany()

    while (pagina <= numero_paginas) {
      const retorno = await fetchTinyVendedoresPage(pagina)
      numero_paginas = retorno?.numero_paginas ?? 1

      const vendedores: { vendedor: TinyVendedor }[] = retorno?.vendedores ?? []
      const batch: any[] = []
      for (const v of vendedores) {
        const vd = v?.vendedor || {}
        if (!vd?.id || !vd?.nome) continue

        batch.push({
          id_vendedor_externo: String(vd.id),
          nome: vd.nome,
          email: vd.email ?? null,
        })
      }

      if (batch.length > 0) {
        await prisma.vendedor.createMany({ data: batch })
        imported += batch.length
      }

      pagina += 1
    }

    return NextResponse.json({ ok: true, imported })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao atualizar vendedores' }, { status: 500 })
  }
}



