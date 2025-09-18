"use client";

import { useEffect, useState } from "react";
import { Container, Row, Col, Card, Form, Spinner } from "react-bootstrap";
import CategoriasMenu from '@/components/CategoriasMenu';

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function carregarProdutos() {
      setLoading(true);
      try {
        const response = await fetch(`/api/produtos?q=${encodeURIComponent(busca)}`);
        const data = await response.json();
        if (data.retorno?.produtos) {
          setProdutos(data.retorno.produtos);
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      } finally {
        setLoading(false);
      }
    }
    carregarProdutos();
  }, [busca]);

  // Função para lidar com seleção de categoria
  const handleCategoriaSelect = (categoria: string) => {
    setBusca(categoria);
  };

  return (
    <div className="produtos-page min-vh-100">
      {/* Header da página */}
      <section className="page-header py-5 bg-dark">
        <Container>
          <Row className="justify-content-end mb-3">
            <Col className="d-flex justify-content-end">
              <a href="/auth/sign-in" className="btn btn-outline-light btn-sm white text-white">
                Entrar
              </a>
            </Col>
          </Row>
          <Row className="justify-content-center text-center">
            <Col lg={8}>
              <h1 className="text-white display-4 mb-3 text-warning" style={{ fontSize: "3rem" }}>Aliança Mercantil Atacadista</h1>
              <p className="text-light lead mb-4">
                Descubra nossa coleção completa de materiais industriais
              </p>
              
              {/* Campo de busca */}
              <div>
                <Form.Control
                  type="text"
                  placeholder="Buscar produtos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Menu de Categorias */}
      {/* <CategoriasMenu onCategoriaSelect={handleCategoriaSelect} /> */}

      {/* Lista de produtos */}
      <section className="produtos-lista py-5">
        <Container>
          {loading ? (
            <Row className="justify-content-center">
              <Col className="text-center">
                <Spinner animation="border" variant="warning" />
                <p className="text-light mt-3">Carregando produtos...</p>
              </Col>
            </Row>
          ) : produtos.length > 0 ? (
            <Row className="g-4">
              {produtos.map((p: any, index) => (
                <Col key={index} lg={4} md={6} className="mb-4">
                  <Card 
                    className="produto-card h-100 border-0 shadow-lg"
                    style={{ 
                      backgroundColor: "#f8f9fa",
                      transition: "transform 0.2s ease-in-out"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-5px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <Card.Body className="p-4">
                      {/* Código do produto */}
                      <div className="produto-codigo mb-2">
                        <small className="text-muted">
                          <strong>Código:</strong> {p.produto.codigo || "N/A"}
                        </small>
                      </div>

                      {/* Nome do produto */}
                      <Card.Title className="produto-nome mb-3">
                        <a 
                          href={`/produtos/${p.produto.id}`}
                          className="text-decoration-none text-dark"
                        >
                          {p.produto.nome}
                        </a>
                      </Card.Title>

                      {/* Preços */}
                      <div className="produto-precos mb-3">
                        {p.produto.precoPromocional && p.produto.precoPromocional > 0 ? (
                          <div>
                            <span className="text-muted text-decoration-line-through me-2">
                              R$ {Number(p.produto.preco).toFixed(2)}
                            </span>
                            <span className="text-warning fs-5 fw-bold">
                              R$ {Number(p.produto.precoPromocional).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-primary fs-5 fw-bold">
                            R$ {Number(p.produto.preco).toFixed(2) || "0,00"}
                          </span>
                        )}
                      </div>

                      {/* Unidade */}
                      <div className="mb-2">
                          Unidade: {p.produto.unidade || "PC"}
                      </div>

                      {/* Botão de ação */}
                      <div className="produto-acoes">
                        <a 
                          href={`/produtos/${p.produto.id}`}
                          className="btn btn-primary w-100"
                        >
                          Ver Detalhes
                        </a>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Row className="justify-content-center">
              <Col className="text-center">
                <div className="text-light">
                  <i className="fas fa-search fa-3x mb-3 text-muted"></i>
                  <h4 className="text-muted">Nenhum produto encontrado</h4>
                  <p className="text-muted">
                    {busca ? `Não encontramos produtos para "${busca}"` : "Nenhum produto disponível no momento"}
                  </p>
                </div>
              </Col>
            </Row>
          )}
        </Container>
      </section>

      {/* Estatísticas */}
      {/* <section className="estatisticas py-4 bg-warning">
        <Container>
          <Row className="text-center">
            <Col md={4}>
              <div className="text-white">
                <h3 className="mb-2">{produtos.length}</h3>
                <p className="mb-0">Produtos Encontrados</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-white">
                <h3 className="mb-2">100%</h3>
                <p className="mb-0">Qualidade Garantida</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-white">
                <h3 className="mb-2">24h</h3>
                <p className="mb-0">Suporte Técnico</p>
              </div>
            </Col>
          </Row>
        </Container>
      </section> */}
    </div>
  );
}


