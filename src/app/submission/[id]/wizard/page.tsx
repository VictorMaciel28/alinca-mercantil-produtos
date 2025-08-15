'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardBody, CardHeader, CardTitle, Row, Col, Button, Form, FormControl, FormLabel, Alert, Table } from 'react-bootstrap'
import PageTitle from '@/components/PageTitle'
import { useRouter } from 'next/navigation'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import Link from 'next/link'

// Componente para o Passo 1 - Dados Enviados
function Step1Data({ article }) {
  return (
    <div>
      <h4 className="mb-4">Dados Enviados</h4>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <FormLabel>Título</FormLabel>
            <FormControl
              type="text"
              value={article ? article.title : ''}
              readOnly
              className="bg-light"
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <FormLabel>Tipo de Artigo</FormLabel>
            <FormControl
              type="text"
              value={article ? article.articleType : ''}
              readOnly
              className="bg-light"
            />
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <FormLabel>Revista (Edital)</FormLabel>
            <FormControl
              type="text"
              value={article && article.Magazine ? article.Magazine.title : ''}
              readOnly
              className="bg-light"
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <FormLabel>Palavras-chave</FormLabel>
            <FormControl
              type="text"
              value={article ? article.keywords : ''}
              readOnly
              className="bg-light"
            />
          </Form.Group>
        </Col>
      </Row>
      <Form.Group className="mb-3">
        <FormLabel>Abstract</FormLabel>
        <FormControl
          as="textarea"
          rows={4}
          value={article ? article.abstract : ''}
          readOnly
          className="bg-light"
        />
      </Form.Group>
    </div>
  )
}

// Componente para o Passo 2 - Autores
function Step2Authors() {
  const [authors, setAuthors] = useState([])
  const [currentName, setCurrentName] = useState('')
  const [currentEmail, setCurrentEmail] = useState('')
  const [currentInstagram, setCurrentInstagram] = useState('')
  const [editIndex, setEditIndex] = useState(-1)
  const [pdfFile, setPdfFile] = useState(null)
  const [emailError, setEmailError] = useState('')

  function handleAddOrEdit() {
    if (!currentName || !currentEmail) {
      alert('Nome e email são obrigatórios!')
      return
    }
    
    if (!currentEmail.includes('@')) {
      setEmailError('O email deve conter o caractere "@".')
      return
    } else {
      setEmailError('')
    }

    const newAuthor = {
      nome: currentName,
      email: currentEmail,
      instagram: currentInstagram
    }

    if (editIndex !== -1) {
      const updated = [...authors]
      updated[editIndex] = newAuthor
      setAuthors(updated)
      setEditIndex(-1)
    } else {
      setAuthors([...authors, newAuthor])
    }
    
    setCurrentName('')
    setCurrentEmail('')
    setCurrentInstagram('')
  }

  function handleEdit(idx) {
    const author = authors[idx]
    setCurrentName(author.nome)
    setCurrentEmail(author.email)
    setCurrentInstagram(author.instagram || '')
    setEditIndex(idx)
  }

  function handleRemove(idx) {
    const newAuthors = authors.filter((_, i) => i !== idx)
    setAuthors(newAuthors)
    if (editIndex === idx) {
      setEditIndex(-1)
      setCurrentName('')
      setCurrentEmail('')
      setCurrentInstagram('')
    }
  }

  return (
    <>
      <div className="d-flex align-items-center mb-2">
        <h4 className="fs-16 fw-semibold mb-1 mb-0">Autores</h4>
      </div>
      <p className="text-muted">Adicione os autores do trabalho e faça upload do PDF de autorização.</p>
      <div className="mb-3">
        <Row>
          <Col md={4}>
            <FormLabel>Nome *</FormLabel>
            <FormControl
              type="text"
              value={currentName}
              onChange={e => setCurrentName(e.target.value)}
              required
              placeholder="Nome do autor"
            />
          </Col>
          <Col md={4}>
            <FormLabel>Email *</FormLabel>
            <FormControl
              type="email"
              value={currentEmail}
              onChange={e => {
                setCurrentEmail(e.target.value)
                if (emailError && e.target.value.includes('@')) setEmailError('')
              }}
              required
              placeholder="Email do autor"
              isInvalid={!!emailError}
            />
            {emailError && <div className="text-danger small mt-1">{emailError}</div>}
          </Col>
          <Col md={3}>
            <FormLabel>Instagram</FormLabel>
            <FormControl
              type="text"
              value={currentInstagram}
              onChange={e => setCurrentInstagram(e.target.value)}
              placeholder="@usuario"
            />
          </Col>
          <Col md={1} className="d-flex align-items-end">
            <Button 
              type="button" 
              variant="primary" 
              onClick={handleAddOrEdit} 
              disabled={!currentName || !currentEmail || !!emailError}
            >
              {editIndex !== -1 ? 'Salvar' : 'Adicionar'}
            </Button>
          </Col>
        </Row>
      </div>
      {authors.length > 0 && (
        <div className="table-responsive">
          <Table bordered hover size="sm" className="mb-4">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Instagram</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {authors.map((a, idx) => (
                <tr key={idx}>
                  <td>{a.nome}</td>
                  <td>{a.email}</td>
                  <td>{a.instagram}</td>
                  <td>
                    <Button size="sm" variant="warning" className="me-2" type="button" onClick={() => handleEdit(idx)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="danger" type="button" onClick={() => handleRemove(idx)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <FormLabel>PDF de autorização dos autores</FormLabel>
            <FormControl
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
            />
            <Form.Text className="text-muted">
              Envie o PDF de autorização assinado por todos os autores.
            </Form.Text>
          </Form.Group>
          {pdfFile && <div className="mt-2">Arquivo selecionado: {pdfFile.name}</div>}
        </Col>
      </Row>
    </>
  )
}

// Componente para o Passo 3 - Documentação
function Step3Documentation() {
  const [wordFile, setWordFile] = useState(null)
  const [committeeLetterFile, setCommitteeLetterFile] = useState(null)
  const [graphicalAbstractFile, setGraphicalAbstractFile] = useState(null)

  return (
    <div>
      <h4 className="mb-4">Documentação</h4>
      
      <Alert variant="info" className="mb-4">
        <strong>Importante:</strong> Todos os documentos são obrigatórios para completar a submissão.
      </Alert>

      {/* Upload do Artigo Word */}
      <div className="mb-4">
        <h5>Artigo (Documento Word)</h5>
        <Form.Group>
          <FormLabel>Upload do artigo em formato Word</FormLabel>
          <FormControl
            type="file"
            accept=".doc,.docx"
            onChange={(e) => setWordFile(e.target.files ? e.target.files[0] : null)}
          />
          <Form.Text className="text-muted">
            Aceita arquivos DOC ou DOCX. Máximo 20MB.
          </Form.Text>
        </Form.Group>
        {wordFile && (
          <div className="mt-2 text-success">
            <i className="fas fa-check me-2"></i>
            Arquivo selecionado: {wordFile.name}
          </div>
        )}
      </div>

      {/* Upload da Carta do Comitê */}
      <div className="mb-4">
        <h5>Carta do Comitê</h5>
        <Form.Group>
          <FormLabel>Upload da carta do comitê de ética</FormLabel>
          <FormControl
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setCommitteeLetterFile(e.target.files ? e.target.files[0] : null)}
          />
          <Form.Text className="text-muted">
            Aceita arquivos PDF, DOC ou DOCX. Máximo 10MB.
          </Form.Text>
        </Form.Group>
        {committeeLetterFile && (
          <div className="mt-2 text-success">
            <i className="fas fa-check me-2"></i>
            Arquivo selecionado: {committeeLetterFile.name}
          </div>
        )}
      </div>

      {/* Upload do Graphical Abstract */}
      <div className="mb-4">
        <h5>Graphical Abstract</h5>
        <Form.Group>
          <FormLabel>Upload do graphical abstract</FormLabel>
          <FormControl
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) => setGraphicalAbstractFile(e.target.files ? e.target.files[0] : null)}
          />
          <Form.Text className="text-muted">
            Aceita arquivos JPG, PNG ou PDF. Máximo 5MB.
          </Form.Text>
        </Form.Group>
        {graphicalAbstractFile && (
          <div className="mt-2 text-success">
            <i className="fas fa-check me-2"></i>
            Arquivo selecionado: {graphicalAbstractFile.name}
          </div>
        )}
      </div>
    </div>
  )
}

function SubmissionWizard() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [activeStep, setActiveStep] = useState(1)
  const [article, setArticle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Carrega os dados da submissão
  async function loadArticle() {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('Carregando submissão ID:', params.id)
      const response = await fetch(`/api/magazine/submission/${params.id}`)
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        // Se não conseguir carregar do banco, usa dados de exemplo para teste
        console.log('Usando dados de exemplo para teste')
        const mockData = {
          id: parseInt(params.id),
          title: 'Artigo de Teste - Título do Artigo',
          abstract: 'Este é um abstract de teste para verificar se a interface está funcionando corretamente. O abstract deve conter informações sobre o objetivo, metodologia e resultados esperados do estudo.',
          keywords: 'teste, artigo, pesquisa, metodologia',
          articleType: 'Review Article',
          wordFile: '',
          committeeLetterFile: '',
          graphicalAbstractFile: '',
          magazineId: 1,
          userId: 1,
          Magazine: {
            title: 'Revista de Teste - Edital Aberto'
          },
          createdAt: new Date().toISOString()
        }
        setArticle(mockData)
        return
      }
      
      const data = await response.json()
      console.log('Dados carregados:', data)
      setArticle(data)
    } catch (error) {
      console.error('Erro ao carregar artigo:', error)
      // Em caso de erro, também usa dados de exemplo
      const mockData = {
        id: parseInt(params.id),
        title: 'Artigo de Teste - Erro no Carregamento',
        abstract: 'Dados de exemplo devido a erro na conexão com o banco de dados.',
        keywords: 'teste, erro, banco',
        articleType: 'Review Article',
        wordFile: '',
        committeeLetterFile: '',
        graphicalAbstractFile: '',
        magazineId: 1,
        userId: 1,
        Magazine: {
          title: 'Revista de Teste - Erro'
        },
        createdAt: new Date().toISOString()
      }
      setArticle(mockData)
    } finally {
      setIsLoading(false)
    }
  }

  // Carrega o artigo quando o componente monta
  useEffect(() => {
    if (params.id) {
      loadArticle()
    }
  }, [params.id])

  // Define o passo atual baseado na URL
  useEffect(() => {
    const step = searchParams.get('step')
    if (step) {
      setActiveStep(parseInt(step))
    }
  }, [searchParams])

  // Função para navegar entre os passos
  function goToStep(step) {
    router.push(`/submission/${params.id}/wizard?step=${step}`)
  }

  // Função para finalizar o wizard
  function handleFinish() {
    router.push('/magazine/submission-list')
  }

  // Configuração dos passos do wizard
  const wizardSteps = [
    {
      index: 1,
      name: 'Dados Enviados',
      icon: 'iconamoon:profile-circle-duotone',
    },
    {
      index: 2,
      name: 'Autores',
      icon: 'mdi:account-group',
    },
    {
      index: 3,
      name: 'Documentação',
      icon: 'iconamoon:profile-duotone',
    },
  ]

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="mt-2">Carregando dados da submissão...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro</Alert.Heading>
        <p>{error}</p>
        <Button variant="outline-danger" onClick={loadArticle}>
          Tentar Novamente
        </Button>
      </Alert>
    )
  }

  return (
    <>
      <PageTitle title="Wizard de Submissão" subName="Processo de Submissão" />
      
      <Card>
        <CardHeader>
          <CardTitle as={'h5'} className="anchor" id="submission-wizard">
            Submissão #{article ? article.id : ''} - {article ? article.title : ''}
            <Link className="anchor-link" href="#submission-wizard">
              #
            </Link>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-5">
            <form>
              <div id="submissionwizard">
                {/* Navegação dos passos */}
                <div className="bg-light p-3 mb-4 rounded">
                  <div className="d-flex justify-content-between">
                    {wizardSteps.map((step) => (
                      <div 
                        key={step.index}
                        className={`text-center ${activeStep === step.index ? 'text-primary fw-bold' : 'text-muted'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => goToStep(step.index)}
                      >
                        <div className="mb-2">
                          <IconifyIcon icon={step.icon} className="fs-24" />
                        </div>
                        <div className="small">{step.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conteúdo do passo atual */}
                <div className="mb-4">
                  <Alert variant="info">
                    <strong>Passo {activeStep} de {wizardSteps.length}:</strong> {wizardSteps.find(s => s.index === activeStep) ? wizardSteps.find(s => s.index === activeStep).name : ''}
                  </Alert>
                  
                  {activeStep === 1 && <Step1Data article={article} />}
                  {activeStep === 2 && <Step2Authors />}
                  {activeStep === 3 && <Step3Documentation />}
                </div>

                {/* Navegação */}
                <div className="d-flex justify-content-between mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const prevStep = activeStep - 1
                      if (prevStep >= 1) {
                        goToStep(prevStep)
                      }
                    }}
                    disabled={activeStep === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div>
                    <Button
                      variant="outline-secondary"
                      onClick={() => router.push('/magazine/submission-list')}
                      className="me-2"
                    >
                      Voltar à Lista
                    </Button>
                    
                    {activeStep < 3 ? (
                      <Button
                        variant="primary"
                        onClick={() => {
                          const nextStep = activeStep + 1
                          if (nextStep <= 3) {
                            goToStep(nextStep)
                          }
                        }}
                      >
                        Próximo
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        onClick={handleFinish}
                      >
                        Finalizar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

export default SubmissionWizard 