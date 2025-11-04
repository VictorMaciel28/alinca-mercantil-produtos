"use client"

import { useEffect, useMemo, useState } from 'react'

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
  nome_vendedor?: string | null
  vendedor?: { id: number; nome: string | null } | null
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clientes')
      const json = await res.json()
      if (json?.ok) setClientes(json.data)
    } catch (e) {
      // noop
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/clientes/sync', { method: 'POST' })
      const json = await res.json()
      if (json?.ok) {
        await load()
        alert(`Atualização concluída. Inseridos: ${json.imported}, Atualizados: ${json.updated}`)
      } else {
        alert(json?.error ?? 'Falha ao atualizar')
      }
    } catch (err: any) {
      alert('Falha ao atualizar clientes.')
    } finally {
      setSyncing(false)
    }
  }

  const rows = useMemo(() => clientes, [clientes])

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Clientes</h2>
        <div>
          <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
            {syncing ? 'Atualizando...' : 'Atualizar Clientes'}
          </button>
        </div>
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
                <th>Vendedor</th>
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
                  <td>{c.vendedor?.nome ?? c.nome_vendedor ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


