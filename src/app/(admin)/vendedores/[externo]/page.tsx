"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Cliente = {
  id: number
  external_id: string
  nome: string
  fantasia?: string | null
  cidade?: string | null
  estado?: string | null
  fone?: string | null
  email?: string | null
  cpf_cnpj?: string | null
}

type Vendedor = { id: number; id_vendedor_externo?: string | null; nome: string }

export default function VendedorClientesPage() {
  const params = useParams()
  const router = useRouter()
  const externo = (params?.externo || '').toString()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedor, setVendedor] = useState<Vendedor | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [rc, rv] = await Promise.all([
        fetch(`/api/clientes?vendedor_externo=${encodeURIComponent(externo)}`),
        fetch('/api/vendedores'),
      ])
      const jc = await rc.json()
      const jv = await rv.json()
      if (jc?.ok) setClientes(jc.data)
      if (jv?.ok) {
        const found = (jv.data as Vendedor[]).find((v) => v.id_vendedor_externo === externo)
        setVendedor(found || null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (externo) load()
  }, [externo])

  const rows = useMemo(() => clientes, [clientes])

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="m-0">Clientes do Vendedor</h2>
          <div className="text-muted">{vendedor ? `${vendedor.nome} (${externo})` : externo}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => router.back()}>Voltar</button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Fantasia</th>
                <th>CPF/CNPJ</th>
                <th>Cidade/UF</th>
                <th>Telefone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.external_id}</td>
                  <td>{c.nome}</td>
                  <td>{c.fantasia ?? '-'}</td>
                  <td>{c.cpf_cnpj ?? '-'}</td>
                  <td>
                    {c.cidade ?? '-'} {c.estado ? `/${c.estado}` : ''}
                  </td>
                  <td>{c.fone ?? '-'}</td>
                  <td>{c.email ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}



