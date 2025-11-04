"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Vendedor = {
  id: number
  id_vendedor_externo?: string | null
  nome: string
  email?: string | null
}

export default function VendedoresPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendedores')
      const json = await res.json()
      if (json?.ok) setRows(json.data)
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
      const res = await fetch('/api/vendedores/sync', { method: 'POST' })
      const json = await res.json()
      if (json?.ok) {
        await load()
        alert(`Atualização concluída. Inseridos: ${json.imported}`)
      } else {
        alert(json?.error ?? 'Falha ao atualizar vendedores')
      }
    } finally {
      setSyncing(false)
    }
  }

  const data = useMemo(() => rows, [rows])

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Vendedores</h2>
        <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
          {syncing ? 'Atualizando...' : 'Atualizar Vendedores'}
        </button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped table-hover">
            <thead>
              <tr>
                <th>ID Externo</th>
                <th>Nome</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr
                  key={v.id}
                  style={{ cursor: v.id_vendedor_externo ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!v.id_vendedor_externo) return
                    router.push(`/vendedores/${v.id_vendedor_externo}`)
                  }}
                >
                  <td>{v.id_vendedor_externo ?? '-'}</td>
                  <td>{v.nome}</td>
                  <td>{v.email ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


