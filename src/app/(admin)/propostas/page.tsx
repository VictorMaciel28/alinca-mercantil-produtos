"use client";

import PageTitle from '@/components/PageTitle'
import { Card } from 'react-bootstrap'

export default function PropostasComerciaisPage() {
  return (
    <>
      <PageTitle title="Propostas Comerciais" subName="Em breve" />
      <Card className="border-0 shadow-sm">
        <Card.Body>
          Esta seção exibirá propostas comerciais. Conteúdo placeholder por enquanto.
        </Card.Body>
      </Card>
    </>
  );
}


