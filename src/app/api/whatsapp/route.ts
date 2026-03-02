import { NextRequest, NextResponse } from 'next/server'

// Ensure this route runs in the Node.js runtime so module state (whatsapp client) is preserved
export const runtime = 'nodejs'

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

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
let currentQrTimestamp: number | null = null

function initClient() {
  if (client) return

  client = new Client({
    authStrategy: new LocalAuth({ clientId: SESSION_ID }),
    puppeteer: { headless: true },
  })

  client.on('qr', async (qr: string) => {
    try {
      currentQrDataUrl = await qrcode.toDataURL(qr)
      currentQrTimestamp = Date.now()
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
    supported:
      !(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.cwd() === '/var/task'),
    currentQrAgeSeconds: currentQrTimestamp ? Math.floor((Date.now() - currentQrTimestamp) / 1000) : null,
  }
  // only serve QR if recent (avoid stale data across processes)
  const qrToReturn =
    currentQrDataUrl && currentQrTimestamp && Date.now() - currentQrTimestamp < 1000 * 60 * 5
      ? currentQrDataUrl
      : null

  return NextResponse.json({ status: connectionStatus, qr: qrToReturn, diagnostics })
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
      // attempt to kill Chrome/Chromium processes to fully clear locks
      let killResults: string[] = []
      try {
        const platform = process.platform
        if (platform === 'win32') {
          try {
            execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' })
            killResults.push('taskkill chrome.exe ok')
          } catch (e) {
            killResults.push('taskkill chrome.exe failed')
          }
          try {
            execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' })
            killResults.push('taskkill msedge.exe ok')
          } catch (e) {
            killResults.push('taskkill msedge.exe failed')
          }
        } else {
          try {
            execSync('pkill -f Chrome || true', { stdio: 'ignore' })
            killResults.push('pkill -f Chrome ok')
          } catch (e) {
            killResults.push('pkill -f Chrome failed')
          }
          try {
            execSync('pkill -f chromium || true', { stdio: 'ignore' })
            killResults.push('pkill -f chromium ok')
          } catch (e) {
            killResults.push('pkill -f chromium failed')
          }
          try {
            execSync('pkill -f chrome || true', { stdio: 'ignore' })
            killResults.push('pkill -f chrome ok')
          } catch (e) {
            killResults.push('pkill -f chrome failed')
          }
        }
      } catch (e) {
        console.error('error killing browser processes', e)
      }
        await (prisma as any).whatsapp_session.upsert({
          where: { session_id: SESSION_ID },
          update: { status: connectionStatus, last_seen: new Date() },
          create: { session_id: SESSION_ID, status: connectionStatus, last_seen: new Date() },
        })
        return NextResponse.json({ ok: true, status: connectionStatus, killed: killResults })
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

