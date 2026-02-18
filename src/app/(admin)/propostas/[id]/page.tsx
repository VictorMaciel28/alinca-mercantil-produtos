 "use client";
 
 import { useEffect, useMemo, useState } from "react";
 import { useParams, useRouter } from "next/navigation";
 import PageTitle from '@/components/PageTitle'
 import { Card, Row, Col, Form, Button, Spinner } from 'react-bootstrap'
 import { getPropostas, createProposta } from '@/services/propostas'
 
 export default function PropostaFormPage() {
   const params = useParams()
   const router = useRouter()
   const idParam = useMemo(() => Number(params?.id ?? 0), [params])
   const isNew = idParam === 0

  const [form, setForm] = useState({
    id: 0,
    data: new Date().toISOString().slice(0, 10),
    cliente: '',
    cnpj: '',
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      if (!isNew) {
        setLoading(true)
        try {
          const rows = await getPropostas()
          const p = rows.find((r) => Number(r.numero) === idParam)
          if (p) {
            setForm({
              id: p.numero,
              data: p.data,
              cliente: p.cliente,
              cnpj: p.cnpj,
              total: p.total,
            })
          }
        } finally {
          setLoading(false)
        }
      }
    })()
  }, [idParam, isNew])

  const handleChange = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createProposta({
        id: isNew ? undefined : form.id,
        data: form.data,
        cliente: form.cliente,
        cnpj: form.cnpj,
        total: form.total,
      })
      router.push('/propostas')
    } catch (err: any) {
      alert('Falha ao salvar proposta: ' + (err?.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle title={isNew ? 'Nova Proposta' : `Proposta ${form.id}`} subName={isNew ? 'Criação' : 'Edição'} />
      <Card className="border-0 shadow-sm mb-3">
        <Card.Header className="bg-white fw-semibold">Dados da proposta</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /><span>Carregando...</span></div>
          ) : (
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Label>Data</Form.Label>
                  <Form.Control type="date" value={form.data} onChange={(e) => handleChange('data', e.target.value)} />
                </Col>
                <Col md={8}>
                  <Form.Label>Cliente</Form.Label>
                  <Form.Control type="text" value={form.cliente} onChange={(e) => handleChange('cliente', e.target.value)} required />
                </Col>
              </Row>

              <Row className="g-3 mt-2">
                <Col md={6}>
                  <Form.Label>CNPJ / CPF</Form.Label>
                  <Form.Control type="text" value={form.cnpj} onChange={(e) => handleChange('cnpj', e.target.value)} />
                </Col>
                <Col md={6}>
                  <Form.Label>Total</Form.Label>
                  <Form.Control type="number" step="0.01" value={form.total} onChange={(e) => handleChange('total', Number(e.target.value || 0))} />
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-4">
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : (isNew ? 'Criar proposta' : 'Salvar')}</Button>
                <Button variant="secondary" onClick={() => router.push('/propostas')}>Cancelar</Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </>
  )
}


