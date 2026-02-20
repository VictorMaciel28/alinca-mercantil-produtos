"use client";

import { Container, Row, Col, Button, Card, Badge } from 'react-bootstrap'
import Link from 'next/link'



 
// Componente principal da landing page
export default function LandingPage() {
  const currentYear = new Date().getFullYear()

  const features = [
    {
      title: 'Gestão de vendedores',
      description:
        'Cadastre e edite vendedores, defina tipo (Vendedor/Televendas) e nível (Supervisor/Administrador) com controle de acesso granular.',
    },
    {
      title: 'Painel de pedidos',
      description:
        'Acompanhe pedidos em tempo real, altere status, consulte histórico e tenha visibilidade completa do funil.',
    },
    {
      title: 'Catálogo integrado',
      description:
        'Produtos, estoque e preços sincronizados para manter o time comercial sempre com informações atualizadas.',
    },
    {
      title: 'Comissões inteligentes',
      description:
        'Regras flexíveis por vendedor, relatório de comissões por período e visão clara da rentabilidade.',
    },
    {
      title: 'Relatórios estratégicos',
      description:
        'Dashboards e relatórios para decisões rápidas: performance por vendedor, volume de pedidos e conversão.',
    },
    {
      title: 'Segurança e auditoria',
      description:
        'Senhas criptografadas, níveis de acesso definidos e rastreabilidade das ações críticas.',
    },
  ]

  const steps = [
    { title: 'Configure o time', text: 'Cadastre vendedores e defina permissões conforme o papel.' },
    { title: 'Sincronize o catálogo', text: 'Mantenha preços e estoque atualizados para venda com segurança.' },
    { title: 'Monitore resultados', text: 'Acompanhe pedidos, comissões e indicadores em tempo real.' },
  ]

  const faqs = [
    {
      title: 'O sistema é preparado para diferentes perfis?',
      text: 'Sim. Você consegue separar Tipo de Acesso e Nível de Acesso com permissões específicas.',
    },
    {
      title: 'Como funciona a segurança das senhas?',
      text: 'As senhas são criptografadas no banco e o acesso é controlado por nível de acesso.',
    },
    {
      title: 'É possível acompanhar comissões por vendedor?',
      text: 'Sim. O módulo de comissões permite relatórios detalhados por período e por vendedor.',
    },
  ]

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="d-flex align-items-center gap-2">
              <img src="/favicon.ico" alt="SAMA" className="landing-brand-icon" />
              <div>
                <div className="landing-brand">Alinça Mercantil</div>
                <div className="landing-tagline"><b style={{ color: '#4f46e5' }}>S</b>istema <b style={{ color: '#4f46e5' }}>A</b>liança <b style={{ color: '#4f46e5' }}>M</b>ercantil <b style={{ color: '#4f46e5' }}>A</b>tacadista</div>
              </div>
            </Col>
            <Col md={6} className="text-md-end mt-3 mt-md-0">
              <div className="landing-nav">
                <a href="#features">Funcionalidades</a>
                <a href="#flow">Fluxo</a>
                <a href="#benefits">Benefícios</a>
                <a href="#faq">FAQ</a>
              </div>
              <Link href="/auth/sign-in" className="ms-md-3">
                <Button className="landing-btn-primary">Entrar</Button>
              </Link>
            </Col>
          </Row>
        </Container>
      </header>

      <section className="landing-hero">
        <Container>
          <Row className="align-items-center g-4">
            <Col lg={6}>
              <Badge className="landing-badge">Nova experiência de gestão</Badge>
              <h1 className="landing-title">
                Plataforma integrada para gestão comercial e performance de vendas.
              </h1>
              <p className="landing-subtitle">
                Centralize vendedores, pedidos, comissões e catálogo em um painel integrado, com visual limpo,
                controle de permissões e relatórios estratégicos para decisões rápidas.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link href="/auth/sign-in">
                  <Button size="lg" className="landing-btn-primary">Entrar no sistema</Button>
                </Link>
                <a className="btn btn-outline-secondary btn-lg landing-btn-outline" href="#features">
                  Ver funcionalidades
                </a>
              </div>
              <div className="landing-stats">
                <div>
                  <strong>100%</strong>
                  <span>Controle de acesso</span>
                </div>
                <div>
                  <strong>+12</strong>
                  <span>Relatórios e métricas</span>
                </div>
                <div>
                  <strong>24/7</strong>
                  <span>Visibilidade operacional</span>
                </div>
              </div>
            </Col>
            <Col lg={6}>
              <div className="landing-hero-card">
                <h5 className="mb-2">Visão rápida do sistema</h5>
                <p className="text-muted mb-3">
                  Organize o fluxo comercial do início ao fim com módulos integrados e um painel claro para tomada de decisão.
                </p>
                <ul className="landing-list">
                  <li>Cadastro de vendedores com permissões por nível</li>
                  <li>Pedidos com status e acompanhamento detalhado</li>
                  <li>Catálogo sincronizado com preços e estoque</li>
                  <li>Comissões e relatórios por vendedor</li>
                </ul>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section id="features" className="landing-section">
        <Container>
          <div className="landing-section-header">
            <span className="landing-kicker">Funcionalidades</span>
            <h2 className="landing-heading-light">Uma plataforma robusta para o time comercial</h2>
            <p className="text-muted">
              Cada módulo foi pensado para simplificar a operação, aumentar a produtividade e dar clareza ao gestor.
            </p>
          </div>
          <Row className="g-4">
            {features.map((item) => (
              <Col key={item.title} md={6} lg={4}>
                <Card className="landing-card h-100">
                  <Card.Body>
                    <Card.Title>{item.title}</Card.Title>
                    <Card.Text className="text-muted">{item.description}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section id="flow" className="landing-section landing-section-alt">
        <Container>
          <div className="landing-section-header">
            <span className="landing-kicker">Fluxo de trabalho</span>
            <h2>Do cadastro ao resultado em poucos passos</h2>
          </div>
          <Row className="g-4">
            {steps.map((step, index) => (
              <Col key={step.title} md={4}>
                <div className="landing-step">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h5>{step.title}</h5>
                  <p className="text-muted mb-0">{step.text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section id="benefits" className="landing-section">
        <Container>
          <div className="landing-section-header">
            <span className="landing-kicker">Benefícios</span>
            <h2 className="landing-heading-light">Mais controle, menos retrabalho</h2>
          </div>
          <Row className="g-4">
            <Col md={6}>
              <Card className="landing-card h-100">
                <Card.Body>
                  <Card.Title>Produtividade do time</Card.Title>
                  <Card.Text className="text-muted">
                    Processos mais rápidos para receber pedidos, atribuir vendedores e manter o time focado nas vendas.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="landing-card h-100">
                <Card.Body>
                  <Card.Title>Segurança operacional</Card.Title>
                  <Card.Text className="text-muted">
                    Senhas criptografadas, níveis de acesso bem definidos e auditoria das ações importantes.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <section id="faq" className="landing-section landing-section-alt">
        <Container>
          <div className="landing-section-header">
            <span className="landing-kicker">FAQ</span>
            <h2>Dúvidas frequentes</h2>
          </div>
          <Row className="g-4">
            {faqs.map((faq) => (
              <Col key={faq.title} md={4}>
                <Card className="landing-card h-100">
                  <Card.Body>
                    <Card.Title>{faq.title}</Card.Title>
                    <Card.Text className="text-muted">{faq.text}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="landing-cta">
        <Container>
          <Row className="align-items-center">
            <Col lg={8}>
              <h3>Acesse agora mesmo!</h3>
              <p className="mb-0">
                Acesse o painel, cadastre vendedores e organize seu fluxo de vendas com clareza e performance.
              </p>
            </Col>
            <Col lg={4} className="text-lg-end mt-3 mt-lg-0">
              <Link href="/auth/sign-in">
                <Button size="lg" variant="light">Entrar agora</Button>
              </Link>
            </Col>
          </Row>
        </Container>
      </section>

      <footer className="landing-footer">
        <Container className="text-center">
          <small>© {currentYear} Alinça Mercantil. Todos os direitos reservados.</small>
        </Container>
      </footer>
    </div>
  )
}
