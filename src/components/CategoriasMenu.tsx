"use client";

import { useEffect, useState } from "react";
import { Nav, Navbar, NavDropdown, Container, Spinner } from "react-bootstrap";

interface Categoria {
  id: string;
  descricao: string;
  nodes: Categoria[];
}

interface CategoriasMenuProps {
  onCategoriaSelect?: (categoria: string) => void;
}

export default function CategoriasMenu({ onCategoriaSelect }: CategoriasMenuProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregarCategorias() {
      try {
        const response = await fetch("/api/categorias");
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setCategorias(data);
        } else {
          setError("Formato de dados inválido");
        }
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        setError("Falha ao carregar categorias");
      } finally {
        setLoading(false);
      }
    }

    carregarCategorias();
  }, []);

  const renderCategoriaDropdown = (categoria: Categoria, level: number = 0) => {
    const hasSubcategorias = categoria.nodes && categoria.nodes.length > 0;
    
    if (!hasSubcategorias) {
      return (
        <NavDropdown.Item 
          key={categoria.id}
          onClick={() => onCategoriaSelect?.(categoria.descricao)}
          className="categoria-base"
        >
          {categoria.descricao}
        </NavDropdown.Item>
      );
    }
    
    return (
      <NavDropdown 
        key={categoria.id}
        title={categoria.descricao}
        id={`categoria-${categoria.id}`}
        className="categoria-base"
      >
        {categoria.nodes.map((subcategoria) => 
          renderCategoriaDropdown(subcategoria, level + 1)
        )}
      </NavDropdown>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner animation="border" variant="warning" size="sm" />
        <span className="ms-2 text-light">Carregando categorias...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-3">
        <span className="text-danger">Erro ao carregar categorias</span>
      </div>
    );
  }

  return (
    <Navbar 
      expand="lg" 
      className="categorias-menu bg-dark border-bottom border-warning"
      style={{ minHeight: "60px" }}
    >
      <Container fluid>
        <Navbar.Collapse id="categorias-navbar">
          <Nav className="me-auto text-white">
            {categorias.map((categoria) => 
              renderCategoriaDropdown(categoria)
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
