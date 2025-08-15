"use client";

import { useEffect, useState } from "react";
import { Container, Row, Col, Card, Badge, Spinner, Alert, Breadcrumb, Table } from "react-bootstrap";
import { useParams } from "next/navigation";

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  preco: number;
  precoPromocional: number;
  precoCusto: number;
  ncm: string;
  gtin: string;
  categoria: string;
  categorias: string[];
  marca: string;
  descricao: string;
  garantia: string;
  pesoLiquido: number;
  pesoBruto: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  estoqueAtual: number;
  situacao: string;
  fornecedor: {
    nome: string;
    codigo: string;
  };
  imagem: string;
  anexos: any[];
  imagensExternas: any[];
}

interface EstoqueDeposito {
  deposito: {
    nome: string;
    desconsiderar: string;
    saldo: number;
    empresa: string;
  };
}

interface EstoqueProduto {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  saldo: number;
  saldoReservado: number;
  totalEstoque: number;
  depositos: EstoqueDeposito[];
  depositosComEstoque: EstoqueDeposito[];
}

export default function DetalhesProdutoPage() {
  const params = useParams();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [estoque, setEstoque] = useState<EstoqueProduto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregarProduto() {
      if (!params.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Carrega dados do produto
        const responseProduto = await fetch(`/api/produtos/${params.id}`);
        const dataProduto = await responseProduto.json();
        
        if (dataProduto.erro) {
          setError(dataProduto.erro);
        } else {
          setProduto(dataProduto);
        }

        // Carrega dados de estoque
        const responseEstoque = await fetch(`/api/produtos/${params.id}/estoque`);
        const dataEstoque = await responseEstoque.json();
        
        if (!dataEstoque.erro) {
          setEstoque(dataEstoque);
        }
      } catch (error) {
        console.error("Erro ao carregar produto:", error);
        setError("Erro ao carregar informações do produto");
      } finally {
        setLoading(false);
      }
    }

    carregarProduto();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
        <div className="text-center">
          <Spinner animation="border" variant="warning" />
          <p className="mt-3 text-light">Carregando produto...</p>
        </div>
      </div>
    );
  }

  if (error || !produto) {
    return (
      <Container className="py-5">
        <Row className="justify-content-center">
          <Col lg={8}>
            <Alert variant="danger">
              <Alert.Heading>Erro ao carregar produto</Alert.Heading>
              <p>{error || "Produto não encontrado"}</p>
              <hr />
              <a href="/produtos" className="btn btn-outline-danger">
                <i className="fas fa-arrow-left me-2"></i>
                Voltar para Produtos
              </a>
            </Alert>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <div className="produto-detalhes-page bg-dark min-vh-100">
      {/* Header da página */}
      <section className="page-header py-4 bg-primary">
        <Container>
          <Row className="align-items-center text-white">
            <Col>
              <Breadcrumb className="text-white mb-0">
                {produto.categorias.map((cat, index) => (
                  <Breadcrumb.Item className="text-white" key={index} active={index === produto.categorias.length - 1}>
                    {cat}
                  </Breadcrumb.Item>
                ))}
              </Breadcrumb>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Detalhes do produto */}
      <section className="produto-detalhes py-5">
        <Container>
          <Row>
            {/* Imagem do produto */}
            <Col lg={6} className="mb-4">
              <Card className="produto-imagem-card border-0 shadow-lg">
                <Card.Body className="p-0">
                  {produto.imagem ? (
                    <img
                      src={produto.imagem}
                      alt={produto.nome}
                      className="img-fluid w-100"
                      style={{ minHeight: "400px", objectFit: "contain" }}
                    />
                  ) : (
                    <div 
                      className="d-flex align-items-center justify-content-center"
                      style={{ minHeight: "400px", backgroundColor: "#f8f9fa" }}
                    >
                      <div className="text-center text-muted">
                        <i className="fas fa-image fa-4x mb-3"></i>
                        <p>Imagem não disponível</p>
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Informações do produto */}
            <Col lg={6} className="mb-4">
              <div className="produto-info">
                {/* Código e Unidade */}
                <div className="produto-codigo-unidade mb-3">
                  <Row>
                    <Col xs={6}>
                      <small className="text-light">
                        <strong>Código:</strong> {produto.codigo || "N/A"}
                      </small>
                    </Col>
                    <Col xs={6}>
                      <small className="text-light">
                        <strong>Unidade:</strong> {produto.unidade || "PC"}
                      </small>
                    </Col>
                  </Row>
                </div>

                {/* Nome do produto */}
                <h1 className="produto-titulo mb-3 text-white">{produto.nome}</h1>
                
                {/* Preços */}
                <div className="produto-precos mb-4">
                  {produto.precoPromocional && produto.precoPromocional > 0 ? (
                    <div>
                      <span className="text-muted text-decoration-line-through me-3 fs-5">
                        R$ {Number(produto.preco).toFixed(2)}
                      </span>
                      <span className="text-warning fs-2 fw-bold">
                        R$ {Number(produto.precoPromocional).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-warning fs-2 fw-bold">
                      R$ {Number(produto.preco).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Informações técnicas */}
                <div className="produto-info-tecnica mb-4">
                  <Row>
                    <Col xs={6}>
                      <div className="info-item mb-2">
                        <small className="text-light">
                          <strong>NCM:</strong> {produto.ncm || "N/A"}
                        </small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="info-item mb-2">
                        <small className="text-light">
                          <strong>GTIN:</strong> {produto.gtin || "N/A"}
                        </small>
                      </div>
                    </Col>
                  </Row>
                  
                  {produto.marca && (
                    <div className="info-item mb-2">
                      <small className="text-light">
                        <strong>Marca:</strong> {produto.marca}
                      </small>
                    </div>
                  )}
                  
                  {produto.fornecedor.nome && (
                    <div className="info-item mb-2">
                      <small className="text-light">
                        <strong>Fornecedor:</strong> {produto.fornecedor.nome}
                      </small>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                {produto.descricao && (
                  <div className="produto-descricao mb-4">
                    <h6 className="text-light mb-2">Descrição</h6>
                    <p className="text-muted">
                      {produto.descricao}
                    </p>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="produto-acoes">
                  <Row className="g-3">
                    <Col xs={12} sm={6}>
                      <button className="btn btn-primary btn-lg w-100">
                        <i className="fas fa-shopping-cart me-2"></i>
                        Fazer Pedido
                      </button>
                    </Col>
                    <Col xs={12} sm={6}>
                      <button className="btn btn-primary btn-lg w-100">
                        <i className="fas fa-phone me-2"></i>
                        Falar com Vendedor
                      </button>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>

          {/* Informações adicionais */}
          <Row className="mt-5">
            <Col lg={12}>
              <Card className="border-0 shadow-lg" style={{ backgroundColor: "#f8f9fa" }}>
                <Card.Header className="bg-success text-light">
                  <h5 className="mb-0">Informações Técnicas</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <h6 className="text-dark mb-3">Especificações</h6>
                      <div className="row">
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Peso Líquido:</strong> {produto.pesoLiquido || "0"} kg
                          </p>
                        </div>
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Peso Bruto:</strong> {produto.pesoBruto || "0"} kg
                          </p>
                        </div>
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Estoque Mínimo:</strong> {produto.estoqueMinimo || "0"}
                          </p>
                        </div>
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Estoque Máximo:</strong> {produto.estoqueMaximo || "0"}
                          </p>
                        </div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <h6 className="text-dark mb-3">Outras Informações</h6>
                      <div className="row">
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Situação:</strong> 
                            <Badge bg={produto.situacao === "A" ? "success" : "danger"} className="ms-2">
                              {produto.situacao === "A" ? "Ativo" : "Inativo"}
                            </Badge>
                          </p>
                        </div>
                        <div className="col-6">
                          <p className="mb-2">
                            <strong>Garantia:</strong> {produto.garantia || "Não informado"}
                          </p>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Informações de Estoque */}
          {estoque && (
            <Row className="mt-5">
              <Col lg={12}>
                <Card className="border-0 shadow-lg" style={{ backgroundColor: "#f8f9fa" }}>
                  <Card.Header className="bg-success text-white">
                    <h5 className="mb-0">
                      <i className="fas fa-warehouse me-2"></i>
                      Informações de Estoque
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <Row className="mb-4">
                      <Col md={4}>
                        <div className="text-center">
                          <h3 className="text-success mb-2">{estoque.totalEstoque}</h3>
                          <p className="mb-0 text-muted">Total em Estoque</p>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-center">
                          <h3 className="text-info mb-2">{estoque.saldo}</h3>
                          <p className="mb-0 text-muted">Saldo Geral</p>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="text-center">
                          <h3 className="text-warning mb-2">{estoque.saldoReservado}</h3>
                          <p className="mb-0 text-muted">Saldo Reservado</p>
                        </div>
                      </Col>
                    </Row>

                    <h6 className="text-dark mb-3">Estoque por Depósito</h6>
                    <Table responsive striped bordered>
                      <thead className="table-dark">
                        <tr>
                          <th>Depósito</th>
                          <th>Empresa</th>
                          <th>Saldo</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estoque.depositos.map((dep, index) => (
                          <tr key={index}>
                            <td>{dep.deposito.nome}</td>
                            <td>{dep.deposito.empresa}</td>
                            <td>
                              <Badge 
                                bg={dep.deposito.saldo > 0 ? "success" : dep.deposito.saldo < 0 ? "danger" : "secondary"}
                              >
                                {dep.deposito.saldo} {produto.unidade}
                              </Badge>
                            </td>
                            <td>
                              {dep.deposito.saldo > 0 ? (
                                <Badge bg="success">Disponível</Badge>
                              ) : dep.deposito.saldo < 0 ? (
                                <Badge bg="danger">Em Débito</Badge>
                              ) : (
                                <Badge bg="secondary">Sem Estoque</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}


        </Container>
      </section>

      {/* Botão voltar */}
      <section className="voltar-section py-4">
        <Container>
          <Row className="justify-content-center">
            <Col className="text-center">
              <a href="/produtos" className="btn btn-outline-warning btn-lg">
                <i className="fas fa-arrow-left me-2"></i>
                Voltar para Produtos
              </a>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}
