"use client"

import { useEffect, useMemo, useState } from 'react'

type Supervisor = {
  id: number
  id_vendedor_externo: string
  nome?: string | null
  supervised: { vendedor_externo: string; nome?: string | null }[]
}

type Vendedor = { id: number; id_vendedor_externo?: string | null; nome: string }

export default function SupervisoresPage() {
  const [supers, setSupers] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supervisor | null>(null)
  const [vendAll, setVendAll] = useState<Vendedor[]>([])
  const [supSearch, setSupSearch] = useState('')
  const [supSelected, setSupSelected] = useState<{ externo: string; nome: string } | null>(null)
  const [vendSearch, setVendSearch] = useState('')
  const [vendSelected, setVendSelected] = useState<{ externo: string; nome: string }[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([fetch('/api/supervisores'), fetch('/api/vendedores')])
      const j1 = await r1.json()
      const j2 = await r2.json()
      if (j1?.ok) setSupers(j1.data)
      if (j2?.ok) setVendAll(j2.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setEditing(null)
    setSupSelected(null)
    setVendSelected([])
    setSupSearch('')
    setVendSearch('')
    setShowModal(true)
  }

  const openEdit = (s: Supervisor) => {
    setEditing(s)
    setSupSelected({ externo: s.id_vendedor_externo, nome: s.nome || s.id_vendedor_externo })
    setVendSelected(s.supervised.map((x) => ({ externo: x.vendedor_externo, nome: x.nome || x.vendedor_externo })))
    setSupSearch('')
    setVendSearch('')
    setShowModal(true)
  }

  const supervisorOptions = useMemo(() => {
    const q = supSearch.trim().toLowerCase()
    if (!q) return []
    return vendAll
      .filter((v) => (v.id_vendedor_externo || '') && (!q || v.nome.toLowerCase().includes(q)))
      .slice(0, 10)
      .map((v) => ({ externo: v.id_vendedor_externo as string, nome: v.nome }))
  }, [vendAll, supSearch])

  const vendedorOptions = useMemo(() => {
    const q = vendSearch.trim().toLowerCase()
    const selectedSet = new Set(vendSelected.map((s) => s.externo))
    if (!q) return []
    return vendAll
      .filter((v) => (v.id_vendedor_externo || '') && (!q || v.nome.toLowerCase().includes(q)))
      .filter((v) => !selectedSet.has(v.id_vendedor_externo as string))
      .slice(0, 10)
      .map((v) => ({ externo: v.id_vendedor_externo as string, nome: v.nome }))
  }, [vendAll, vendSearch, vendSelected])

  const addVendedor = (opt: { externo: string; nome: string }) => {
    setVendSelected((prev) => [...prev, opt])
    setVendSearch('')
  }

  const removeVendedor = (externo: string) => {
    setVendSelected((prev) => prev.filter((v) => v.externo !== externo))
  }

  const save = async () => {
    if (!supSelected) return alert('Selecione um supervisor')
    const payload = {
      supervisor_externo: supSelected.externo,
      supervisor_nome: supSelected.nome,
      supervised: vendSelected.map((v) => v.externo),
    }
    const res = await fetch('/api/supervisores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!json?.ok) return alert(json?.error || 'Erro ao salvar supervisor')
    setShowModal(false)
    await load()
  }

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Supervisores</h2>
        <button className="btn btn-primary" onClick={openNew}>Novo Supervisor</button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Supervisor (ID Externo)</th>
                <th>Nome</th>
                <th>Vendedores supervisionados</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {supers.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(s)}>
                  <td>{s.id_vendedor_externo}</td>
                  <td>{s.nome || '-'}</td>
                  <td>{s.supervised.map((v) => v.nome || v.vendedor_externo).join(', ') || '-'}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-danger"
                      title="Excluir"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('Deseja excluir este supervisor?')) return
                        const res = await fetch('/api/supervisores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) })
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
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editing ? 'Editar Supervisor' : 'Novo Supervisor'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Supervisor (digite para buscar e selecione)</label>
                  {!supSelected ? (
                    <>
                      <input className="form-control mb-2" placeholder="Buscar vendedor..." value={supSearch} onChange={(e) => setSupSearch(e.target.value)} />
                      <div className="list-group">
                        {supervisorOptions.map((opt) => (
                          <button key={opt.externo} type="button" className="list-group-item list-group-item-action" onClick={() => setSupSelected(opt)}>
                            {opt.nome} <span className="text-muted">({opt.externo})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <input className="form-control" readOnly value={`${supSelected.nome} (${supSelected.externo})`} />
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label">Vendedores Supervisionados</label>
                  <input className="form-control mb-2" placeholder="Buscar vendedor..." value={vendSearch} onChange={(e) => setVendSearch(e.target.value)} />
                  <div className="list-group mb-2">
                    {vendedorOptions.map((opt) => (
                      <button key={opt.externo} type="button" className="list-group-item list-group-item-action" onClick={() => addVendedor(opt)}>
                        {opt.nome} <span className="text-muted">({opt.externo})</span>
                      </button>
                    ))}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {vendSelected.map((v) => (
                      <span key={v.externo} className="badge bg-primary d-flex align-items-center gap-2">
                        {v.nome} ({v.externo})
                        <button className="btn btn-sm btn-light ms-2" onClick={() => removeVendedor(v.externo)}>x</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={save}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


