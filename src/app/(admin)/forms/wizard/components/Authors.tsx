import { useState } from 'react';
import { Row, Col, Button, Form, FormLabel, FormControl, Table } from 'react-bootstrap';
import DropzoneFormInput from '@/components/from/DropzoneFormInput';
import IconifyIcon from '@/components/wrappers/IconifyIcon';

interface Author {
  nome: string;
  email: string;
  instagram?: string;
}

const Authors = () => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [current, setCurrent] = useState<Author>({ nome: '', email: '', instagram: '' });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [emailError, setEmailError] = useState<string>('');

  const handleAddOrEdit = () => {
    if (!current.nome || !current.email) return;
    if (!current.email.includes('@')) {
      setEmailError('O email deve conter o caractere "@".');
      return;
    } else {
      setEmailError('');
    }
    if (editIndex !== null) {
      const updated = [...authors];
      updated[editIndex] = current;
      setAuthors(updated);
      setEditIndex(null);
    } else {
      setAuthors([...authors, current]);
    }
    setCurrent({ nome: '', email: '', instagram: '' });
  };

  const handleEdit = (idx: number) => {
    setCurrent(authors[idx]);
    setEditIndex(idx);
  };

  const handleRemove = (idx: number) => {
    setAuthors(authors.filter((_, i) => i !== idx));
    if (editIndex === idx) setEditIndex(null);
  };

  return (
    <>
      <div className="d-flex align-items-center mb-2">
        <IconifyIcon icon="mdi:account-group" className="fs-26 me-2" />
        <h4 className="fs-16 fw-semibold mb-1 mb-0">Autores</h4>
      </div>
      <p className="text-muted">Adicione os autores do trabalho e faça upload do PDF de autorização.</p>
      <div className="mb-3">
        <Row>
          <Col md={4}>
            <FormLabel>Nome *</FormLabel>
            <FormControl
              type="text"
              value={current.nome}
              onChange={e => setCurrent({ ...current, nome: e.target.value })}
              required
              placeholder="Nome do autor"
            />
          </Col>
          <Col md={4}>
            <FormLabel>Email *</FormLabel>
            <FormControl
              type="email"
              value={current.email}
              onChange={e => {
                setCurrent({ ...current, email: e.target.value });
                if (emailError && e.target.value.includes('@')) setEmailError('');
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
              value={current.instagram || ''}
              onChange={e => setCurrent({ ...current, instagram: e.target.value })}
              placeholder="@usuario"
            />
          </Col>
          <Col md={1} className="d-flex align-items-end">
            <Button type="button" variant="primary" onClick={handleAddOrEdit} disabled={!current.nome || !current.email || !!emailError}>
              {editIndex !== null ? 'Salvar' : 'Adicionar'}
            </Button>
          </Col>
        </Row>
      </div>
      {authors.length > 0 && (
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
      )}
      <Row className="mb-3">
        <Col md={6}>
          <DropzoneFormInput
            label="PDF de autorização dos autores"
            helpText="Envie o PDF de autorização assinado por todos os autores."
            iconProps={{ icon: 'bx:cloud-upload', height: 36, width: 36 }}
            text="Arraste ou clique para enviar o PDF"
            showPreview
            onFileUpload={files => setPdfFile(files[0] || null)}
          />
          {pdfFile && <div className="mt-2">Arquivo selecionado: {pdfFile.name}</div>}
        </Col>
      </Row>
    </>
  );
};

export default Authors; 