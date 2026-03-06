import { NextRequest, NextResponse } from 'next/server'
import { init, getState, sendMessage, disconnect } from '@/lib/waManager'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await init()
  const state = getState()
  return NextResponse.json({ status: state.status, qr: state.qr, diagnostics: state })
}

export async function POST(req: NextRequest) {
  await init()
  try {
    const body = await req.json()
    const { action, to, message } = body
    if (action === 'disconnect') {
      await disconnect()
      const state = getState()
      return NextResponse.json({ ok: true, status: state.status })
    }

    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 })
    }
    const sent = await sendMessage(to, message)
    return NextResponse.json({ ok: true, id: sent.key?.id ?? null })
  } catch (err: any) {
    console.error('Error in /api/whatsapp', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

