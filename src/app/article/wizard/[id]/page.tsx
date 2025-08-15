"use client"
import ArticleWizard from "./components/ArticleWizard"
 
export default function ArticleWizardPage({ params }: { params: { id: string } }) {
  return <ArticleWizard articleId={params.id} />
} 