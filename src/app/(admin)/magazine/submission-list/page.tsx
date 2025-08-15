'use client'

import { Table, Button } from 'react-bootstrap'
import { useEffect, useState } from 'react'
import PageTitle from '@/components/PageTitle'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

function SubmissionListPage() {
  // Hook para obter dados da sessão do usuário
  const { data: session } = useSession()
  
  const [articles, setArticles] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchArticles() {
      try {
        setIsLoading(true)
        // Busca apenas as submissões do usuário logado
        const userId = session && session.user ? session.user.id : '1'
        const res = await fetch(`/api/magazine/submission/user?userId=${userId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setArticles(data)
      } catch (error) {
        console.error('Erro ao carregar submissões:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [])

  return (
    <>
      <PageTitle title="Minhas Submissões" subName="Usuário" />
      
      {/* Loading */}
      {isLoading && (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-2">Carregando suas submissões...</p>
        </div>
      )}

      {/* Lista de submissões */}
      {!isLoading && (
        <div className="table-responsive">
          <Table striped bordered hover className="align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Revista</th>
                <th>Tipo</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    <p className="text-muted">Nenhuma submissão encontrada.</p>
                    <Link href="/magazine/submission-page">
                      <Button variant="primary" size="sm">
                        Fazer Primeira Submissão
                      </Button>
                    </Link>
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id}>
                    <td>{article.id}</td>
                    <td>
                      <strong>{article.title}</strong>
                      <br />
                      <small className="text-muted">{article.keywords}</small>
                    </td>
                    <td>{article.Magazine ? article.Magazine.title : 'N/A'}</td>
                    <td>{article.articleType}</td>
                    <td>{new Date(article.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <Link href={`/submission/${article.id}/wizard?step=1`}>
                        <Button variant="primary" size="sm">
                          Continuar
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </>
  )
}

export default SubmissionListPage