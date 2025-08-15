import { NextRequest, NextResponse } from 'next/server'

// API Route para gerar imagens placeholder
// Esta rota cria uma imagem SVG placeholder com as dimensões especificadas
export async function GET(
  request: NextRequest,
  { params }: { params: { width: string; height: string } }
) {
  const width = parseInt(params.width) || 800
  const height = parseInt(params.height) || 400
  
  // Cria um SVG placeholder com gradiente e texto
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" font-weight="bold">
        Aliança Mercantil
      </text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle">
        Sistema de Revistas Científicas
      </text>
      <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.8)" text-anchor="middle">
        ${width} x ${height}
      </text>
    </svg>
  `

  // Retorna o SVG como resposta
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}