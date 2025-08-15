'use client'

// Importações necessárias para o React e componentes
import { useEffect, useState } from 'react'
import { Card, CardBody, Button, Col, Row, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormControl, FormLabel, FormSelect } from 'react-bootstrap'
import PageTitle from '@/components/PageTitle'
import Image from 'next/image'
import useToggle from '@/hooks/useToggle'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

function MagazineSubmissionPage() {
  // Hook para obter dados da sessão do usuário
  const { data: session } = useSession()
  
  // Estados para gerenciar os dados da página
  const [magazines, setMagazines] = useState([])
  const [selectedMagazine, setSelectedMagazine] = useState(null)

  const [form, setForm] = useState({
    articleType: 'Review Article',
    title: '',
    abstract: '',
    keywords: '',
    wordFile: null,
    committeeLetterFile: null,
    graphicalAbstractFile: null,
  })

  // Hook para controlar o modal
  const { isTrue: showModal, setFalse: closeModal, setTrue: openModal } = useToggle()
  const router = useRouter();

  useEffect(() => {
    fetch('/api/magazine')
      .then((res) => res.json())
      .then(setMagazines)
  }, [])

  async function handleSubmit() {
    try {
      console.log('Session data:', session)
      console.log('Selected magazine:', selectedMagazine)
      
      // Verifica se uma revista foi selecionada
      if (!selectedMagazine) {
        alert('Por favor, selecione uma revista')
        return
      }

      // Verifica se o usuário está logado
      if (!session || !session.user || !session.user.id) {
        console.log('Usuário não logado. Session:', session)
        alert('Usuário não identificado. Faça login novamente.')
        return
      }

      // Usa um ID padrão se não conseguir obter da sessão
      const userId = session.user.id || '1'
      console.log('User ID sendo usado:', userId)

      const formData = new FormData()
      formData.append('articleType', form.articleType)
      formData.append('title', form.title)
      formData.append('abstract', form.abstract)
      formData.append('keywords', form.keywords)
      formData.append('magazineId', selectedMagazine.id.toString())
      formData.append('userId', userId) // Adiciona o ID do usuário logado
      
      // Os arquivos serão enviados no passo 3 do wizard

      // Envia a submissão para o servidor
      const response = await fetch('/api/magazine/submission', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao enviar submissão')
      }

      const result = await response.json()
      closeModal()
      
      // Redireciona para o wizard da submissão específica
      router.push(`/submission/${result.id}/wizard?step=1`)
      
    } catch (error) {
      console.error('Erro na submissão:', error)
      alert('Erro ao enviar submissão: ' + error.message)
    }
  }

  return (
    <>
      <PageTitle title="Editais Abertos" subName="Revistas Disponíveis" />
      <Row className="g-4">
        {magazines.map((magazine) => (
          <Col key={magazine.id} lg={4} xl={3}>
            <Card className="overflow-hidden shadow-sm h-100">
              <div className="position-relative">
                <Image
                  src={`/uploads/images/magazine/${magazine.coverImage}`}
                  alt={`Capa da revista ${magazine.title}`}
                  width={600}
                  height={300}
                  className="img-fluid object-fit-cover"
                  style={{ width: '100%', height: '300px' }}
                />
              </div>
              <CardBody>
                <h5 className="fw-bold mb-1">{magazine.title}</h5>
                <p className="text-muted small mb-2">
                  Data prevista: {new Date(magazine.publishDate).toLocaleDateString()}
                </p>
                <p className="mb-3">{magazine.description}</p>
                <div className="d-flex justify-content-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedMagazine(magazine)
                      openModal()
                    }}>
                    Submeter
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={showModal} onHide={closeModal} centered scrollable>
        <ModalHeader closeButton>
          <h5 className="modal-title">Submeter para: {selectedMagazine?.title}</h5>
        </ModalHeader>
        
        <ModalBody>
          <Form>
            {/* Tipo de Artigo */}
            <FormLabel>Tipo de Artigo</FormLabel>
            <FormSelect value={form.articleType} onChange={(e) => setForm({ ...form, articleType: e.target.value })}>
              <option value="Review Article">Review Article</option>
            </FormSelect>

            <FormLabel className="mt-2">Título</FormLabel>
            <FormControl type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <FormLabel className="mt-2">Abstract</FormLabel>
            <FormControl as="textarea" rows={3} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />

            <FormLabel className="mt-2">Palavras-chave</FormLabel>
            <FormControl type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />

            {/* Os arquivos serão enviados no passo 3 do wizard */}
            <div className="alert alert-info mt-3">
              <small>
                <strong>Nota:</strong> Os documentos (Word, Carta do Comitê e Graphical Abstract) 
                serão solicitados no próximo passo do processo de submissão.
              </small>
            </div>
          </Form>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Enviar Submissão
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default MagazineSubmissionPage