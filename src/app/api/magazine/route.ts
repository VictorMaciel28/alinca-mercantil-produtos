import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

// API para gerenciar revistas científicas
// Conecta com o banco de dados real

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const title = formData.get('title')?.toString()
  const description = formData.get('description')?.toString()
  const publishDate = formData.get('publishDate')?.toString()
  const status = formData.get('status')?.toString()
  const file = formData.get('cover') as File

  if (!title || !description || !publishDate || !status || !file) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `${Date.now()}-${file.name}`
  const uploadPath = path.join(process.cwd(), 'public/uploads/images/magazine', filename)

  await writeFile(uploadPath, new Uint8Array(buffer))

  const magazine = await prisma.magazine.create({
    data: {
      title,
      description,
      publishDate: new Date(publishDate),
      status,
      coverImage: filename,
    },
  })

  return NextResponse.json(magazine, { status: 201 })
}

export async function GET() {
  const magazines = await prisma.magazine.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      description: true,
      publishDate: true,
      status: true,
      coverImage: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(magazines)
}