 "use client";
 
 import { useEffect, useState } from "react";
import { Card, Form, Table, Badge, Row, Col, Button, Modal, Spinner } from "react-bootstrap";
 import PageTitle from '@/components/PageTitle'
import { Pedido } from '@/services/pedidos2'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { savePedido as savePedidoRemote } from '@/services/pedidos2'
 import { useRouter } from 'next/navigation'
 
 interface PedidosListaProps {
   entity?: 'pedido' | 'proposta'
   title?: string
   subName?: string
   fetchFn: () => Promise<Pedido[]>
   newItemPath?: string
   itemRouteBase?: string
 }
 
 export default function PedidosLista({
   entity = 'pedido',
   title,
   subName,
   fetchFn,
   newItemPath,
   itemRouteBase = '/pedidos',
 }: PedidosListaProps) {
   const router = useRouter()
   const [items, setItems] = useState<Pedido[]>([])
  const [isSyncingPedidos, setIsSyncingPedidos] = useState(false)

  const loadItems = async () => {
    const rows = await fetchFn()
    setItems(rows)
  }
 
   useEffect(() => {
    if (entity === 'pedido') return
     (async () => {
      await loadItems()
     })()
  }, [fetchFn, entity])
 
   const [termoBusca, setTermoBusca] = useState("");
  const [termoBuscaDebounced, setTermoBuscaDebounced] = useState("")
   const [statusFiltro, setStatusFiltro] = useState("");
   const [dataInicio, setDataInicio] = useState("");
   const [dataFim, setDataFim] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(20)
  const [sortBy, setSortBy] = useState<'numero' | 'data' | 'cliente'>('numero')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTermoBuscaDebounced(termoBusca), 350)
    return () => clearTimeout(t)
  }, [termoBusca])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/me/vendedor', { signal: controller.signal })
        const json = await res.json().catch(() => null)
        setIsAdmin(Boolean(json?.ok && json?.data?.is_admin))
      } catch {
        setIsAdmin(false)
      }
    })()
    return () => controller.abort()
  }, [])
 
   const dentroDoPeriodo = (dataISO: string) => {
     if (!dataInicio && !dataFim) return true;
     const d = new Date(dataISO);
     if (dataInicio) {
       const ini = new Date(dataInicio);
       if (d < new Date(ini.getFullYear(), ini.getMonth(), ini.getDate())) return false;
     }
     if (dataFim) {
       const fim = new Date(dataFim);
       const fimAjustado = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59, 59, 999);
       if (d > fimAjustado) return false;
     }
     return true;
   };
 
  const itensFiltrados = items.filter((p) => {
     const termo = termoBusca.trim().toLowerCase();
     const atendeBusca = !termo
       || String(p.numero).includes(termo)
       || p.cliente.toLowerCase().includes(termo)
       || p.cnpj.toLowerCase().includes(termo);
     const atendeStatus = !statusFiltro || p.status === statusFiltro;
     const atendePeriodo = dentroDoPeriodo(p.data);
     return atendeBusca && atendeStatus && atendePeriodo;
   });

  const itensOrdenados = [...itensFiltrados].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'numero') cmp = Number(a.numero) - Number(b.numero)
    else if (sortBy === 'data') cmp = new Date(a.data).getTime() - new Date(b.data).getTime()
    else cmp = String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR', { sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalBase = entity === 'pedido' ? totalPedidos : itensOrdenados.length
  const totalPaginas = Math.max(1, Math.ceil(totalBase / itensPorPagina))
  const paginaSegura = Math.min(paginaAtual, totalPaginas)
  const inicio = (paginaSegura - 1) * itensPorPagina
  const fim = inicio + itensPorPagina
  const itensPaginados = entity === 'pedido' ? itensOrdenados : itensOrdenados.slice(inicio, fim)

  useEffect(() => {
    setPaginaAtual(1)
  }, [termoBuscaDebounced, statusFiltro, dataInicio, dataFim, itensPorPagina, sortBy, sortDir])

  useEffect(() => {
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas)
  }, [paginaAtual, totalPaginas])
 
   const labelPlural = entity === 'proposta' ? 'Propostas' : 'Pedidos'
  const newPath = newItemPath ?? `${itemRouteBase}/0`

  const computeItemUrl = (numero: number) => {
    if (entity === 'proposta') return `/pedidos/${numero}?entity=proposta`
    return `${itemRouteBase}/${numero}`
  }

  const handleDelete = async (e: React.MouseEvent, numero: number) => {
    e.stopPropagation()
    if (!confirm('Confirma exclusão?')) return
    try {
      if (entity === 'proposta') {
        const res = await fetch(`/api/propostas?id=${numero}`, { method: 'DELETE' })
        const json = await res.json()
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao deletar proposta')
        setItems((arr) => arr.filter((it) => it.numero !== numero))
      } else {
        // mock delete for pedidos (preserve existing behaviour)
      }
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err?.message || err))
    }
  }

  // Evolve proposal -> pedido
  const [showEvolveModal, setShowEvolveModal] = useState(false)
  const [evolveItem, setEvolveItem] = useState<Pedido | null>(null)
  const [isEvolving, setIsEvolving] = useState(false)
  const [evolveError, setEvolveError] = useState<string | null>(null)

  const openEvolve = (e: React.MouseEvent, item: Pedido) => {
    e.stopPropagation()
    setEvolveItem(item)
    setEvolveError(null)
    setShowEvolveModal(true)
  }

  const confirmEvolve = async () => {
    if (!evolveItem) return
    setIsEvolving(true)
    setEvolveError(null)
    try {
      const res = await savePedidoRemote({ ...evolveItem, status: 'Pendente' })
      // Only remove the proposal from the list if backend returned a platform numero (pedido created)
      if (res && (res as any).numero) {
        setItems((arr) => arr.filter((it) => it.numero !== evolveItem.numero))
        setShowEvolveModal(false)
      } else {
        // Do not remove; surface error to user for inspection
        console.debug('Evolve response', res)
        setEvolveError('A proposta não foi transformada em pedido: o serviço não retornou um número de pedido.')
      }
    } catch (err: any) {
      setEvolveError(err?.message || 'Falha ao evoluir proposta')
    } finally {
      setIsEvolving(false)
    }
  }

  const syncPedidos = async () => {
    if (entity !== 'pedido') return
    if (!confirm('Esta ação excluirá e reimportará todos os pedidos locais. Deseja continuar?')) return
    setIsSyncingPedidos(true)
    try {
      const res = await fetch('/api/pedidos/sync', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        console.error('Erro ao sincronizar pedidos', {
          status: res.status,
          statusText: res.statusText,
          response: json,
        })
        throw new Error(json?.error || 'Falha ao sincronizar pedidos')
      }
      await loadItems()
      alert(`Sincronização concluída. ${json?.imported ?? 0} pedidos importados.`)
    } catch (err: any) {
      console.error('Falha na sincronização de pedidos', err)
      alert('Erro ao sincronizar pedidos: ' + (err?.message || err))
    } finally {
      setIsSyncingPedidos(false)
    }
  }

  useEffect(() => {
    if (entity !== 'pedido') return
    const controller = new AbortController()
    ;(async () => {
      try {
        const qs = new URLSearchParams()
        qs.set('limit', String(itensPorPagina))
        qs.set('offset', String((paginaSegura - 1) * itensPorPagina))
        if (termoBuscaDebounced.trim()) qs.set('search', termoBuscaDebounced.trim())
        if (statusFiltro) qs.set('status', statusFiltro)
        if (dataInicio) qs.set('dataInicio', dataInicio)
        if (dataFim) qs.set('dataFim', dataFim)
        qs.set('sortBy', sortBy)
        qs.set('sortDir', sortDir)
        const res = await fetch(`/api/pedidos?${qs.toString()}`, { signal: controller.signal })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao listar pedidos')
        setItems(Array.isArray(json?.data) ? json.data : [])
        setTotalPedidos(Number(json?.paginacao?.total || 0))
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        console.error('Erro ao listar pedidos paginados', e)
      }
    })()
    return () => controller.abort()
  }, [entity, paginaSegura, itensPorPagina, termoBuscaDebounced, statusFiltro, dataInicio, dataFim, sortBy, sortDir])

  const toggleSort = (field: 'numero' | 'data' | 'cliente') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir(field === 'cliente' ? 'asc' : 'desc')
  }

  const sortArrow = (field: 'numero' | 'data' | 'cliente') => {
    if (sortBy !== field) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }
 
   return (
     <>
      <PageTitle
        title={title ?? (entity === 'proposta' ? 'Propostas Comerciais' : 'Pedidos')}
        subName={subName ?? (entity === 'proposta' ? 'Consulta e acompanhamento' : 'Consulta e acompanhamento')}
        compactRight
        actions={
          <div className="d-flex align-items-center gap-2">
            {entity === 'pedido' && (
              <Button size="sm" variant="outline-primary" onClick={syncPedidos} disabled={isSyncingPedidos}>
                {isSyncingPedidos ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Sincronizando
                  </>
                ) : (
                  'Sincronizar Pedidos'
                )}
              </Button>
            )}
            <Button size="sm" onClick={() => router.push(newPath)}>
              Novo {entity === 'proposta' ? 'Proposta' : 'Pedido'}
            </Button>
          </div>
        }
      />

      <section className="filtros pt-1 pb-2">
         <Card className="border-0 shadow-sm">
           <Card.Body>
             <Row className="g-3 align-items-end">
               <Col lg={4} md={6}>
                 <Form.Label>Filtrar pedidos</Form.Label>
                 <Form.Control
                   type="text"
                   placeholder="Buscar por N°, Cliente ou CNPJ"
                   value={termoBusca}
                   onChange={(e) => setTermoBusca(e.target.value)}
                 />
               </Col>
               <Col lg={3} md={6}>
                 <Form.Label>Data Início</Form.Label>
                 <Form.Control type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
               </Col>
               <Col lg={3} md={6}>
                 <Form.Label>Data Fim</Form.Label>
                 <Form.Control type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
               </Col>
               <Col lg={2} md={6}>
                 <Form.Label>Status</Form.Label>
                 <Form.Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                   <option value="">Todos</option>
                  <option value="Aprovado">Aprovado na Analise</option>
                  <option value="Pendente">Pendente</option>
                   <option value="Faturado">Faturado</option>
                  <option value="Enviado">Enviado</option>
                   <option value="Entregue">Entregue</option>
                  <option value="Cancelado">Cancelado</option>
                  <option value="Dados incompletos">Dados incompletos</option>
                 </Form.Select>
               </Col>
             </Row>
            <div className="d-flex justify-content-end mt-3">
              <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                Por página:
                <Form.Select
                  size="sm"
                  style={{ width: 100 }}
                  value={itensPorPagina}
                  onChange={(e) => setItensPorPagina(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Form.Select>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={paginaSegura <= 1}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Form.Select
                  size="sm"
                  style={{ width: 90 }}
                  value={paginaSegura}
                  onChange={(e) => setPaginaAtual(Number(e.target.value))}
                >
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Form.Select>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={paginaSegura >= totalPaginas}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
           </Card.Body>
         </Card>
       </section>
 
      <section className="pedidos-lista pt-0 pb-3">
         <Card className="border-0 shadow-sm">
           <Card.Body>
             <div className="table-responsive">
               <Table hover className="mb-0">
                 <thead>
                   <tr>
                    <th role="button" onClick={() => toggleSort('numero')} style={{ userSelect: 'none' }}>
                      N° {sortArrow('numero')}
                    </th>
                    <th role="button" onClick={() => toggleSort('data')} style={{ userSelect: 'none' }}>
                      Data {sortArrow('data')}
                    </th>
                    <th role="button" onClick={() => toggleSort('cliente')} style={{ userSelect: 'none' }}>
                      Cliente {sortArrow('cliente')}
                    </th>
                     <th>CNPJ</th>
                     <th>Total</th>
                     <th>Status</th>
                     <th style={{ width: 110 }}>Ações</th>
                   </tr>
                 </thead>
                 <tbody>
                  {itensPaginados.length > 0 ? (
                   itensPaginados.map((p) => {
                      const canEditPedido = entity === 'pedido' ? (isAdmin || p.status === 'Dados incompletos') : true
                      const canDeletePedido = entity === 'pedido' ? isAdmin : true
                      return (
                      <tr key={p.numero} style={{ cursor: 'pointer' }} onClick={() => router.push(computeItemUrl(p.numero))}>
                         <td>{p.numero}</td>
                         <td>{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                         <td>{p.cliente}</td>
                         <td>{p.cnpj}</td>
                         <td>{p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                         <td>
                          {p.status === 'Faturado' && (<Badge bg="success">{p.status}</Badge>)}
                          {p.status === 'Aprovado' && (<Badge bg="primary">{p.status}</Badge>)}
                          {p.status === 'Enviado' && (<Badge bg="primary">{p.status}</Badge>)}
                          {p.status === 'Pendente' && (<Badge bg="warning" text="dark">{p.status}</Badge>)}
                          {p.status === 'Entregue' && (<Badge bg="info">{p.status}</Badge>)}
                          {p.status === 'Cancelado' && (<Badge bg="danger">{p.status}</Badge>)}
                          {p.status === 'Dados incompletos' && (<Badge bg="secondary">{p.status}</Badge>)}
                          {p.status === 'Proposta' && (<Badge bg="dark">{p.status}</Badge>)}
                         </td>
                         <td>
                           <div className="d-flex gap-2">
                            {canEditPedido && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); router.push(computeItemUrl(p.numero)) }}
                                title="Editar"
                              >
                                 <IconifyIcon icon="ri:edit-line" />
                               </Button>
                            )}
                           {entity === 'proposta' && (
                             <Button
                               variant="outline-success"
                               size="sm"
                               onClick={(e) => openEvolve(e, p)}
                               title="Evoluir para pedido"
                             >
                               <IconifyIcon icon="ri:money-dollar-circle-line" />
                             </Button>
                           )}
                            {canDeletePedido && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={(e) => handleDelete(e, p.numero)}
                                title="Excluir"
                              >
                                 <IconifyIcon icon="ri:delete-bin-line" />
                               </Button>
                            )}
                           </div>
                         </td>
                       </tr>
                      )
                    })
                   ) : (
                     <tr>
                       <td colSpan={7} className="text-center text-muted py-4">Nenhum {entity === 'proposta' ? 'proposta' : 'pedido'} encontrado com os filtros atuais</td>
                     </tr>
                   )}
                 </tbody>
               </Table>
             </div>
           </Card.Body>
         </Card>
       </section>

      <Modal show={showEvolveModal} onHide={() => setShowEvolveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Evoluir proposta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Deseja evoluir proposta comercial para pedido?</p>
          {evolveItem && (
            <div className="small text-muted">N° {evolveItem.numero} — {evolveItem.cliente}</div>
          )}
          {evolveError && <div className="text-danger mt-2">{evolveError}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEvolveModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={confirmEvolve} disabled={isEvolving}>
            {isEvolving ? (<><Spinner animation="border" size="sm" className="me-2" />Processando</>) : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>
     </>
  );
}
