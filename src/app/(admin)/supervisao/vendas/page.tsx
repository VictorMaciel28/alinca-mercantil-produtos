"use client"

import { useEffect, useMemo, useState } from 'react'

type OrderRow = {
  numero: number
  data: string
  cliente: string
  cnpj: string
  total: number
  vendedor_externo?: string | null
  vendedor_nome?: string | null
  status: string
}

export default function SupervisaoVendasPage() {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [vendors, setVendors] = useState<{ externo: string; nome: string }[]>([])
  const [vendFilter, setVendFilter] = useState<string>('')
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (vendFilter) params.set('vendedor_externo', vendFilter)
      if (start) params.set('start', start)
      if (end) params.set('end', end)
      const res = await fetch(`/api/supervisao/vendas${params.toString() ? `?${params.toString()}` : ''}`)
      const json = await res.json()
      if (json?.ok) {
        setRows(json.data || [])
        setVendors(json.vendors || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // default to current month
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1).toISOString().slice(0, 10)
    const last = new Date(y, m + 1, 0).toISOString().slice(0, 10)
    setStart(first)
    setEnd(last)
  }, [])

  useEffect(() => {
    if (start && end) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendFilter, start, end])

  const data = useMemo(() => rows, [rows])
  const totalSum = useMemo(() => data.reduce((acc, r) => acc + (r.total || 0), 0), [data])

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Supervisão • Vendas</h2>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Vendedor</label>
              <select className="form-select" value={vendFilter} onChange={(e) => setVendFilter(e.target.value)}>
                <option value="">Todos os supervisionados</option>
                {vendors.map((v) => (
                  <option key={v.externo} value={v.externo}>
                    {v.nome} ({v.externo})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Data inicial</label>
              <input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Data final</label>
              <input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped table-hover">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.numero}>
                  <td>{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                  <td>{r.numero}</td>
                  <td>{r.cliente}</td>
                  <td>{r.vendedor_nome || r.vendedor_externo || '-'}</td>
                  <td>{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-end fw-semibold">Total</td>
                <td className="fw-semibold">{totalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

