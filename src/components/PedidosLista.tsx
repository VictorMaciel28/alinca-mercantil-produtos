 "use client";
 
 import { useEffect, useState } from "react";
 import { Card, Form, Table, Badge, Row, Col, Button } from "react-bootstrap";
 import PageTitle from '@/components/PageTitle'
 import { Pedido } from '@/services/pedidos'
 import IconifyIcon from '@/components/wrappers/IconifyIcon'
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
 
   useEffect(() => {
     (async () => {
       const rows = await fetchFn()
       setItems(rows)
     })()
   }, [fetchFn])
 
   const [termoBusca, setTermoBusca] = useState("");
   const [statusFiltro, setStatusFiltro] = useState("");
   const [dataInicio, setDataInicio] = useState("");
   const [dataFim, setDataFim] = useState("");
 
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
 
   return (
     <>
       <PageTitle title={title ?? (entity === 'proposta' ? 'Propostas Comerciais' : 'Pedidos')} subName={subName ?? (entity === 'proposta' ? 'Consulta e acompanhamento' : 'Consulta e acompanhamento')} />
 
       <section className="filtros py-2">
         <Card className="border-0 shadow-sm">
           <Card.Header className="bg-white d-flex justify-content-between align-items-center">
             <div className="fw-semibold">Filtros</div>
           </Card.Header>
           <Card.Body>
             <Row className="g-3 align-items-end">
               <Col lg={4} md={6}>
                 <Form.Label>Buscar</Form.Label>
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
                   <option value="Em aberto">Em aberto</option>
                   <option value="Faturado">Faturado</option>
                   <option value="Entregue">Entregue</option>
                 </Form.Select>
               </Col>
             </Row>
           </Card.Body>
         </Card>
       </section>
 
       <section className="pedidos-lista py-3">
         <Card className="border-0 shadow-sm">
           <Card.Header className="bg-white d-flex justify-content-between align-items-center">
             <div className="fw-semibold">{labelPlural}</div>
             <Button size="sm" onClick={() => router.push(newPath)}>
               <IconifyIcon icon="ri:add-line" className="me-1" /> Novo {entity === 'proposta' ? 'Proposta' : 'Pedido'}
             </Button>
           </Card.Header>
           <Card.Body>
             <div className="table-responsive">
               <Table hover className="mb-0">
                 <thead>
                   <tr>
                     <th>N°</th>
                     <th>Data</th>
                     <th>Cliente</th>
                     <th>CNPJ</th>
                     <th>Total</th>
                     <th>Status</th>
                     <th style={{ width: 110 }}>Ações</th>
                   </tr>
                 </thead>
                 <tbody>
                   {itensFiltrados.length > 0 ? (
                    itensFiltrados.map((p) => (
                      <tr key={p.numero} style={{ cursor: 'pointer' }} onClick={() => router.push(computeItemUrl(p.numero))}>
                         <td>{p.numero}</td>
                         <td>{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                         <td>{p.cliente}</td>
                         <td>{p.cnpj}</td>
                         <td>{p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                         <td>
                          {p.status === 'Pago' && (<Badge bg="success">{p.status}</Badge>)}
                          {p.status === 'Faturado' && (<Badge bg="success">{p.status}</Badge>)}
                          {p.status === 'Em aberto' && (<Badge bg="warning">{p.status}</Badge>)}
                          {p.status === 'Pendente' && (<Badge bg="warning" text="dark">{p.status}</Badge>)}
                          {p.status === 'Entregue' && (<Badge bg="primary">{p.status}</Badge>)}
                          {p.status === 'Cancelado' && (<Badge bg="danger">{p.status}</Badge>)}
                          {p.status === 'Proposta' && (<Badge bg="info" text="dark">{p.status}</Badge>)}
                         </td>
                         <td>
                           <div className="d-flex gap-2">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); router.push(computeItemUrl(p.numero)) }}
                              title="Editar"
                            >
                               <IconifyIcon icon="ri:edit-line" />
                             </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => handleDelete(e, p.numero)}
                              title="Excluir"
                            >
                               <IconifyIcon icon="ri:delete-bin-line" />
                             </Button>
                           </div>
                         </td>
                       </tr>
                     ))
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
     </>
  );
}
