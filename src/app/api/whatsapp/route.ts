import { NextRequest, NextResponse } from 'next/server'

// Ensure this route runs in the Node.js runtime so module state (whatsapp client) is preserved
export const runtime = 'nodejs'

import fs from 'fs'
import path from 'path'

// Use require for libs that may not have full ESM types in this environment
// @ts-ignore
const qrcode = require('qrcode')
// @ts-ignore
const { Client, LocalAuth } = require('whatsapp-web.js')
import { prisma } from '@/lib/prisma'

let client: any = null
let currentQrDataUrl: string | null = null
let connectionStatus = 'DISCONNECTED'
const SESSION_ID = process.env.WA_SESSION_ID ?? 'alinca-whatsapp'

function initClient() {
  if (client) return

  client = new Client({
    authStrategy: new LocalAuth({ clientId: SESSION_ID }),
    puppeteer: { headless: true },
  })

  client.on('qr', async (qr: string) => {
    try {
      currentQrDataUrl = await qrcode.toDataURL(qr)
      connectionStatus = 'QR'
      console.log('WhatsApp QR generated')
      // persist session row or update
      try {
        await (prisma as any).whatsapp_session.upsert({
          where: { session_id: SESSION_ID },
          update: {
            status: connectionStatus,
            client_info: null,
            last_seen: new Date(),
          },
          create: {
            session_id: SESSION_ID,
            status: connectionStatus,
            last_seen: new Date(),
          },
        })
      } catch (e) {
        console.error('prisma upsert qr', e)
      }
    } catch (err) {
      console.error('Failed to create QR data URL', err)
    }
  })

  client.on('ready', () => {
    connectionStatus = 'CONNECTED'
    currentQrDataUrl = null
    console.log('WhatsApp client ready')
    // persist status
    try {
      ;(prisma as any).whatsapp_session
        .upsert({
          where: { session_id: SESSION_ID },
          update: {
            status: connectionStatus,
            client_info: client?.info ?? null,
            last_seen: new Date(),
          },
          create: {
            session_id: SESSION_ID,
            status: connectionStatus,
            client_info: client?.info ?? null,
            last_seen: new Date(),
          },
        })
        .catch((e) => console.error('prisma ready', e))
    } catch (e) {}
  })

  client.on('auth_failure', (msg: any) => {
    connectionStatus = 'AUTH_FAILURE'
    console.error('WhatsApp auth failure', msg)
    ;(prisma as any).whatsapp_session
      .upsert({
        where: { session_id: SESSION_ID },
        update: { status: connectionStatus, last_seen: new Date() },
        create: { session_id: SESSION_ID, status: connectionStatus, last_seen: new Date() },
      })
      .catch((e) => console.error('prisma auth_failure', e))
  })

  client.on('disconnected', () => {
    connectionStatus = 'DISCONNECTED'
    console.log('WhatsApp disconnected')
    // attempt re-init after short delay
    setTimeout(() => {
      try {
        client.destroy().catch?.(() => {})
      } catch {}
      client = null
      initClient()
    }, 2000)
    ;(prisma as any).whatsapp_session
      .upsert({
        where: { session_id: SESSION_ID },
        update: { status: connectionStatus, last_seen: new Date() },
        create: { session_id: SESSION_ID, status: connectionStatus, last_seen: new Date() },
      })
      .catch((e) => console.error('prisma disconnected', e))
  })

  client.initialize().catch((e: any) => {
    console.error('Failed to initialize WhatsApp client', e)
  })
}

export async function GET(req: NextRequest) {
  initClient()

  // diagnostic info to help debug environment/state
  const sessionDir = path.join(process.cwd(), '.wwebjs_auth', 'session-alinca-whatsapp')
  const sessionDirDynamic = path.join(process.cwd(), '.wwebjs_auth', `session-${SESSION_ID}`)
  let sessionExists = false
  let sessionFiles: string[] = []
  try {
    sessionExists = fs.existsSync(sessionDirDynamic)
    if (sessionExists) {
      sessionFiles = fs.readdirSync(sessionDirDynamic).slice(0, 50)
    }
  } catch (e) {
    // ignore
  }

  const diagnostics = {
    pid: process.pid,
    cwd: process.cwd(),
    sessionDir: sessionDirDynamic,
    sessionExists,
    sessionFiles,
    clientInitialized: !!client,
    clientInfo: client?.info ?? null,
  }

  return NextResponse.json({ status: connectionStatus, qr: currentQrDataUrl, diagnostics })
}

export async function POST(req: NextRequest) {
  initClient()
  try {
    const body = await req.json()
    const { action, to, message } = body
    if (action === 'disconnect') {
      try {
        if (client) {
          // attempt logout and destroy
          try {
            await client.logout()
          } catch (e) {
            // ignore
          }
          try {
            await client.destroy()
          } catch (e) {}
          client = null
          connectionStatus = 'DISCONNECTED'
        }
        // remove session folder to avoid "browser already running" lock
        const sessionDir = path.join(process.cwd(), '.wwebjs_auth', `session-${SESSION_ID}`)
        try {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
          }
        } catch (e) {
          console.error('failed remove session dir', e)
        }
        await (prisma as any).whatsapp_session.upsert({
          where: { session_id: SESSION_ID },
          update: { status: connectionStatus, last_seen: new Date() },
          create: { session_id: SESSION_ID, status: connectionStatus, last_seen: new Date() },
        })
        return NextResponse.json({ ok: true, status: connectionStatus })
      } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 })
      }
    }

    // default action: send message
    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 })
    }
    if (!client || connectionStatus !== 'CONNECTED') {
      return NextResponse.json({ error: 'WhatsApp client not connected' }, { status: 500 })
    }
    const numberId = `${to}@c.us`
    const sent = await client.sendMessage(numberId, message)
    return NextResponse.json({ ok: true, id: sent.id._serialized ?? sent.id })
  } catch (err: any) {
    console.error('Error in /api/whatsapp', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

