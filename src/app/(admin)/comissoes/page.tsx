"use client"

import { useEffect, useMemo, useState } from 'react'

type Linha = {
  id: number
  role: 'VENDEDOR' | 'TELEVENDAS'
  percent: number
  amount: number
  created_at: string
  order_num: number
  order?: {
    numero: number
    data: string
    cliente: string
    cnpj: string
    total: number
    status: string
  } | null
  order_vendor?: { externo: string; nome?: string | null } | null
  client_vendor?: { externo: string; nome?: string | null } | null
}

export default function ComissoesPage() {
  const [rows, setRows] = useState<Linha[]>([])
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'VENDEDOR' | 'TELEVENDAS' | ''>('')
  const [vendorsAll, setVendorsAll] = useState<{ externo: string; nome: string; tipo?: 'VENDEDOR' | 'TELEVENDAS' | null }[]>([])
  const [vendorExterno, setVendorExterno] = useState<string>('')
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const [reportVend, setReportVend] = useState<{ externo: string; nome: string | null; num_pedidos: number; total: number }[]>([])
  const [reportTel, setReportTel] = useState<{ externo: string; nome: string | null; num_pedidos: number; total: number }[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (vendorExterno) params.set('vendor_externo', vendorExterno)
      if (start) params.set('start', start)
      if (end) params.set('end', end)

      const res = await fetch(`/api/comissoes${params.toString() ? `?${params.toString()}` : ''}`)
      const json = await res.json()
      if (json?.ok) setRows(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Default: current month
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1).toISOString().slice(0, 10)
    const last = new Date(y, m + 1, 0).toISOString().slice(0, 10)
    setStart(first)
    setEnd(last)

    // Load vendors for filter
    ;(async () => {
      try {
        const res = await fetch('/api/vendedores')
        const json = await res.json()
        if (json?.ok) {
          const opts = (json.data || [])
            .filter((v: any) => !!v.id_vendedor_externo)
            .map((v: any) => ({
              externo: v.id_vendedor_externo as string,
              nome: v.nome as string,
              tipo: (v.tipo_acesso as any) || null,
            }))
          setVendorsAll(opts)
        }
      } catch {}
    })()
  }, [])

  // When role changes, clear vendor if it doesn't match the filtered options
  const vendorOptions = useMemo(() => {
    if (!role) return vendorsAll
    return vendorsAll.filter((v) => v.tipo === role)
  }, [vendorsAll, role])

  useEffect(() => {
    if (vendorExterno && !vendorOptions.some((v) => v.externo === vendorExterno)) {
      setVendorExterno('')
    }
  }, [role, vendorOptions, vendorExterno])

  // Auto reload on filter change (after dates are initialized)
  useEffect(() => {
    if (start && end) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, vendorExterno, start, end])

  const data = useMemo(() => rows, [rows])
  const totalAmount = useMemo(() => data.reduce((acc, r) => acc + (r.amount || 0), 0), [data])
  const totalReportVend = useMemo(() => reportVend.reduce((acc, r) => acc + (r.total || 0), 0), [reportVend])
  const totalReportTel = useMemo(() => reportTel.reduce((acc, r) => acc + (r.total || 0), 0), [reportTel])

  const runReport = async () => {
    setReportLoading(true)
    try {
      const params = new URLSearchParams()
      if (vendorExterno) params.set('vendor_externo', vendorExterno)
      if (start) params.set('start', start)
      if (end) params.set('end', end)
      const res = await fetch(`/api/relatorios/vendas-por-vendedor?${params.toString()}`)
      const json = await res.json()
      if (json?.ok) {
        if (json?.vendedores && json?.televendas) {
          setReportVend(json.vendedores)
          setReportTel(json.televendas)
        } else {
          // backward compat if role provided (not required anymore)
          const arr = json.data || []
          // heuristic: if role selected, decide bucket; else put into vendedores
          if (role === 'TELEVENDAS') {
            setReportVend([])
            setReportTel(arr)
          } else {
            setReportVend(arr)
            setReportTel([])
          }
        }
        setShowReport(true)
      }
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="m-0">Comissões</h2>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-2">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="">Todos</option>
                <option value="VENDEDOR">Vendedor</option>
                <option value="TELEVENDAS">Televendas</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Vendedor</label>
              <select className="form-select" value={vendorExterno} onChange={(e) => setVendorExterno(e.target.value)}>
                <option value="">Todos</option>
                {vendorOptions.map((v) => (
                  <option key={v.externo} value={v.externo}>
                    {v.nome} ({v.externo})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Data inicial</label>
              <input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Data final</label>
              <div className="d-flex align-items-center">
                <input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
                <button className="btn btn-primary ms-2 text-nowrap" onClick={runReport} disabled={reportLoading}>
                  {reportLoading ? 'Gerando...' : 'Relatório Geral'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>



      {showReport && (
        <div className="modal d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Relatório Geral de Vendas por Vendedor</h5>
                <button type="button" className="btn-close" onClick={() => setShowReport(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {reportVend.length > 0 && (
                  <div className="table-responsive mb-4">
          <h5 className="mb-2">Vendedores</h5>
                    <table className="table table-sm table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Vendedor</th>
                          <th>ID Externo</th>
                <th>Registros</th>
                <th>Total Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportVend.map((r) => (
                          <tr key={r.externo}>
                            <td>{r.nome || '-'}</td>
                            <td>{r.externo}</td>
                  <td>{(r as any).num_registros ?? (r as any).num_pedidos ?? 0}</td>
                            <td>{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="text-end fw-semibold">Total</td>
                          <td className="fw-semibold">{totalReportVend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {reportTel.length > 0 && (
                  <div className="table-responsive mb-2">
          <h5 className="mb-2">Televendas</h5>
                    <table className="table table-sm table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Televendas</th>
                          <th>ID Externo</th>
                <th>Registros</th>
                <th>Total Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportTel.map((r) => (
                          <tr key={r.externo}>
                            <td>{r.nome || '-'}</td>
                            <td>{r.externo}</td>
                  <td>{(r as any).num_registros ?? (r as any).num_pedidos ?? 0}</td>
                            <td>{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="text-end fw-semibold">Total</td>
                          <td className="fw-semibold">{totalReportTel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReport(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <th>Vendedor do Pedido</th>
                <th>Vendedor Pertencente</th>
                <th>Tipo</th>
                <th>%</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{r.order?.numero ?? r.order_num}</td>
                  <td>{r.order?.cliente ?? '-'}</td>
                  <td>{r.order_vendor ? (r.order_vendor.nome || r.order_vendor.externo) : '-'}</td>
                  <td>{r.client_vendor ? (r.client_vendor.nome || r.client_vendor.externo) : '-'}</td>
                  <td>{r.role === 'TELEVENDAS' ? 'Televendas' : 'Vendedor'}</td>
                  <td>{r.percent}%</td>
                  <td>{r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="text-end fw-semibold">Total</td>
                <td className="fw-semibold">{totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}


