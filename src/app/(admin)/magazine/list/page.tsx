"use client"

import ComponentContainerCard from '@/components/ComponentContainerCard'
import PageTitle from '@/components/PageTitle'
import { Table, Button } from 'react-bootstrap'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type Magazine = {
  id: number
  title: string
  publishDate: string
  status: string
  createdAt: string
  updatedAt: string
}

const MagazineListPage = () => {
  const [magazines, setMagazines] = useState<Magazine[]>([])
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchMagazines = async () => {
      try {
        const res = await fetch('/api/magazine', { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao buscar revistas')
        const data = await res.json()
        setMagazines(data)
      } catch (err) {
        setError('Erro ao buscar revistas')
      }
    }
    fetchMagazines()
  }, [])

  const handleEdit = (id: number) => {
    router.push(`/magazine/form?id=${id}`)
  }

  const handleRemove = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover esta revista?')) return
    const res = await fetch(`/api/magazine/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMagazines(magazines.filter(m => m.id !== id))
    } else {
      setError('Erro ao remover revista.')
    }
  }

  return (
    <>
      <PageTitle title="Revistas Cadastradas" subName="Admin" />
      <ComponentContainerCard id="magazine-list" title="Lista" description={<> </>}>
        {error && <div className="alert alert-danger mt-2">{error}</div>}
        <div className="table-responsive">
          <Table striped className="table-centered align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Título</th>
                <th>Data Prevista</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {magazines.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{new Date(item.publishDate).toLocaleDateString()}</td>
                  <td>{item.status}</td>
                  <td className="d-flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleEdit(item.id)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleRemove(item.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </ComponentContainerCard>
    </>
  )
}

export default MagazineListPage