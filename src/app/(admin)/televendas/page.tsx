"use client"

import { useEffect, useMemo, useState } from 'react'

type Linha = { id: number; id_vendedor_externo: string; nome?: string | null; cidade: string }
type Vendedor = { id: number; id_vendedor_externo?: string | null; nome: string }

export default function TelevendasPage() {
  const [rows, setRows] = useState<Linha[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [cidades, setCidades] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Linha | null>(null)

  const [telSearch, setTelSearch] = useState('')
  const [telSelected, setTelSelected] = useState<{ externo: string; nome: string } | null>(null)
  const [citySearch, setCitySearch] = useState('')
  const [citySelected, setCitySelected] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/televendas'),
        fetch('/api/vendedores'),
        fetch('/api/televendas/cidades'),
      ])
      const j1 = await r1.json()
      const j2 = await r2.json()
      const j3 = await r3.json()
      if (j1?.ok) setRows(j1.data)
      if (j2?.ok) setVendedores(j2.data)
      if (j3?.ok) setCidades(j3.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setEditing(null)
    setTelSelected(null)
    setCitySelected(null)
    setTelSearch('')
    setCitySearch('')
    setShowModal(true)
  }

  const openEdit = (r: Linha) => {
    setEditing(r)
    setTelSelected({ externo: r.id_vendedor_externo, nome: r.nome || r.id_vendedor_externo })
    setCitySelected(r.cidade)
    setTelSearch('')
    setCitySearch('')
    setShowModal(true)
  }

  const telOptions = useMemo(() => {
    const q = telSearch.trim().toLowerCase()
    if (!q) return []
    return vendedores
      .filter((v) => (v.id_vendedor_externo || '') && (!q || v.nome.toLowerCase().includes(q)))
      .slice(0, 10)
      .map((v) => ({ externo: v.id_vendedor_externo as string, nome: v.nome }))
  }, [vendedores, telSearch])

  const cityOptions = useMemo(() => {
    const q = citySearch.trim().toLowerCase()
    if (!q) return []
    return cidades.filter((c) => c.toLowerCase().includes(q)).slice(0, 10)
  }, [cidades, citySearch])

  const save = async () => {
    if (!telSelected) return alert('Selecione Telemarketing (vendedor)')
    if (!citySelected) return alert('Selecione a cidade')
    const payload = { vendedor_externo: telSelected.externo, nome: telSelected.nome, cidade: citySelected }
    const res = await fetch('/api/televendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!json?.ok) return alert(json?.error || 'Erro ao salvar')
    setShowModal(false)
    await load()
  }

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Televendas</h2>
        <button className="btn btn-primary" onClick={openNew}>Novo Televendas</button>
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
                <th>Cidade Atribuída</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                  <td>{r.id_vendedor_externo}</td>
                  <td>{r.nome || '-'}</td>
                  <td>{r.cidade}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-danger"
                      title="Excluir"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('Deseja excluir este registro?')) return
                        const res = await fetch('/api/televendas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
                        const json = await res.json()
                        if (!json?.ok) return alert(json?.error || 'Erro ao excluir')
                        await load()
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? 'Editar Televendas' : 'Novo Televendas'}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Telemarketing (digite para buscar e selecione)</label>
                  {!telSelected ? (
                    <>
                      <input className="form-control mb-2" placeholder="Buscar vendedor..." value={telSearch} onChange={(e) => setTelSearch(e.target.value)} />
                      <div className="list-group">
                        {telOptions.map((opt) => (
                          <button key={opt.externo} type="button" className="list-group-item list-group-item-action" onClick={() => setTelSelected(opt)}>
                            {opt.nome} <span className="text-muted">({opt.externo})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <input className="form-control" readOnly value={`${telSelected.nome} (${telSelected.externo})`} />
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label">Cidade (digite para buscar e selecione)</label>
                  {editing ? (
                    <>
                      <input
                        className="form-control mb-2"
                        placeholder="Buscar cidade..."
                        value={citySelected ?? citySearch}
                        onChange={(e) => {
                          setCitySelected(e.target.value)
                          setCitySearch(e.target.value)
                        }}
                      />
                      <div className="list-group">
                        {cityOptions.map((c) => (
                          <button key={c} type="button" className="list-group-item list-group-item-action" onClick={() => setCitySelected(c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : !citySelected ? (
                    <>
                      <input className="form-control mb-2" placeholder="Buscar cidade..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                      <div className="list-group">
                        {cityOptions.map((c) => (
                          <button key={c} type="button" className="list-group-item list-group-item-action" onClick={() => setCitySelected(c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <input className="form-control" readOnly value={citySelected} />
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowModal(false); setTelSelected(null); setCitySelected(null); setTelSearch(''); setCitySearch('') }}>Cancelar</button>
                <button className="btn btn-primary" onClick={save}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


