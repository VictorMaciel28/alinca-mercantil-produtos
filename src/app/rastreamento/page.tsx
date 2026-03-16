"use client"

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import favIcon from '@/assets/images/favcon.ico'
import IconifyIcon from '@/components/wrappers/IconifyIcon'

type TrackData = {
  numero: number
  status: string
  status_label: string
  id_nota_fiscal: string | null
  cliente: string
  cnpj: string
  vendedor: string
  produtos: Array<{
    nome: string
    codigo: string | null
    quantidade: number
    unidade: string
    valor_unitario: number
  }>
  parcelas: Array<{
    dias: number
    data: string
    valor: number
  }>
  endereco_entrega: {
    endereco?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    cep?: string
    uf?: string
  } | null
}

const STEPS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'PENDENTE', label: 'Pedido Criado', icon: 'ri:shopping-bag-3-line' },
  { key: 'APROVADO', label: 'Aprovado', icon: 'ri:checkbox-circle-line' },
  { key: 'FATURADO', label: 'Faturado', icon: 'ri:file-text-line' },
  { key: 'ENVIADO', label: 'Enviado', icon: 'ri:truck-line' },
  { key: 'ENTREGUE', label: 'Entregue', icon: 'ri:home-smile-line' },
]

export default function RastreamentoPage() {
  const [numero, setNumero] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackData | null>(null)
  const [downloading, setDownloading] = useState<'xml' | 'pdf' | null>(null)

  const currentStepIndex = useMemo(() => {
    if (!result) return -1
    const idx = STEPS.findIndex((s) => s.key === String(result.status || '').toUpperCase())
    return idx
  }, [result])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/public/rastreamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: Number(numero || 0),
          cnpj,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Pedido não encontrado')
      }
      setResult(json.data as TrackData)
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar rastreamento')
    } finally {
      setLoading(false)
    }
  }

  const downloadNota = async (tipo: 'xml' | 'pdf') => {
    if (!result?.id_nota_fiscal) return
    setDownloading(tipo)
    try {
      const res = await fetch(`/api/public/rastreamento/nota?id=${result.id_nota_fiscal}&type=${tipo}`)
      if (!res.ok) throw new Error('Falha ao baixar nota')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = tipo === 'xml' ? `nota-fiscal-${result.numero}.xml` : `nota-fiscal-${result.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f7f9fc 0%, #eef2f7 100%)' }}>
      <div className="container py-5" style={{ maxWidth: '85vw' }}>
        <div className="row justify-content-center">
          <div className="col-12">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center rounded bg-white shadow-sm" style={{ width: 64, height: 56 }}>
                    <Image src={favIcon} alt="Sistema Aliança Mercantil Atacadista" width={42} height={32} />
                  </div>
                  <div>
                    <h2 className="mb-1">Rastreamento de Pedido</h2>
                    <div className="text-muted">Sistema Aliança Mercantil Atacadista</div>
                  </div>
                </div>
                <p className="text-muted mb-4">Consulte o andamento do seu pedido usando número e CNPJ da empresa.</p>
                <form onSubmit={handleSearch}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">Número do pedido</label>
                      <input
                        className="form-control"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        placeholder="0000"
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">CNPJ</label>
                      <input
                        className="form-control"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                        {loading ? 'Consultando...' : 'Pesquisar'}
                      </button>
                    </div>
                  </div>
                </form>
                {result?.id_nota_fiscal && (
                  <div className="d-flex flex-wrap align-items-center gap-2 mt-4">
                    <div className="text-muted">Nota Fiscal:</div>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      type="button"
                      disabled={downloading === 'xml'}
                      onClick={() => downloadNota('xml')}
                    >
                      {downloading === 'xml' ? 'Baixando XML...' : 'Download XML'}
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      disabled={downloading === 'pdf'}
                      onClick={() => downloadNota('pdf')}
                    >
                      {downloading === 'pdf' ? 'Gerando PDF...' : 'Download PDF'}
                    </button>
                  </div>
                )}
                {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
              </div>
            </div>

            {result && (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between flex-wrap gap-3 mb-2">
                      <div>
                        <div className="text-muted small">Pedido</div>
                        <div className="fw-semibold">#{result.numero}</div>
                      </div>
                      <div>
                        <div className="text-muted small">Status atual</div>
                        <div className="fw-semibold">{result.status_label}</div>
                      </div>
                    </div>

                    <div
                      className="mt-3"
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}
                    >
                      {STEPS.map((step, idx) => {
                        const active = idx <= currentStepIndex
                        const isCurrent = idx === currentStepIndex
                        return (
                          <div key={step.key} className="d-flex flex-column align-items-center text-center">
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                background: active ? '#2f80ed' : '#d9e1ec',
                                boxShadow: isCurrent ? '0 0 0 8px rgba(47,128,237,.18)' : 'none',
                                transition: 'all .2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                              }}
                            >
                              <IconifyIcon icon={step.icon} className="fs-5 text-white" />
                            </div>
                            <div className="small mt-2" style={{ color: active ? '#1f2937' : '#8a94a6' }}>
                              {step.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="mb-3">Detalhes do pedido</h5>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <div className="text-muted small">Cliente</div>
                        <div className="fw-semibold">{result.cliente}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="text-muted small">Vendedor</div>
                        <div className="fw-semibold">{result.vendedor}</div>
                      </div>
                    </div>

                    <h6 className="mb-2">Produtos</h6>
                    <div className="table-responsive mb-4">
                      <table className="table table-sm table-striped mb-0">
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Código</th>
                            <th>Qtd</th>
                            <th>Valor unit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.produtos.map((p, i) => (
                            <tr key={`${p.nome}-${i}`}>
                              <td>{p.nome}</td>
                              <td>{p.codigo || '-'}</td>
                              <td>{p.quantidade} {p.unidade}</td>
                              <td>{p.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h6 className="mb-2">Parcelas</h6>
                    <div className="table-responsive mb-4">
                      <table className="table table-sm table-striped mb-0">
                        <thead>
                          <tr>
                            <th>Dias</th>
                            <th>Data</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.parcelas.length > 0 ? (
                            result.parcelas.map((p, i) => (
                              <tr key={`${p.data}-${i}`}>
                                <td>{p.dias}</td>
                                <td>{p.data}</td>
                                <td>{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={3} className="text-muted">Sem parcelas disponíveis</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h6 className="mb-2">Endereço de entrega</h6>
                    {result.endereco_entrega ? (
                      <div className="text-muted">
                        {result.endereco_entrega.endereco || ''}, {result.endereco_entrega.numero || ''}{' '}
                        {result.endereco_entrega.complemento ? `- ${result.endereco_entrega.complemento}` : ''}<br />
                        {result.endereco_entrega.bairro || ''} - {result.endereco_entrega.cidade || ''}/{result.endereco_entrega.uf || ''}<br />
                        CEP: {result.endereco_entrega.cep || '-'}
                      </div>
                    ) : (
                      <div className="text-muted">Endereço não informado</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

