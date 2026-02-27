"use client";

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import PageTitle from '@/components/PageTitle'
import { Card, Row, Col, Form, Button, Table, Modal, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { getPedidoByNumero, Pedido, PedidoStatus, getNextPedidoNumero, savePedido as savePedidoRemote } from '@/services/pedidos2'
import { createProposta } from '@/services/propostas'
import IconifyIcon from '@/components/wrappers/IconifyIcon'

export default function PedidoFormPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const entityParam = searchParams?.get('entity') ?? ''
  const idParam = useMemo(() => Number(params?.id ?? 0), [params])
  const isNew = idParam === 0

  const [form, setForm] = useState<Pedido>({
    numero: 0,
    data: new Date().toISOString().slice(0, 10),
    cliente: '',
    cnpj: '',
    total: 0,
    status: entityParam === 'proposta' ? 'Proposta' : 'Pendente',
  })

  const [formaRecebimento, setFormaRecebimento] = useState('Boleto')
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [descontoPercent, setDescontoPercent] = useState<number>(0)

  type ItemPedido = { id: number; nome: string; sku?: string; quantidade: number; unidade: string; preco: number; estoque?: number; produtoId?: number; imagemUrl?: string }
  const [itens, setItens] = useState<ItemPedido[]>([])
  // Keep original unit price so we can reapply markups without compounding
  type ItemPedidoWithOriginal = ItemPedido & { originalPreco?: number }

  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  // Catálogo de produtos (listagem com rolagem e busca)
  type CatalogItem = { id: number; nome: string; codigo?: string; preco?: number; imagem?: string | null }
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogSelected, setCatalogSelected] = useState<CatalogItem | null>(null)
  const [showCatalogDetail, setShowCatalogDetail] = useState(false)
  const catalogDebounceRef = useRef<any>(null)
  const [catalogDetail, setCatalogDetail] = useState<{ nome?: string; codigo?: string; preco?: number; unidade?: string; imagem?: string | null; descricao?: string | null; estoque?: number | null } | null>(null)
  const [catalogDetailLoading, setCatalogDetailLoading] = useState(false)
  const [catalogDetailError, setCatalogDetailError] = useState<string | null>(null)
  const [showCatalogListModal, setShowCatalogListModal] = useState(false)
  const [showQtyModal, setShowQtyModal] = useState(false)
  const [qtyModalProduct, setQtyModalProduct] = useState<CatalogItem | null>(null)
  const [qtyModalValue, setQtyModalValue] = useState<number>(1)
  const [qtyModalStock, setQtyModalStock] = useState<number | null>(null)
  const [qtyModalLoading, setQtyModalLoading] = useState(false)
  const [qtyModalError, setQtyModalError] = useState<string | null>(null)
  const [showTinyResult, setShowTinyResult] = useState(false)
  const [tinyResult, setTinyResult] = useState<any>(null)
  const [sentObjectResult, setSentObjectResult] = useState<any>(null)

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

  // Sugestões de clientes + papel do usuário
  type ClientSuggestion = { id: number; nome: string; cpf_cnpj?: string; id_vendedor_externo?: string | null; nome_vendedor?: string | null; cidade?: string | null }
  const [clientSuggestions, setClientSuggestions] = useState<ClientSuggestion[]>([])
  const [showClientSuggest, setShowClientSuggest] = useState<boolean>(false)
  const clientDebounceRef = useRef<any>(null)
  const [selectedClient, setSelectedClient] = useState<ClientSuggestion | null>(null)
  const [meVendedor, setMeVendedor] = useState<{
    tipo?: 'VENDEDOR' | 'TELEVENDAS' | null
    id_vendedor_externo?: string | null
    nome?: string | null
  } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/me/vendedor')
        const j = await res.json()
        if (j?.ok) setMeVendedor(j.data)
      } catch {}
    })()
  }, [])

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
    (async () => {
      if (!isNew) {
        const existing = await getPedidoByNumero(idParam)
        if (existing) {
          setForm(existing)
        }
      } else {
        setForm((f) => ({ ...f, numero: 0 }))
      }
    })()
  }, [idParam, isNew])

  // Carregar catálogo inicial (100 itens) e buscar com debounce quando query >= 3
  useEffect(() => {
    const run = async (q: string) => {
      setCatalogLoading(true)
      try {
        const res = await fetch(`/api/produtos?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        const items: CatalogItem[] = (data?.retorno?.produtos || []).map((p: any) => ({
          id: Number(p?.produto?.id ?? 0),
          nome: p?.produto?.nome ?? '',
          codigo: p?.produto?.codigo ?? undefined,
          preco: p?.produto?.preco != null ? Number(p?.produto?.preco) : undefined,
          imagem: p?.produto?.imagem ?? null,
        })).filter((x: CatalogItem) => !!x.nome)
        setCatalog(items)
      } finally {
        setCatalogLoading(false)
      }
    }

    if (!catalogQuery || catalogQuery.trim().length === 0) {
      run('')
      return
    }
    if (catalogQuery.trim().length < 3) return
    if (catalogDebounceRef.current) clearTimeout(catalogDebounceRef.current)
    catalogDebounceRef.current = setTimeout(() => run(catalogQuery.trim()), 600)
  }, [catalogQuery])

  const addFromCatalog = (p: CatalogItem) => {
    ;(async () => {
      try {
        const res = await fetch(`/api/produtos/${p.id}/estoque`)
        const est = await res.json().catch(() => ({ totalEstoque: null }))
        const stock = est?.totalEstoque != null ? Number(est.totalEstoque) : null
        const currentQty = getQtdInOrderBySku(p.codigo)
        if (stock != null && currentQty + 1 > stock) {
          // open qty modal with error
          setQtyModalProduct(p)
          setQtyModalValue(currentQty + 1)
          setQtyModalStock(stock)
          setQtyModalError(`Estoque não disponível, estoque atual: ${stock}`)
          setShowQtyModal(true)
          return
        }
        // proceed to add
        setItens((arr) => {
          const idx = arr.findIndex((it) => (it.sku || '').toLowerCase() === (p.codigo || '').toLowerCase())
          if (idx >= 0) {
            const next = [...arr]
            next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 }
            return next
          }
          const nextId = arr.reduce((m, it) => Math.max(m, it.id), 0) + 1
          return [
            ...arr,
            {
              id: nextId,
              nome: p.nome,
              sku: p.codigo,
              quantidade: 1,
              unidade: 'PC',
              preco: Number(p.preco || 0),
              originalPreco: Number(p.preco || 0),
              imagemUrl: p.imagem || undefined,
            } as ItemPedidoWithOriginal,
          ]
        })
      } catch (e) {
        // ignore errors here to avoid disrupting catalog state
      }
    })()
  }

  const removeFromCatalog = (p: CatalogItem) => {
    setItens((arr) => {
      const idx = arr.findIndex((it) => (it.sku || '').toLowerCase() === (p.codigo || '').toLowerCase())
      if (idx < 0) return arr
      const curr = arr[idx]
      const next = [...arr]
      if (curr.quantidade > 1) {
        next[idx] = { ...curr, quantidade: curr.quantidade - 1 }
      } else {
        next.splice(idx, 1)
      }
      return next
    })
  }

  const openCatalogDetail = (p: CatalogItem) => {
    setCatalogSelected(p)
    setCatalogDetail(null)
    setCatalogDetailError(null)
    setShowCatalogDetail(true)
    ;(async () => {
      setCatalogDetailLoading(true)
      try {
        const [prodRes, estoqueRes] = await Promise.all([
          fetch(`/api/produtos/${p.id}`),
          fetch(`/api/produtos/${p.id}/estoque`),
        ])
        const prod = await prodRes.json()
        const est = await estoqueRes.json().catch(() => ({ totalEstoque: null }))
        setCatalogDetail({
          nome: prod?.nome ?? p.nome,
          codigo: prod?.codigo ?? p.codigo,
          preco: prod?.preco != null ? Number(prod.preco) : (p.preco ?? undefined),
          unidade: prod?.unidade ?? undefined,
          imagem: prod?.imagem ?? p.imagem ?? null,
          descricao: prod?.descricao ?? null,
          estoque: est?.totalEstoque != null ? Number(est.totalEstoque) : null,
        })
      } catch (e: any) {
        setCatalogDetailError('Falha ao carregar detalhes do produto')
      } finally {
        setCatalogDetailLoading(false)
      }
    })()
  }

  const openQtyEditor = async (p: CatalogItem, initialValue?: number) => {
    setQtyModalError(null)
    setQtyModalProduct(p)
    setQtyModalLoading(true)
    try {
      const res = await fetch(`/api/produtos/${p.id}/estoque`)
      const est = await res.json().catch(() => ({ totalEstoque: null }))
      const stock = est?.totalEstoque != null ? Number(est.totalEstoque) : null
      setQtyModalStock(stock)
      const currentQty = getQtdInOrderBySku(p.codigo)
      setQtyModalValue(typeof initialValue === 'number' ? initialValue : currentQty || 1)
      if (stock != null && (typeof initialValue === 'number' ? initialValue : currentQty || 1) > stock) {
        setQtyModalError(`Estoque não disponível, estoque atual: ${stock}`)
      }
      setShowQtyModal(true)
    } catch (e: any) {
      setQtyModalError('Falha ao verificar estoque')
      setShowQtyModal(true)
    } finally {
      setQtyModalLoading(false)
    }
  }

  const getQtdInOrderBySku = (sku?: string) => {
    if (!sku) return 0
    const s = (sku || '').toLowerCase()
    return itens.filter((it) => (it.sku || '').toLowerCase() === s).reduce((acc, it) => acc + (it.quantidade || 0), 0)
  }

  const handleChange = (key: keyof Pedido, value: string | number | PedidoStatus) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onClienteChange = (value: string) => {
    setForm((f) => ({ ...f, cliente: value }))
    setSelectedClient(null)
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    const trimmed = value.trim()
    if (trimmed.length >= 3) {
      clientDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/clientes?q=${encodeURIComponent(trimmed)}`, { credentials: 'same-origin' })
          const data = await res.json()
          console.debug('clientes search res', res.status, data)
          const options: ClientSuggestion[] = (data?.data || []).map((c: any) => ({
            id: Number(c?.id ?? 0),
            nome: c?.nome || '',
            cpf_cnpj: c?.cpf_cnpj || '',
            id_vendedor_externo: c?.id_vendedor_externo ?? null,
            nome_vendedor: c?.nome_vendedor ?? null,
            cidade: c?.cidade ?? null,
          })).filter((c: ClientSuggestion) => !!c.nome)
          setClientSuggestions(options)
          setShowClientSuggest(options.length > 0)
        } catch (e) {
          console.error('Erro buscando clientes', e)
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
    setSelectedClient(opt)
    setShowClientSuggest(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      // Block submit if parcel validation fails
      if (pagamentoParceladoErro) {
        setSubmitError(pagamentoParceladoErro)
        setIsSubmitting(false)
        return
      }
      // Envio para Tiny desabilitado temporariamente: salvar apenas na plataforma
      const cpfCnpjDigits = onlyDigits(form.cnpj)
      const tipoPessoa = cpfCnpjDigits.length === 11 ? 'F' : (cpfCnpjDigits.length === 14 ? 'J' : '')

      const tinyItens: any[] = []

      const descontoValor = Math.max(0, (itens.reduce((acc, it) => acc + (it.quantidade * (it.preco || 0)), 0)) - (totalComDesconto || 0))

      const tinyParcelas: any[] | undefined = undefined

      // Determine if this submission is a proposta via search param
      if (entityParam === 'proposta') {
        // prepare payload ensuring cliente is an object with nome and cpf_cnpj
        const payloadProposal: any = {
          ...form,
          status: 'Proposta',
          total: totalComDesconto,
          id_vendedor_externo: meVendedor?.id_vendedor_externo || null,
          client_vendor_externo: selectedClient?.id_vendedor_externo || null,
        }
        payloadProposal.cliente =
          !payloadProposal.cliente || typeof payloadProposal.cliente === 'string'
            ? { nome: String(form.cliente || '').trim(), cpf_cnpj: String(form.cnpj || '').trim() }
            : { ...(payloadProposal.cliente || {}), cpf_cnpj: String(form.cnpj || '').trim(), nome: payloadProposal.cliente.nome || String(form.cliente || '').trim() }
        // remove top-level cnpj to avoid duplication when sending to Tiny via backend
        delete payloadProposal.cnpj
        // Include items in platform format so they are persisted with the proposal (not sent to Tiny yet)
        if (itens && itens.length > 0) {
          payloadProposal.itens = itens.map((it) => ({
            produtoId: it.produtoId ?? null,
            codigo: it.sku ?? undefined,
            nome: it.nome,
            quantidade: it.quantidade,
            unidade: it.unidade,
            preco: it.preco,
          }))
        }
        const numero = await createProposta(payloadProposal as any)
        router.push('/propostas')
        return
      }

      // Apenas salvar localmente na plataforma (pedido)
      const payloadToSend: any = {
        ...form,
        total: totalComDesconto,
        id_vendedor_externo: meVendedor?.id_vendedor_externo || null,
        client_vendor_externo: selectedClient?.id_vendedor_externo || null,
      }
      payloadToSend.cliente =
        !payloadToSend.cliente || typeof payloadToSend.cliente === 'string'
          ? { nome: String(form.cliente || '').trim(), cpf_cnpj: String(form.cnpj || '').trim() }
          : { ...(payloadToSend.cliente || {}), cpf_cnpj: String(form.cnpj || '').trim(), nome: payloadToSend.cliente.nome || String(form.cliente || '').trim() }
      delete payloadToSend.cnpj
      // Map local itens to Tiny documentation format:
      // pedido.itens = [ { item: { codigo, descricao, unidade, quantidade, valor_unitario } }, ... ]
      if (itens && itens.length > 0) {
        const tinyItems = itens
          .map((it) => {
            const descricao = it.nome?.toString().trim()
            const quantidade = Number(it.quantidade || 0)
            if (!descricao || quantidade <= 0) return null
            return {
              item: {
                codigo: it.sku || undefined,
                descricao,
                unidade: it.unidade || 'UN',
                quantidade: String(quantidade),
                valor_unitario: String(Number(it.preco || 0).toFixed(2)),
              },
            }
          })
          .filter(Boolean)
        if (tinyItems.length > 0) {
          payloadToSend.itens = tinyItems
        }
      }
      const saved = await savePedidoRemote(payloadToSend)
      // If backend returned Tiny API response instead of a platform 'numero', show it to the user
      if (saved && (saved as any).tinyResponse) {
        setTinyResult((saved as any).tinyResponse)
        setSentObjectResult((saved as any).sentObject ?? (saved as any))
        setShowTinyResult(true)
        setIsSubmitting(false)
        return
      }
      if (isNew) {
        router.push('/pedidos')
      } else {
        router.push(`/pedidos/${saved.numero}`)
      }
      return
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
    '14 D',
    '14/21/28/35/42/49/56/63/70/77/84/91D',
    '14/21/28/35/42/49/56/63/70/77D',
    '14/21/28/35/42/49/56/63/70D',
    '14/21/28/35/42/49/56/63D',
    '14/21/28/35/42/49/56D',
    '14/21/28/35/42/49D',
    '14/21/28/35/42D',
    '14/21/28/35D',
    '14/21/28D',
    '14/21D',

    '21/28/35/42/49D',
    '21/28/35/42D',
    '21/28/35D',
    '21/28D',
    '21D',
    '28/35/42/49/56/63/70',
    '28/35/42/49/56/63/70/77/84D',
    '28/35/42/49/56/63/70/77D',
    '28/35/42/49/56/63D',
    '28/35/42/49/56D',
    '28/35/42/49D',
    '28/35/42D',
    '28/35D',
    '28/42D',

    '28/49D',
    '28/56D',
    '28D',
    '30/40/50/60/70/80/90/100/110/120D',
    '30/40/50/60/70/80/90/100D',
    '30/40/50/60/70/80D',
    '30/40/50/60/70D',
    '30/40/50/60D',
    '30/40/50D',
    '30/40D',
    '30/45/60/75/90/105/120 D',
    '30/45/60/75/90D',
    '30/45/60/75D',

    '30/45/60D',
    '30/60/80D',
    '30/60/90/120D',
    '30/60/90D',
    '30/70/100D',
    '30/70D',
    '30/75/120 D',
    '30D',
    '40/50/60/70/80/90/100/110/120/130/140/150D',
    '40/50/60/70/80/90/100D',
    '40/70/100D',
    '40/90/130/150D',
    '45/60/75/90/105/120/135D',
    '45/60/75D',
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

  const markupPct = useMemo(() => {
    if (formaRecebimento !== 'Boleto') return 0
    let firstDay: number | null = null
    if (diasParcelas && diasParcelas.length > 0) firstDay = diasParcelas[0]
    if (firstDay == null || Number.isNaN(firstDay)) {
      const m = String(condicaoPagamento || '').match(/\d+/)
      firstDay = m ? Number(m[0]) : NaN
    }
    if (Number.isNaN(firstDay) || firstDay == null) return 0
    if (firstDay < 30) return 0.02
    if (firstDay >= 30 && firstDay < 40) return 0.03
    return 0.04
  }, [formaRecebimento, diasParcelas, condicaoPagamento])

  // Validação: valor mínimo da parcela para Boleto
  const pagamentoParceladoErro = useMemo(() => {
    if (formaRecebimento !== 'Boleto') return ''
    if (!parcelas || parcelas.length === 0) return ''
    const valorParcela = parcelas[0]?.valor ?? 0
    if (valorParcela < 400) {
      return 'Conforme as políticas comerciais atuais, o valor da parcela deve superar 400 reais.'
    }
    return ''
  }, [formaRecebimento, parcelas])

  // Apply markup on itens when boleto condition changes
  useEffect(() => {
    const applyMarkup = () => {
      if (formaRecebimento !== 'Boleto' || !condicaoPagamento) {
        // revert to original prices
        setItens((arr) => arr.map((it: any) => ({ ...it, preco: (it.originalPreco != null ? it.originalPreco : it.preco) })))
        return
      }
      // extract first numeric day from condicaoPagamento
      const m = String(condicaoPagamento).match(/\d+/)
      const firstDay = m ? Number(m[0]) : NaN
      let pct = 0
      if (!isNaN(firstDay)) {
        if (firstDay < 30) pct = 0.02
        else if (firstDay >= 30 && firstDay < 40) pct = 0.03
        else pct = 0.04
      } else {
        pct = 0
      }
      if (pct === 0) {
        setItens((arr) => arr.map((it: any) => ({ ...it, preco: (it.originalPreco != null ? it.originalPreco : it.preco) })))
        return
      }
      setItens((arr) => arr.map((it: any) => {
        const base = it.originalPreco != null ? it.originalPreco : it.preco
        const newPrice = Math.round((Number(base || 0) * (1 + pct)) * 100) / 100
        return { ...it, preco: newPrice }
      }))
    }
    applyMarkup()
  }, [condicaoPagamento, formaRecebimento])

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
        originalPreco: Number(prod?.preco || 0),
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

  const headerTitle = (() => {
    if (entityParam === 'proposta') {
      return isNew ? `Proposta de venda` : `Proposta de venda ${form.numero}`
    }
    return isNew ? `Pedido de venda ${getNextPedidoNumero()}` : `Pedido de venda ${form.numero}`
  })()

  return (
    <>
      <PageTitle title={headerTitle} subName={isNew ? 'Criação' : 'Edição'} />

      {/* Sessão 1 - Cliente e Vendedor */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Header className="bg-white fw-semibold">Dados do cliente</Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col lg={4}>
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
                {meVendedor?.tipo === 'TELEVENDAS' && selectedClient && (
                  <div className="small mt-2">
                    <span className="text-muted">Vendedor do cliente: </span>
                    <span className="fw-semibold">{selectedClient.nome_vendedor || (selectedClient.id_vendedor_externo ? selectedClient.id_vendedor_externo : '—')}</span>
                    <span className="ms-2">•</span>
                    <span className="ms-2">
                      Comissão: {selectedClient.id_vendedor_externo ? '1%' : '5%'}
                    </span>
                  </div>
                )}
              </div>
            </Col>
            <Col lg={2}>
              <Form.Label>Vendedor</Form.Label>
              <Form.Control type="text" value={meVendedor?.nome || meVendedor?.id_vendedor_externo || ''} disabled />
            </Col>
            <Col lg={3}>
              <Form.Label>Forma de recebimento</Form.Label>
              <Form.Select value={formaRecebimento} onChange={(e) => { setFormaRecebimento(e.target.value); setCondicaoPagamento(''); setDescontoPercent(0) }}>
                <option value="Boleto">Boleto</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
              </Form.Select>
            </Col>
            <Col lg={3}>
              <Form.Label>Condição de pagamento</Form.Label>
              <Form.Select value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)}>
                <option value="">Selecione</option>
                {condicoesPagamentoOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Form.Select>
            </Col>
            {/* removed extra placeholder column */}
          </Row>
        </Card.Body>
      </Card>

      {/* Sessão 2 - Produtos */} 
      {condicaoPagamento && (
        <Card className="border-0 shadow-sm mb-3">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Produtos</div>
          </Card.Header>
          <Card.Body>
          <div className="mb-3">
            <Form.Label className="fw-semibold">Busca de produtos </Form.Label>
            <Form.Control
              type="text"
              placeholder="Digite código SKU ou nome do produto"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
            <div className="mt-2 border rounded d-none d-md-block" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {catalogLoading ? (
                <div className="p-2 small text-muted">Carregando produtos...</div>
              ) : catalog.length === 0 ? (
                <div className="p-2 small text-muted">Nenhum produto encontrado.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {catalog.map((p) => (
                    <div key={p.id} className="list-group-item py-2 d-flex justify-content-between align-items-center">
                      <div className="me-2">
                        <div className="fw-semibold small">{p.nome}</div>
                        <div className="text-muted small">SKU: {p.codigo || '-'}</div>
                        {p.preco != null && (
                          <div className="text-muted small">
                            Preço:{' '}
                            {Number(((p.preco || 0) * (1 + markupPct)) || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                        )}
                      </div>
                      <div className="d-flex gap-1">
                        {/* Quantidade atual no pedido para este SKU */}
                        {getQtdInOrderBySku(p.codigo) > 0 && (
                          <span
                            role="button"
                            onClick={() => openQtyEditor(p)}
                            className="badge bg-secondary align-self-center me-1"
                            title="Quantidade no pedido (clique para editar)"
                            style={{ cursor: 'pointer' }}
                          >
                            {getQtdInOrderBySku(p.codigo)}
                          </span>
                        )}
                        <Button variant="outline-secondary" size="sm" title="Detalhes" onClick={() => openCatalogDetail(p)}>
                          <IconifyIcon icon="ri:search-line" />
                        </Button>
                        <Button variant="outline-secondary" size="sm" title="Remover 1" onClick={() => removeFromCatalog(p)}>
                          <IconifyIcon icon="ri:subtract-line" />
                        </Button>
                        <Button variant="primary" size="sm" title="Adicionar 1" onClick={() => addFromCatalog(p)}>
                          <IconifyIcon icon="ri:add-line" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="d-flex justify-content-end mt-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setShowCatalogListModal(true)}>Ver lista</Button>
            </div>

          </div>

          <div className="d-flex justify-content-start mt-3">
            <Button
              variant="link"
              className="p-0 text-primary"
              style={{ textDecoration: 'underline' }}
              onClick={openHistory}
            >
              Histórico de produtos do cliente
            </Button>
          </div>
          </Card.Body>
        </Card>
      )}

      {/* Sessão 3 - Pagamento */} 
      {condicaoPagamento && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white fw-semibold">Pagamento</Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label>Data da venda</Form.Label>
                <Form.Control type="date" value={form.data} onChange={(e) => handleChange('data', e.target.value)} />
              </Col>
              {/* Forma de recebimento moved to header */} 
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
                {pagamentoParceladoErro && (
                  <div className="text-danger mt-2">
                    Conforme as políticas comerciais atuais, <strong>o valor da parcela deve superar 400 reais</strong>.
                  </div>
                )}
              </div>
            )}

            <div className="d-flex gap-2 mt-4">
              <Button
                type="submit"
                disabled={!!pagamentoParceladoErro || isSubmitting}
              >
                {entityParam === 'proposta' ? 'Enviar Proposta' : 'Enviar Pedido'}
              </Button>
              <Button variant="secondary" onClick={() => router.push(entityParam === 'proposta' ? '/propostas' : '/pedidos')}>Cancelar</Button>
            </div>
          </Form>
          </Card.Body>
        </Card>
      )}

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

      {/* Modal: Resultado da chamada ao Tiny (mostrar retorno e objeto enviado) */}
      <Modal show={showTinyResult} onHide={() => { setShowTinyResult(false); setTinyResult(null); setSentObjectResult(null) }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Resposta do Tiny</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <div className="fw-semibold">Objeto enviado</div>
            <pre style={{ maxHeight: 240, overflow: 'auto', background: '#f8f9fa', padding: 12 }}>{JSON.stringify(sentObjectResult, null, 2)}</pre>
          </div>
          <div>
            <div className="fw-semibold">Resposta da API Tiny</div>
            <pre style={{ maxHeight: 320, overflow: 'auto', background: '#f8f9fa', padding: 12 }}>{JSON.stringify(tinyResult, null, 2)}</pre>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowTinyResult(false); setTinyResult(null); setSentObjectResult(null) }}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      {/* Detalhes do produto do catálogo */}
      <Modal show={showCatalogDetail} onHide={() => setShowCatalogDetail(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do produto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {catalogDetailLoading ? (
            <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /><span>Carregando detalhes...</span></div>
          ) : catalogDetailError ? (
            <div className="text-danger small">{catalogDetailError}</div>
          ) : !catalogSelected ? (
            <div className="text-muted small">Nenhum produto selecionado.</div>
          ) : (
            <div>
              <div className="mb-2"><strong>Nome:</strong> {catalogDetail?.nome ?? catalogSelected.nome}</div>
              <div className="mb-2"><strong>SKU:</strong> {(catalogDetail?.codigo ?? catalogSelected.codigo) || '-'}</div>
              <div className="mb-2"><strong>Preço:</strong> {Number(((catalogDetail?.preco ?? catalogSelected.preco) * (1 + markupPct)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              {catalogDetail?.unidade && <div className="mb-2"><strong>Unidade:</strong> {catalogDetail.unidade}</div>}
              {catalogDetail?.estoque != null && <div className="mb-2"><strong>Estoque:</strong> {catalogDetail.estoque}</div>}
              {catalogDetail?.descricao && <div className="mb-2"><strong>Descrição:</strong> <div className="small text-muted">{catalogDetail.descricao}</div></div>}
              <div className="text-center">
                {(catalogDetail?.imagem ?? catalogSelected.imagem) ? (
                  <img src={(catalogDetail?.imagem ?? catalogSelected.imagem) as string} alt={catalogDetail?.nome ?? catalogSelected.nome} className="img-fluid" />
                ) : (
                  <div className="text-muted">Sem imagem disponível</div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {catalogSelected && !catalogDetailLoading && (
            <Button variant="primary" onClick={() => { addFromCatalog({ ...catalogSelected, preco: catalogDetail?.preco ?? catalogSelected.preco, imagem: catalogDetail?.imagem ?? catalogSelected.imagem }); setShowCatalogDetail(false) }}>
              Adicionar ao pedido
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowCatalogDetail(false)}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: edição de quantidade do item (usado pelo badge e quando + excede estoque) */}
      <Modal show={showQtyModal} onHide={() => { setShowQtyModal(false); setQtyModalError(null) }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar quantidade</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {qtyModalLoading ? (
            <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /><span>Verificando estoque...</span></div>
          ) : (
            <>
              <div className="mb-2 fw-semibold">{qtyModalProduct?.nome}</div>
              <Form.Group>
                <Form.Label>Quantidade desejada</Form.Label>
                <Form.Control type="number" min={1} value={qtyModalValue} onChange={(e) => setQtyModalValue(Math.max(1, Number(e.target.value)))} />
              </Form.Group>
              {qtyModalStock != null && (
                <div className="small text-muted mt-2">Estoque atual: {qtyModalStock}</div>
              )}
              {qtyModalError && (
                <div className="text-danger mt-2">{qtyModalError}</div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowQtyModal(false); setQtyModalError(null) }}>Fechar</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!qtyModalProduct) return
              if (qtyModalStock != null && qtyModalValue > qtyModalStock) {
                setQtyModalError(`Estoque não disponível, estoque atual: ${qtyModalStock}`)
                return
              }
              // apply quantity
              setItens((arr) => {
                const idx = arr.findIndex((it) => (it.sku || '').toLowerCase() === (qtyModalProduct?.codigo || '').toLowerCase())
                if (idx >= 0) {
                  const next = [...arr]
                  next[idx] = { ...next[idx], quantidade: qtyModalValue }
                  return next
                }
                const nextId = arr.reduce((m, it) => Math.max(m, it.id), 0) + 1
                return [
                  ...arr,
                  {
                    id: nextId,
                    nome: qtyModalProduct.nome,
                    sku: qtyModalProduct.codigo,
                    quantidade: qtyModalValue,
                    unidade: 'PC',
                    preco: Number(qtyModalProduct.preco || 0),
                    imagemUrl: qtyModalProduct.imagem || undefined,
                  },
                ]
              })
              setShowQtyModal(false)
              setQtyModalError(null)
            }}
          >
            Salvar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Lista completa de itens (abre pela lista rolável) */}
      <Modal show={showCatalogListModal} onHide={() => setShowCatalogListModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Lista de itens</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive d-none d-md-block" style={{ maxWidth: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh' }}>
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
                            <div className="flex-grow-1">{item.nome}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.sku || '-'}
                      </td>
                      <td>
                        {item.quantidade}
                      </td>
                      <td>
                        {item.unidade}
                      </td>
                      <td>
                        {item.estoque ?? 0}
                      </td>
                      <td>
                        {item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td>
                        {totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
          {/* Mobile (sm) - Itens empilhados dentro do modal */}
          <div className="d-block d-md-none mt-3">
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
                      <div className="flex-grow-1">{item.nome}</div>
                    </div>
                  </Form.Group>
                  <Row className="g-2 mt-1">
                    <Col xs={6}>
                      <Form.Label className="mb-1">SKU</Form.Label>
                      <div className="form-control-plaintext">{item.sku || ''}</div>
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Estoque</Form.Label>
                      <div className="form-control-plaintext">{item.estoque ?? 0}</div>
                    </Col>
                  </Row>
                  <Row className="g-2 mt-1">
                    <Col xs={6}>
                      <Form.Label className="mb-1">Qtde</Form.Label>
                      <div className="form-control-plaintext">{item.quantidade}</div>
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Unidade</Form.Label>
                      <div className="form-control-plaintext">{item.unidade}</div>
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Preço un</Form.Label>
                      <div className="form-control-plaintext">{item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="mb-1">Total</Form.Label>
                      <div className="form-control-plaintext">{totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end gap-2 mt-2">
                    <Button variant="outline-danger" size="sm" onClick={() => removeItem(item.id)} title="Remover">
                      <IconifyIcon icon="ri:delete-bin-line" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCatalogListModal(false)}>Fechar</Button>
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


