"use client";

import LandingHeader from '@/components/layout/LandingHeader'
import { Container, Row, Col } from 'react-bootstrap'
import { useEffect, useState } from 'react'
import CategoriasMenu from '@/components/CategoriasMenu'



import { useRouter } from "next/navigation";
// Componente principal da landing page
function LandingPage() {
  // Ano atual para o footer
  const currentYear = new Date().getFullYear()
  
  // Estados para produtos
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Função para carregar produtos
  useEffect(() => {
    router.push("/produtos");
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
    // Div principal com classe CSS personalizada
    <div className="landing-page">
      {/* Cabeçalho da página */}
      {/* <LandingHeader /> */}
      
      {/* Logo da Alinça Mercantil */}
      <section className="logo-section py-4 bg-white">
        <Container>
          <Row className="justify-content-center">
            <Col className="text-center">
              <div className="company-logo">
                <h1 className="company-name text-warning mb-2">Alinça Mercantil</h1>
                <p className="company-tagline text-muted mb-0">
                  O parceiro do lojista
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Menu de Categorias */}
      <CategoriasMenu onCategoriaSelect={handleCategoriaSelect} />
      
      {/* Seção de Produtos */}
      <section className="products-section py-5 bg-dark text-white">
        <Container>
          
          
          {/* Campo de busca */}
          <Row className="justify-content-center mb-4">
            <Col lg={6} md={8}>
              <div>
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="form-control form-control-lg"
                />
                {loading && (
                  <div className="text-center mt-3">
                    <div className="spinner-border text-light" role="status">
                      <span className="visually-hidden">Carregando...</span>
                    </div>
                  </div>
                )}
              </div>
            </Col>
          </Row>
          
          {/* Lista de produtos */}
          <Row>
            {produtos.length > 0 ? (
              produtos.map((produto: any, index: number) => (
                <Col lg={4} md={6} className="mb-4" key={index}>
                  <div className="product-card h-100 border-0 shadow-sm bg-light">
                    <div className="product-card-body p-4">
                      <h5 className="product-title mb-3 text-primary">
                        <a 
                          href={`/produtos/${produto.produto.id}`}
                          className="text-decoration-none"
                        >
                          {produto.produto.nome}
                        </a>
                      </h5>
                      <div className="product-details">
                        <p className="product-price mb-2 text-dark">
                          <strong>Preço: R$ {Number(produto.produto.preco).toFixed(2) || "0,00"}</strong>
                        </p>
                        <p className="product-stock mb-0">
                          <small className="text-muted">
                            Estoque: {produto.produto.estoqueAtual || 0} unidades
                          </small>
                        </p>
                      </div>
                    </div>
                  </div>
                </Col>
              ))
            ) : (
              <Col className="text-center">
                <p className="text-muted">
                  {loading ? "Carregando produtos..." : "Nenhum produto encontrado."}
                </p>
              </Col>
            )}
          </Row>
        </Container>
      </section>

      {/* Seção CTA (Call to Action) */}
      <section className="cta-section py-5 bg-primary">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8} className="text-center">
              <div className="cta-card border-0 shadow-lg">
                <div className="cta-card-body p-5">
                  <h2 className="cta-title mb-3">Faça seu pedido agora mesmo!</h2>
                  <p className="cta-description mb-4">
                    Ao realizar o seu pedido, um vendedor entrará em contato com você para finalizar a compra.
                  </p>
                  <div className="cta-buttons">
                    <a 
                      href="/auth/sign-up" 
                      className="btn btn-primary btn-lg"
                    >
                      <i className="fas fa-shopping-cart me-2"></i>
                      Fazer Pedido
                    </a>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Rodapé da página */}
      <footer className="footer-section">
        <Container>
          <Row className="text-center">
            <Col>
              <p className="footer-text mb-0">
                © {currentYear} MSTI - Maciel Soluções em TI.
              </p>
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  )
}
export default LandingPage
