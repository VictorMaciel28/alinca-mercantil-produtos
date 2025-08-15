'use client'
import { useLanguage } from '@/contexts/LanguageContext'
import { Row, Col } from 'react-bootstrap'
import UIExamplesList from '@/components/UIExamplesList'
// importe os componentes de tabela que você já usa (ou copie diretamente aqui)
import PageTitle from '@/components/PageTitle'

export default function BasicTablesClient() {
  const { t } = useLanguage()

  return (
    <>
      <PageTitle title={t('basic_example')} subName="Table" />
      <Row>
        <Col xl={9}>
          {/* Exemplo mínimo para começar. Você pode inserir aqui os componentes como BasicExample, TableVariants etc. */}
          <h2>{t('basic_example')}</h2>
        </Col>
        <Col xl={3}>
          <UIExamplesList
            examples={[
              { link: '#basic', label: t('basic_example') },
              { link: '#variant', label: 'Variant Table' }
              // use t('...') conforme criar mais traduções no JSON
            ]}
          />
        </Col>
      </Row>
    </>
  )
}