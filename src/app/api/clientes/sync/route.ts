import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type TinyContato = {
  id?: number
  codigo?: string
  nome?: string
  fantasia?: string
  tipo_pessoa?: string
  cpf_cnpj?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  cidade?: string
  uf?: string
  email?: string
  fone?: string
  id_lista_preco?: number
  id_vendedor?: number
  nome_vendedor?: string
  situacao?: string
  data_criacao?: string
}

async function fetchTinyPage(pagina: number) {
  const token = process.env.TINY_API_TOKEN
  if (!token) throw new Error('Token da API não configurado')

  const form = new URLSearchParams()
  form.append('token', token)
  form.append('pesquisa', '')
  form.append('formato', 'json')
  form.append('pagina', String(pagina))

  const res = await fetch('https://api.tiny.com.br/api2/contatos.pesquisa.php', {
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
    let updated = 0

    // Replace-all strategy: clear table first
    await prisma.cliente.deleteMany()

    while (pagina <= numero_paginas) {
      const retorno = await fetchTinyPage(pagina)
      numero_paginas = retorno?.numero_paginas ?? 1

      const contatos: { contato: TinyContato }[] = retorno?.contatos ?? []
      const pageBatch: any[] = []
      for (const c of contatos) {
        const ct = c?.contato || {}
        if (!ct?.id || !ct?.nome) continue

        const extId = BigInt(ct.id)
        const vendedorExtId = ct.id_vendedor != null ? String(ct.id_vendedor) : null
        const vendedorNome = ct.nome_vendedor || null

        const dataCommon: any = {
          codigo: ct.codigo ?? null,
          nome: ct.nome,
          fantasia: ct.fantasia ?? null,
          endereco: ct.endereco ?? null,
          numero: ct.numero ?? null,
          complemento: ct.complemento ?? null,
          bairro: ct.bairro ?? null,
          cep: ct.cep ?? null,
          cidade: ct.cidade ?? null,
          estado: ct.uf ?? null,
          email: ct.email ?? null,
          fone: ct.fone ?? null,
          tipo_pessoa: ct.tipo_pessoa ?? null,
          cpf_cnpj: ct.cpf_cnpj ?? null,
          lista_preco: ct.id_lista_preco != null ? String(ct.id_lista_preco) : null,
          id_vendedor_externo: vendedorExtId,
          nome_vendedor: vendedorNome,
          situacao: ct.situacao ?? null,
        }

        pageBatch.push({ external_id: extId, ...dataCommon })
      }

      if (pageBatch.length > 0) {
        await prisma.cliente.createMany({ data: pageBatch })
        imported += pageBatch.length
      }

      pagina += 1
      // Pequena pausa opcional para evitar rate limit severo
      // await new Promise((r) => setTimeout(r, 100))
    }

    return NextResponse.json({ ok: true, imported, updated })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao atualizar clientes' }, { status: 500 })
  }
}


