import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// API para buscar uma submissão específica por ID
export async function GET(req, { params }) {
  try {
    const id = parseInt(params.id)
    console.log('Buscando submissão com ID:', id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Busca a submissão com os dados da revista
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        Magazine: {
          select: {
            title: true,
          },
        },
      },
    })

    console.log('Submissão encontrada:', submission)

    if (!submission) {
      console.log('Submissão não encontrada para ID:', id)
      return NextResponse.json({ error: 'Submissão não encontrada' }, { status: 404 })
    }

    return NextResponse.json(submission)
  } catch (error) {
    console.error('Erro ao buscar artigo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
} 