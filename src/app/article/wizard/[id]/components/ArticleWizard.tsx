"use client"
import { useState } from "react"
import { Card, CardBody, CardHeader, CardTitle, Col, Row, Tabs, Tab } from "react-bootstrap"
import ArticleAuthorsStep from "./ArticleAuthorsStep"

const wizardSteps = [
  {
    index: 1,
    name: "Autores",
    icon: "mdi:account-group",
    tab: (articleId: string) => <ArticleAuthorsStep articleId={articleId} />,
  },
  // Adicione outros passos aqui
]

export default function ArticleWizard({ articleId }: { articleId: string }) {
  const [activeStep, setActiveStep] = useState<number>(1)

  return (
    <Row>
      <Col xs={12}>
        <Card>
          <CardHeader>
            <CardTitle as="h5">Wizard do Artigo</CardTitle>
          </CardHeader>
          <CardBody>
            <Tabs
              onSelect={(e: any) => setActiveStep(Number(e))}
              activeKey={activeStep}
              variant="pills"
              justify
              className="icon-wizard form-wizard-header bg-light p-1"
            >
              {wizardSteps.map((step) => (
                <Tab
                  key={step.index}
                  as={"span"}
                  className="rounded-0 py-2"
                  eventKey={step.index}
                  title={<>{step.name}</>}
                >
                  {step.tab(articleId)}
                </Tab>
              ))}
            </Tabs>
          </CardBody>
        </Card>
      </Col>
    </Row>
  )
} 