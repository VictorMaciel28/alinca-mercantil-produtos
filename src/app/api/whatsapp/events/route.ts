import { NextResponse } from 'next/server'
import { init, getState, emitter } from '@/lib/waManager'

export const runtime = 'nodejs'

export async function GET() {
  await init()

  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      function safeEnqueue(chunk: Uint8Array) {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch (e) {
          // controller may be closed concurrently; mark closed to stop future enqueues
          closed = true
        }
      }

      function sendEvent(event: string, data: any) {
        const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`
        safeEnqueue(new TextEncoder().encode(payload))
      }

      // send initial state
      sendEvent('state', getState())

      const onQr = (qr: any) => {
        if (closed) return
        sendEvent('qr', { qr })
      }
      const onStatus = (s: any) => {
        if (closed) return
        sendEvent('state', s)
      }

      emitter.on('qr', onQr)
      emitter.on('status', onStatus)

      const pingInterval = setInterval(() => {
        if (closed) return clearInterval(pingInterval)
        safeEnqueue(new TextEncoder().encode(':\n\n'))
      }, 30000)

      // Note: use the ReadableStream cancel callback instead of controller.oncancel
      // cleanup will be handled in the cancel() method below
      // fallback: attach oncancel to controller (cast to any to satisfy TS)
      ;(controller as any).oncancel = () => {
        closed = true
        clearInterval(pingInterval)
        emitter.off('qr', onQr)
        emitter.off('status', onStatus)
      }
    },
  })

  return new NextResponse(stream, { headers })
}

