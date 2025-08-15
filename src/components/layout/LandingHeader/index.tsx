'use client'

import { useState } from 'react'
import { Navbar, Container, Nav, Form, Button } from 'react-bootstrap'
import Image from 'next/image'
import logoDark from '@/assets/images/logo-dark.png'

// Componente do cabeçalho da landing page
function LandingHeader() {
  // Estado para controlar a busca
  const [searchQuery, setSearchQuery] = useState('')

  // Função para lidar com a busca
  function handleSearch(e) {
    e.preventDefault()
    console.log('Buscando por:', searchQuery)
  }

  return (
    <div>
      {/* Header principal com logo, busca e botões de login */}
      <Navbar bg="white" expand="lg" className="landing-header">
        <Container>
          {/* Logo da editora */}
          <Navbar.Brand href="/" className="me-4">
            <Image
              src={logoDark}
              alt="Aliança Mercantil"
              width={150}
              height={40}
              className="d-inline-block align-top"
            />
          </Navbar.Brand>

          {/* Campo de pesquisa */}
          <Form className="d-flex me-3" onSubmit={handleSearch}>
            <Form.Control
              type="search"
              placeholder="Pesquisar artigos..."
              className="me-2"
              aria-label="Pesquisar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline-primary" type="submit" className="search-btn">
              <i className="fas fa-search"></i>
            </Button>
          </Form>

          {/* Botões de login e registro */}
          <Nav>
            <Nav.Link href="/auth/sign-in" className="btn btn-outline-primary me-2">
              Login
            </Nav.Link>
            <Nav.Link href="/auth/sign-up" className="btn btn-primary">
              Registrar
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      {/* Menu de navegação */}
      <Navbar bg="light" expand="lg" className="landing-navigation">
        <Container>
          {/* Botão para menu mobile */}
          <Navbar.Toggle aria-controls="navigation-nav" />

          {/* Menu de navegação */}
          <Navbar.Collapse id="navigation-nav">
            <Nav className="mx-auto">
              <Nav.Link href="/" className="nav-link">Home</Nav.Link>
              <Nav.Link href="/sobre" className="nav-link">Sobre</Nav.Link>
              <Nav.Link href="/publique" className="nav-link">Publique com a gente</Nav.Link>
              <Nav.Link href="/publicacoes" className="nav-link">Publicações</Nav.Link>
              <Nav.Link href="/autores" className="nav-link">Para Autores</Nav.Link>
              <Nav.Link href="/mais" className="nav-link">Mais</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  )
}

export default LandingHeader