import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const articleId = parseInt(formData.get('articleId')?.toString() || '0', 10)
  const authorsRaw = formData.get('authors')?.toString() || '[]'
  const pdfFile = formData.get('pdfFile') as File | null

  if (!articleId || !pdfFile) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const authors = JSON.parse(authorsRaw)

  const folder = path.join(process.cwd(), 'public/articles')
  await mkdir(folder, { recursive: true })

  const saveFile = async (file: File) => {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const filePath = path.join(folder, filename)
    await writeFile(filePath, new Uint8Array(buffer))
    return filename
  }

  const pdfFilename = await saveFile(pdfFile)

  // Cria autores
  await prisma.author.deleteMany({ where: { articleId } })
  await prisma.author.createMany({
    data: authors.map((a: any) => ({ ...a, articleId })),
  })

  // Atualiza artigo com nome do PDF
  await prisma.article.update({
    where: { id: articleId },
    data: { pdfAuthorizationFile: pdfFilename },
  })

  return NextResponse.json({ success: true })
} 