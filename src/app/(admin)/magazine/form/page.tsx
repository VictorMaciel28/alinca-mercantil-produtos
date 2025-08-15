'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Button, Row, Col, FormLabel, FormControl, FormSelect, Alert } from 'react-bootstrap'
import ComponentContainerCard from '@/components/ComponentContainerCard'
import PageTitle from '@/components/PageTitle'
import DropzoneFormInput from '@/components/from/DropzoneFormInput'

const MagazinePage = () => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    publishDate: '',
    status: 'aberto',
    coverFile: null as File | null,
  })

  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formData = new FormData()
    if (form.coverFile) formData.append('cover', form.coverFile)
    formData.append('title', form.title)
    formData.append('description', form.description)
    formData.append('publishDate', form.publishDate)
    formData.append('status', form.status)

    const res = await fetch('/api/magazine', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      setSuccess(true)
      setTimeout(() => router.push('/magazine/list'), 1500)
    } else {
      setError('Erro ao criar revista. Tente novamente.')
    }
  }

  return (
    <>
      <PageTitle title="Nova Revista" subName="Admin" />

      <ComponentContainerCard id="magazine-form" title="Criar Revista" description="Preencha os dados da nova revista científica.">
        <Form onSubmit={handleSubmit} encType="multipart/form-data">
          <Row className="mb-3">
            <Col md={6}>
              <FormLabel>Título</FormLabel>
              <FormControl
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Col>
            <Col md={6}>
              <FormLabel>Data Prevista de Publicação</FormLabel>
              <FormControl
                type="date"
                value={form.publishDate}
                onChange={(e) => setForm({ ...form, publishDate: e.target.value })}
                required
              />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={12}>
              <FormLabel>Descrição</FormLabel>
              <FormControl
                as="textarea"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6}>
              <FormLabel>Estado</FormLabel>
              <FormSelect
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="aberto">Aberto</option>
                <option value="fechado">Fechado</option>
              </FormSelect>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={12}>
              <FormLabel>Capa da Revista</FormLabel>
              <DropzoneFormInput
                iconProps={{ icon: 'bx:cloud-upload', height: 36, width: 36 }}
                text="Arraste ou clique para enviar a imagem da capa"
                helpText="Formatos aceitos: jpg, png. Tamanho máximo: 5MB"
                showPreview
                onFileUpload={(files) => setForm({ ...form, coverFile: files[0] || null })}
              />
            </Col>
          </Row>

          <Button type="submit" variant="primary">
            Criar Revista
          </Button>
        </Form>
        {success && <Alert variant="success" className="mt-3">Revista criada com sucesso! Redirecionando...</Alert>}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
      </ComponentContainerCard>
    </>
  )
}

export default MagazinePage