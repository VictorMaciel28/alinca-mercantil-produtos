import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// API para buscar submissões do usuário logado
export async function GET(req) {
  try {
    // Obtém o ID do usuário da query string
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário não fornecido' }, { status: 400 })
    }

    // Busca as submissões do usuário com os dados da revista
    const submissions = await prisma.submission.findMany({
      where: {
        userId: parseInt(userId),
      },
      include: {
        Magazine: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(submissions)
  } catch (error) {
    console.error('Erro ao buscar submissões do usuário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
} 