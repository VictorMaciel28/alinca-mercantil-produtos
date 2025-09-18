"use client";

import { useEffect, useState } from "react";
import { Card, Form, Table, Badge, Row, Col, Button } from "react-bootstrap";
import PageTitle from '@/components/PageTitle'
import { getPedidos, Pedido } from '@/services/pedidos'
import { useRouter } from 'next/navigation'
import IconifyIcon from '@/components/wrappers/IconifyIcon'

export default function PedidosPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])

  useEffect(() => {
    setPedidos(getPedidos())
  }, [])

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

  const pedidosFiltrados = pedidos.filter((p) => {
    const termo = termoBusca.trim().toLowerCase();
    const atendeBusca = !termo
      || String(p.numero).includes(termo)
      || p.cliente.toLowerCase().includes(termo)
      || p.cnpj.toLowerCase().includes(termo);
    const atendeStatus = !statusFiltro || p.status === statusFiltro;
    const atendePeriodo = dentroDoPeriodo(p.data);
    return atendeBusca && atendeStatus && atendePeriodo;
  });

  return (
    <>
      <PageTitle title="Pedidos" subName="Consulta e acompanhamento" />

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
            <div className="fw-semibold">Pedidos</div>
            <Button size="sm" onClick={() => router.push('/pedidos/0')}>
              <IconifyIcon icon="ri:add-line" className="me-1" /> Novo Pedido
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
                  {pedidosFiltrados.length > 0 ? (
                    pedidosFiltrados.map((p) => (
                      <tr key={p.numero} style={{ cursor: 'pointer' }} onClick={() => router.push(`/pedidos/${p.numero}`)}>
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
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); router.push(`/pedidos/${p.numero}`) }}
                              title="Editar"
                            >
                              <IconifyIcon icon="ri:edit-line" />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); /* excluir (mock) */ }}
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
                      <td colSpan={7} className="text-center text-muted py-4">Nenhum pedido encontrado com os filtros atuais</td>
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


