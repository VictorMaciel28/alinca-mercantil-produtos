import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// API para gerenciar submissões de artigos
// Conecta com o banco de dados real

export async function GET() {
  try {
    console.log('Buscando todas as submissões...')
    const submissions = await prisma.submission.findMany({
      include: {
        Magazine: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    console.log('Submissões encontradas:', submissions.length)
    console.log('Primeira submissão:', submissions[0])

    return NextResponse.json(submissions)
  } catch (error) {
    console.error('Erro ao buscar submissões:', error)
    return NextResponse.json({ error: 'Erro ao buscar submissões' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData()

    // Obtém os dados do formulário
    const articleType = formData.get('articleType')
    const title = formData.get('title')
    const abstract = formData.get('abstract')
    const keywords = formData.get('keywords')
    const magazineId = parseInt(formData.get('magazineId') || '0')
    const userId = parseInt(formData.get('userId') || '1')

    console.log('Dados recebidos:', { articleType, title, abstract, keywords, magazineId, userId })
    console.log('FormData entries:')
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value)
    }

    const wordFile = formData.get('wordFile')
    const committeeLetterFile = formData.get('committeeLetterFile')
    const graphicalAbstractFile = formData.get('graphicalAbstractFile')

    // Valida se todos os dados obrigatórios foram enviados
    if (!articleType || !title || !abstract || !keywords || !magazineId || !userId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const folder = path.join(process.cwd(), 'public/uploads/submissions')
    await mkdir(folder, { recursive: true })

    async function saveFile(file) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const filePath = path.join(folder, filename)
      await writeFile(filePath, new Uint8Array(buffer))
      return filename
    }

    // Salva os arquivos se existirem
    let wordFilename = ''
    let letterFilename = ''
    let abstractFilename = ''

    if (wordFile) {
      wordFilename = await saveFile(wordFile)
    }
    if (committeeLetterFile) {
      letterFilename = await saveFile(committeeLetterFile)
    }
    if (graphicalAbstractFile) {
      abstractFilename = await saveFile(graphicalAbstractFile)
    }

    // Cria a submissão no banco de dados com o ID do usuário
    const submission = await prisma.submission.create({
      data: {
        articleType,
        title,
        abstract,
        keywords,
        magazineId,
        userId, // Salva o ID do usuário que fez a submissão
        wordFile: wordFilename,
        committeeLetterFile: letterFilename,
        graphicalAbstractFile: abstractFilename,
      },
    })

    console.log('Submissão criada:', submission)

    return NextResponse.json(submission)
  } catch (error) {
    console.error('Erro ao criar submissão:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}