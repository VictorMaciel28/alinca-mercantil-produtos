"use client";

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageTitle from '@/components/PageTitle'
import { Card, Row, Col, Form, Button, Table, Modal, Spinner } from 'react-bootstrap'
import { getPedidoByNumero, savePedido, Pedido, PedidoStatus, getNextPedidoNumero } from '@/services/pedidos'
import IconifyIcon from '@/components/wrappers/IconifyIcon'

export default function PedidoFormPage() {
  const params = useParams()
  const router = useRouter()
  const idParam = useMemo(() => Number(params?.id ?? 0), [params])
  const isNew = idParam === 0

  const [form, setForm] = useState<Pedido>({
    numero: 0,
    data: new Date().toISOString().slice(0, 10),
    cliente: '',
    cnpj: '',
    total: 0,
    status: 'Pendente',
  })

  const [formaRecebimento, setFormaRecebimento] = useState('Boleto')
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [descontoPercent, setDescontoPercent] = useState<number>(0)

  type ItemPedido = { id: number; nome: string; sku?: string; quantidade: number; unidade: string; preco: number; estoque?: number; produtoId?: number; imagemUrl?: string }
  const [itens, setItens] = useState<ItemPedido[]>([
    { id: 1, nome: '', quantidade: 1, unidade: 'PC', preco: 0 },
  ])

  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  // Histórico de produtos
  type HistoryItem = {
    id: number
    pedido_id: number
    produto_id: number
    codigo: string | null
    nome: string | null
    preco: string | number | null
    quantidade: string | number
    created_at: string
    tiny_orders?: { cliente_nome?: string | null; numero_pedido?: string | null }
  }
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

  type Suggestion = { id: number; nome: string; codigo?: string }
  const [suggestionsByItem, setSuggestionsByItem] = useState<Record<number, Suggestion[]>>({})
  const [showSuggestForItem, setShowSuggestForItem] = useState<Record<number, boolean>>({})
  const debounceTimers = useRef<Record<number, any>>({})

  // Sugestões de clientes
  type ClientSuggestion = { id: number; nome: string; cpf_cnpj?: string }
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([])
  const [showClientSuggest, setShowClientSuggest] = useState<boolean>(false)
  const clientDebounceRef = useRef<any>(null)

  // Submissão Tiny
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const formatDateBR = (isoOrDate: string | Date) => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const toTinyDecimal = (num: number) => {
    return Number(num ?? 0).toFixed(2).replace(/,/g, '.')
  }

  const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

  const addItem = () => {
    setItens((arr) => {
      const nextId = arr.reduce((m, it) => Math.max(m, it.id), 0) + 1
      return [...arr, { id: nextId, nome: '', quantidade: 1, unidade: 'PC', preco: 0 }]
    })
  }

  const removeItem = (id: number) => {
    setItens((arr) => arr.filter((it) => it.id !== id))
  }

  useEffect(() => {
    if (!isNew) {
      const existing = getPedidoByNumero(idParam)
      if (existing) {
        setForm(existing)
      }
    } else {
      setForm((f) => ({ ...f, numero: 0 }))
    }
  }, [idParam, isNew])

  const handleChange = (key: keyof Pedido, value: string | number | PedidoStatus) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onClienteChange = (value: string) => {
    setForm((f) => ({ ...f, cliente: value }))
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    const trimmed = value.trim()
    if (trimmed.length >= 3) {
      clientDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/contatos?q=${encodeURIComponent(trimmed)}`)
          const data = await res.json()
          const options: ClientSuggestion[] = (data?.retorno?.contatos || []).map((c: any) => ({
            id: Number(c?.contato?.id ?? 0),
            nome: c?.contato?.nome || c?.contato?.nome_fantasia || c?.contato?.razao_social || '',
            cpf_cnpj: c?.contato?.cpf_cnpj || c?.contato?.cnpj || c?.contato?.cpf || '',
          })).filter((c: ClientSuggestion) => !!c.nome)
          setClientSuggestions(options)
          setShowClientSuggest(options.length > 0)
        } catch (e) {
          setClientSuggestions([])
          setShowClientSuggest(false)
        }
      }, 1000)
    } else {
      setShowClientSuggest(false)
      setClientSuggestions([])
    }
  }

  const selectCliente = (opt: ClientSuggestion) => {
    setForm((f) => ({ ...f, cliente: opt.nome, cnpj: opt.cpf_cnpj || '' }))
    setShowClientSuggest(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      // Monta payload Tiny
      const cpfCnpjDigits = onlyDigits(form.cnpj)
      const tipoPessoa = cpfCnpjDigits.length === 11 ? 'F' : (cpfCnpjDigits.length === 14 ? 'J' : '')

      const tinyItens = itens
        .filter((it) => (it.nome || '').trim() && it.quantidade > 0)
        .map((it) => ({
          item: {
            ...(it.produtoId ? { id_produto: it.produtoId } : {}),
            ...(it.sku ? { codigo: it.sku } : {}),
            descricao: it.nome,
            unidade: it.unidade,
            quantidade: toTinyDecimal(it.quantidade),
            valor_unitario: toTinyDecimal(it.preco || 0),
          },
        }))

      const descontoValor = Math.max(0, (itens.reduce((acc, it) => acc + (it.quantidade * (it.preco || 0)), 0)) - (totalComDesconto || 0))

      const tinyParcelas = parcelas.length > 0
        ? parcelas.map((p) => ({ parcela: { data: formatDateBR(p.data), valor: toTinyDecimal(p.valor) } }))
        : undefined

      const tinyPedido: any = {
        data_pedido: form.data ? formatDateBR(form.data) : formatDateBR(new Date()),
        cliente: {
          nome: form.cliente,
          ...(cpfCnpjDigits ? { cpf_cnpj: cpfCnpjDigits } : {}),
          ...(tipoPessoa ? { tipo_pessoa: tipoPessoa } : {}),
          atualizar_cliente: 'S',
        },
        itens: tinyItens,
        ...(descontoValor > 0 ? { valor_desconto: toTinyDecimal(descontoValor) } : {}),
        ...(tinyParcelas ? { parcelas: tinyParcelas } : {}),
        ...(formaRecebimento ? { meio_pagamento: formaRecebimento } : {}),
        nome_vendedor: 'Daniel Meirelles',
      }

      const res = await fetch('/api/pedidos/incluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: tinyPedido }),
      })
      const data = await res.json()

      if (!res.ok || (data?.retorno?.status && data.retorno.status !== 'OK')) {
        const msg = data?.retorno?.erros?.map((e: any) => e?.erro)?.join('; ') || data?.erro || 'Falha ao incluir pedido'
        setSubmitError(msg)
      } else {
        // Sucesso também no Tiny: mantém fluxo local
        const saved = savePedido(form)
        router.push(`/pedidos/${saved.numero}`)
        return
      }
    } catch (err: any) {
      setSubmitError('Erro inesperado ao enviar o pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const subtotal = useMemo(() => {
    return itens.reduce((acc, it) => acc + (it.quantidade * (it.preco || 0)), 0)
  }, [itens])

  const descontoHabilitado = useMemo(() => {
    if (formaRecebimento === 'Pix') return true
    if (formaRecebimento === 'Boleto' && condicaoPagamento === '7 dias') return true
    return false
  }, [formaRecebimento, condicaoPagamento])

  const totalComDesconto = useMemo(() => {
    const perc = descontoHabilitado ? Math.min(2, Math.max(0, descontoPercent)) : 0
    const tot = subtotal * (1 - perc / 100)
    return tot < 0 ? 0 : tot
  }, [subtotal, descontoPercent, descontoHabilitado])

  const condicoesBoleto = [
    '7 dias',
    '28, 42 e 56',
    '28, 35, 42, 49 e 56',
    '21, 28, 35',
    '21, 28, 45, 42, 49, 56, 63',
  ]

  const condicoesPagamentoOptions = useMemo(() => {
    if (formaRecebimento === 'Boleto') return condicoesBoleto
    return ['À vista']
  }, [formaRecebimento])

  const diasParcelas: number[] = useMemo(() => {
    if (formaRecebimento !== 'Boleto') return []
    if (!condicaoPagamento) return []
    if (condicaoPagamento === '7 dias') return [7]
    const matches = condicaoPagamento.match(/\d+/g) || []
    return matches.map((d) => Number(d)).filter((n) => !isNaN(n))
  }, [formaRecebimento, condicaoPagamento])

  const parcelas = useMemo(() => {
    if (formaRecebimento !== 'Boleto' || diasParcelas.length === 0) return []
    const baseDate = new Date(form.data || new Date().toISOString().slice(0, 10))
    const qtd = diasParcelas.length
    const valorParcela = qtd > 0 ? totalComDesconto / qtd : 0
    return diasParcelas.map((dias, idx) => {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + dias)
      return { numero: idx + 1, data: d, valor: valorParcela }
    })
  }, [diasParcelas, totalComDesconto, form.data, formaRecebimento])

  const onNomeChange = (itemId: number, value: string) => {
    setItens((arr) => arr.map((it) => it.id === itemId ? { ...it, nome: value } : it))
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId])
    }
    const trimmed = value.trim()
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length
    if (wordCount >= 3 || trimmed.length >= 3) {
      debounceTimers.current[itemId] = setTimeout(async () => {
        try {
          const res = await fetch(`/api/produtos?q=${encodeURIComponent(value)}`)
          const data = await res.json()
          const options: Suggestion[] = (data?.retorno?.produtos || []).map((p: any) => ({ id: Number(p.produto.id), nome: p.produto.nome, codigo: p.produto.codigo }))
          setSuggestionsByItem((prev) => ({ ...prev, [itemId]: options }))
          setShowSuggestForItem((prev) => ({ ...prev, [itemId]: true }))
        } catch (e) {
          setSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }))
          setShowSuggestForItem((prev) => ({ ...prev, [itemId]: false }))
        }
      }, 1000)
    } else {
      setShowSuggestForItem((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  const selectProduto = async (itemId: number, produtoId: number) => {
    try {
      const [prodRes, estoqueRes] = await Promise.all([
        fetch(`/api/produtos/${produtoId}`),
        fetch(`/api/produtos/${produtoId}/estoque`),
      ])
      const prod = await prodRes.json()
      const est = await estoqueRes.json()
      setItens((arr) => arr.map((it) => it.id === itemId ? {
        ...it,
        produtoId,
        nome: prod?.nome || it.nome,
        sku: prod?.codigo || it.sku,
        unidade: prod?.unidade || it.unidade,
        preco: Number(prod?.preco || 0),
        estoque: Number(est?.totalEstoque ?? 0),
        imagemUrl: prod?.imagem || it.imagemUrl,
      } : it))
      setShowSuggestForItem((prev) => ({ ...prev, [itemId]: false }))
    } catch (e) {
      // ignore
    }
  }

  const openHistory = async () => {
    if (!form.cliente || !form.cliente.trim()) {
      setHistoryError('Informe o cliente para ver o histórico')
      setShowHistory(true)
      return
    }
    setShowHistory(true)
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch(`/api/historico-produtos?cliente=${encodeURIComponent(form.cliente)}`)
      const data = await res.json()
      if (!res.ok || data?.erro) {
        setHistoryError(data?.erro || 'Falha ao carregar histórico')
        setHistoryItems([])
      } else {
        setHistoryItems(Array.isArray(data.items) ? data.items : [])
      }
    } catch (e) {
      setHistoryError('Erro ao carregar histórico')
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeHistory = () => {
    setShowHistory(false)
  }

  const getRowVariantByDate = (iso: string) => {
    const now = new Date()
    const dt = new Date(iso)
    const ms = now.getTime() - dt.getTime()
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    if (days <= 30) return 'success'
    if (days <= 90) return 'warning'
    return 'danger'
  }

  return (
    <>
      <PageTitle title={isNew ? `Pedido de venda ${getNextPedidoNumero()}` : `Pedido de venda ${form.numero}`} subName={isNew ? 'Criação' : 'Edição'} />

      {/* Sessão 1 - Cliente e Vendedor */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Header className="bg-white fw-semibold">Dados do cliente</Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col lg={6}>
              <Form.Label>Cliente</Form.Label>
              <div className="position-relative">
                <Form.Control
                  type="text"
                  placeholder="Pesquise pelo nome da empresa ou CNPJ"
                  value={form.cliente}
                  onChange={(e) => onClienteChange(e.target.value)}
                />
                {showClientSuggest && clientSuggestions.length > 0 && (
                  <div className="border rounded bg-white shadow position-absolute w-100 mt-1" style={{ zIndex: 2000, maxHeight: 300, overflowY: 'auto' }}>
                    {clientSuggestions.map((opt) => (
                      <div
                        key={opt.id}
                        className="px-2 py-1 hover-bg"
                        style={{ cursor: 'pointer' }}
                        onClick={() => selectCliente(opt)}
                      >
                        <div className="fw-semibold small">{opt.nome}</div>
                        <div className="text-muted small">{opt.cpf_cnpj || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Col>
            <Col lg={3}>
              <Form.Label>Vendedor</Form.Label>
              <Form.Control type="text" value="Daniel Meirelles" disabled />
            </Col>
            <Col lg={3} className="d-flex justify-content-lg-end">
              {/* <Button variant="outline-primary" onClick={() => router.push('/customers/add')}>
                Cadastrar Cliente
              </Button> */}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Sessão 2 - Produtos */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <div className="fw-semibold">Produtos</div>
          <Button size="sm" variant="outline-primary" onClick={addItem}>
            <IconifyIcon icon="ri:add-line" className="me-1" /> Adicionar produto
          </Button>
        </Card.Header>
        <Card.Body>
          {/* Desktop (md+) */}
          <div className="table-responsive d-none d-md-block" style={{ overflow: 'visible' }}>
            <Table hover className="mb-0">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>N°</th>
                  <th style={{ minWidth: 360 }}>Nome</th>
                  <th style={{ width: 120 }}>SKU</th>
                  <th style={{ width: 100 }}>Qtde</th>
                  <th style={{ width: 90 }}>Unidade</th>
                  <th style={{ width: 100 }}>Estoque</th>
                  <th style={{ width: 130 }}>Preço un</th>
                  <th style={{ width: 150 }}>Total</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => {
                  const totalItem = item.quantidade * item.preco
                  return (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="position-relative">
                          <div className="d-flex gap-2 align-items-center">
                            {item.imagemUrl ? (
                              <img
                                src={item.imagemUrl}
                                alt="Produto"
                                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                                onClick={() => { setPreviewUrl(item.imagemUrl || null); setShowPreview(true) }}
                                className="flex-shrink-0"
                              />
                            ) : null}
                            <Form.Control
                              type="text"
                              placeholder="Pesquise por descrição ou código SKU"
                              value={item.nome}
                              onChange={(e) => onNomeChange(item.id, e.target.value)}
                              className="flex-grow-1"
                            />
                            {/* <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => setShowSearch(true)}
                              title="Buscar produto"
                            >
                              <IconifyIcon icon="ri:search-line" />
                            </Button> */}
                          </div>
                          {showSuggestForItem[item.id] && (suggestionsByItem[item.id]?.length ?? 0) > 0 && (
                            <div className="border rounded bg-white shadow position-absolute w-100 mt-1" style={{ zIndex: 2000, maxHeight: 300, overflowY: 'auto' }}>
                              {suggestionsByItem[item.id].map((opt) => (
                                <div
                                  key={opt.id}
                                  className="px-2 py-1 hover-bg"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => selectProduto(item.id, opt.id)}
                                >
                                  <div className="fw-semibold small">{opt.nome}</div>
                                  <div className="text-muted small">SKU: {opt.codigo || '-'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <Form.Control type="text" value={item.sku || ''} placeholder="SKU" disabled />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value))
                            setItens((arr) => arr.map((it) => it.id === item.id ? { ...it, quantidade: v } : it))
                          }}
                        />
                      </td>
                      <td>
                        <Form.Control type="text" value={item.unidade} disabled />
                      </td>
                      <td>
                        <Form.Control type="text" value={item.estoque ?? 0} disabled />
                      </td>
                      <td>
                        <Form.Control type="text" value={item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
                      </td>
                      <td>
                        <Form.Control type="text" value={totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <Button variant="outline-danger" size="sm" onClick={() => removeItem(item.id)} title="Remover">
                            <IconifyIcon icon="ri:delete-bin-line" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>

          {/* Mobile (sm) - Itens empilhados */}
          <div className="d-block d-md-none">
            {itens.map((item, idx) => {
              const totalItem = item.quantidade * item.preco
              return (
                <div key={item.id} className="border rounded p-2 mb-2">
                  <div className="small text-muted">N° {idx + 1}</div>
                  <Form.Group className="mt-1">
                    <Form.Label className="mb-1">Nome</Form.Label>
                    <div className="d-flex gap-2 align-items-center">
                      {item.imagemUrl ? (
                        <img
                          src={item.imagemUrl}
                          alt="Produto"
                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => { setPreviewUrl(item.imagemUrl || null); setShowPreview(true) }}
                          className="flex-shrink-0"
                        />
                      ) : null}
                      <Form.Control
                        type="text"
                        placeholder="Pesquise por descrição ou código SKU"
                        value={item.nome}
                        onChange={(e) => onNomeChange(item.id, e.target.value)}
                        className="flex-grow-1"
                      />
                      {/* <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setShowSearch(true)}
                        title="Buscar produto"
                      >
                        <IconifyIcon icon="ri:search-line" />
                      </Button> */}
                    </div>
                    {showSuggestForItem[item.id] && (suggestionsByItem[item.id]?.length ?? 0) > 0 && (
                      <div className="border rounded bg-white shadow mt-1" style={{ zIndex: 10 }}>
                        {suggestionsByItem[item.id].map((opt) => (
                          <div
                            key={opt.id}
                            className="px-2 py-1 hover-bg"
                            style={{ cursor: 'pointer' }}
                            onClick={() => selectProduto(item.id, opt.id)}
                          >
                            <div className="fw-semibold small">{opt.nome}</div>
                            <div className="text-muted small">SKU: {opt.codigo || '-'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Form.Group>
                  <Row className="g-2 mt-1">
                    <Col xs={6}>
                      <Form.Label className="mb-1">SKU</Form.Label>
                      <Form.Control type="text" value={item.sku || ''} disabled />
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Estoque</Form.Label>
                      <Form.Control type="text" value={item.estoque ?? 0} disabled />
                    </Col>
                  </Row>
                  <Row className="g-2 mt-1">
                    <Col xs={6}>
                      <Form.Label className="mb-1">Qtde</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value))
                          setItens((arr) => arr.map((it) => it.id === item.id ? { ...it, quantidade: v } : it))
                        }}
                      />
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Unidade</Form.Label>
                      <Form.Control type="text" value={item.unidade} disabled />
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Preço un</Form.Label>
                      <Form.Control type="text" value={item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Total</Form.Label>
                      <Form.Control type="text" value={totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
                    </Col>
                  </Row>
                  {/* <div className="d-flex justify-content-end gap-2 mt-2">
                    <Button variant="outline-secondary" size="sm" onClick={() => { setPreviewUrl(item.imagemUrl || null); setShowPreview(true) }} title="Ver imagem">
                      <IconifyIcon icon="ri:image-line" />
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => removeItem(item.id)} title="Remover">
                      <IconifyIcon icon="ri:delete-bin-line" />
                    </Button>
                  </div> */}
                </div>
              )
            })}
          </div>

          <div className="d-flex justify-content-start mt-3">
            <Button
              variant="link"
              className="p-0 text-primary"
              style={{ textDecoration: 'underline' }}
              onClick={openHistory}
            >
              Histórico de produtos
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Sessão 3 - Pagamento */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white fw-semibold">Pagamento</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label>Data da venda</Form.Label>
                <Form.Control type="date" value={form.data} onChange={(e) => handleChange('data', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>Forma de recebimento</Form.Label>
                <Form.Select value={formaRecebimento} onChange={(e) => { setFormaRecebimento(e.target.value); setCondicaoPagamento(''); setDescontoPercent(0) }}>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Condição de pagamento</Form.Label>
                <Form.Select value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)}>
                  {condicoesPagamentoOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <Row className="g-3 mt-1">
              <Col md={4}>
                <Form.Label>Subtotal</Form.Label>
                <Form.Control type="text" value={subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
              </Col>
              <Col md={4}>
                <Form.Label>Desconto (%)</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={2}
                  step={0.01}
                  disabled={!descontoHabilitado}
                  value={descontoHabilitado ? descontoPercent : 0}
                  onChange={(e) => setDescontoPercent(Math.min(2, Math.max(0, Number(e.target.value))))}
                />
                {descontoHabilitado ? (
                  <small className="text-muted">Máx. 2%</small>
                ) : (
                  <small className="text-muted">Desconto disponível para Pix ou Boleto 7 dias</small>
                )}
              </Col>
              <Col md={4}>
                <Form.Label>Total do Pedido</Form.Label>
                <Form.Control type="text" value={totalComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled />
              </Col>
            </Row>

            {formaRecebimento === 'Boleto' && parcelas.length > 0 && (
              <div className="mt-3">
                <div className="fw-semibold mb-2">Parcelas</div>
                <div className="table-responsive">
                  <Table size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th>Parcela</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((p) => (
                        <tr key={p.numero}>
                          <td>{p.numero}</td>
                          <td>{p.data.toLocaleDateString('pt-BR')}</td>
                          <td>{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

            <div className="d-flex gap-2 mt-4">
              <Button type="submit">Enviar Pedido</Button>
              <Button variant="secondary" onClick={() => router.push('/pedidos')}>Cancelar</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Modal show={showPreview} onHide={() => setShowPreview(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Pré-visualização</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Pré-visualização" className="img-fluid" />
            ) : (
              <div className="text-muted">Sem imagem disponível</div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSearch} onHide={() => setShowSearch(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Buscar produto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Em breve: busca de produtos por descrição, SKU ou código.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSearch(false)}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showHistory} onHide={closeHistory} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Histórico de produtos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historyLoading ? (
            <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /><span>Carregando histórico...</span></div>
          ) : historyError ? (
            <div className="text-danger small">{historyError}</div>
          ) : historyItems.length === 0 ? (
            <div className="text-muted small">Nenhum histórico encontrado para este cliente.</div>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Data da venda</th>
                    <th style={{ width: 140 }}>Código (SKU)</th>
                    <th>Nome</th>
                    <th style={{ width: 120 }}>Preço</th>
                    <th style={{ width: 100 }}>Qtd</th>
                    <th style={{ width: 140 }}>Nº Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((h) => {
                    const variant = getRowVariantByDate(h.created_at)
                    const precoNum = typeof h.preco === 'string' ? Number(h.preco) : (h.preco || 0)
                    const qtdNum = typeof h.quantidade === 'string' ? Number(h.quantidade) : h.quantidade
                    return (
                      <tr key={h.id} className={`table-${variant}`}>
                        <td>{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>{h.codigo || '-'}</td>
                        <td>{h.nome || '-'}</td>
                        <td>{Number(precoNum || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td>{Number(qtdNum || 0)}</td>
                        <td>{h.tiny_orders?.numero_pedido || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeHistory}>Fechar</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}


