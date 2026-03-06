import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'

type State = {
  status: string
  qr: string | null
  clientInfo: any | null
  authDir: string
}

const emitter = new EventEmitter()
let sock: any = null
let currentQrDataUrl: string | null = null
let connectionStatus = 'DISCONNECTED'
let currentQrTimestamp: number | null = null
const SESSION_ID = process.env.WA_SESSION_ID ?? 'alinca-whatsapp'
const authDir = path.join(process.cwd(), `.baileys_auth_${SESSION_ID}`)

// dynamic require to avoid bundler issues
let makeWASocket: any = null
let useMultiFileAuthState: any = null
let fetchLatestBaileysVersion: any = null
try {
  // @ts-ignore
  const baileys = require('@adiwajshing/baileys')
  makeWASocket = baileys.makeWASocket ?? baileys.default?.makeWASocket ?? baileys.default
  useMultiFileAuthState = baileys.useMultiFileAuthState ?? baileys.default?.useMultiFileAuthState
  fetchLatestBaileysVersion =
    baileys.fetchLatestBaileysVersion ?? baileys.default?.fetchLatestBaileysVersion
} catch (e) {
  // fail quietly if baileys not available
}

async function init() {
  if (sock) return
  if (!makeWASocket || !useMultiFileAuthState) {
    connectionStatus = 'UNAVAILABLE'
    emitStatusIfChanged()
    return
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2203, 7] }))

    const noopLogger = {
      level: 'silent',
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      child: () => noopLogger,
    }

    const sockOpts: any = {
      auth: state,
      version,
      printQRInTerminal: false,
      logger: noopLogger,
    }
    sock = makeWASocket(sockOpts)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) {
        try {
          // generate QR data URL
          // require qrcode at runtime
          // @ts-ignore
          const qrcode = require('qrcode')
          currentQrDataUrl = await qrcode.toDataURL(qr)
          currentQrTimestamp = Date.now()
          connectionStatus = 'QR'
          emitter.emit('qr', currentQrDataUrl)
          emitStatusIfChanged()
        } catch (e) {
          console.error('waManager: failed to create QR', e)
        }
      }
      if (connection === 'open') {
        connectionStatus = 'CONNECTED'
        currentQrDataUrl = null
        emitStatusIfChanged()
      }
      if (connection === 'close') {
        connectionStatus = 'DISCONNECTED'
        emitStatusIfChanged()
        setTimeout(() => {
          try {
            sock = null
            init().catch(() => {})
          } catch {}
        }, 2000)
      }
    })
  } catch (e) {
    // initialization error - set status but do not spam logs
    connectionStatus = 'ERROR'
    emitStatusIfChanged()
  }
}

function getState(): State {
  const sessionExists = fs.existsSync(authDir)
  return {
    status: connectionStatus,
    qr: currentQrDataUrl,
    clientInfo: sock?.user ?? null,
    authDir,
  }
}

async function sendMessage(to: string, message: string) {
  if (!sock || connectionStatus !== 'CONNECTED') throw new Error('not_connected')
  const jid = `${to}@s.whatsapp.net`
  return await sock.sendMessage(jid, { text: message })
}

async function disconnect() {
  try {
    if (sock) {
      try {
        await sock.logout()
      } catch {}
      try {
        sock.ws?.close()
      } catch {}
      sock = null
      connectionStatus = 'DISCONNECTED'
    }
  } catch (e) {
    // ignore disconnect errors
  }
  try {
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true })
  } catch (e) {
    // ignore
  }
  emitStatusIfChanged()
}

let _lastEmittedStateJSON: string | null = null
function emitStatusIfChanged() {
  const s = getState()
  const j = JSON.stringify(s)
  if (j === _lastEmittedStateJSON) return
  _lastEmittedStateJSON = j
  emitter.emit('status', s)
}

export { init, getState, sendMessage, disconnect, emitter }

