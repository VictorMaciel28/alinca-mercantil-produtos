 "use client";

import { useCallback, useEffect, useState } from 'react'
import { Button, Spinner } from 'react-bootstrap'

export default function WhatsAppPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('DISCONNECTED')
  const [error, setError] = useState<string | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [disconnectResult, setDisconnectResult] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    let es: EventSource | null = null
    async function startEvents() {
      try {
        es = new EventSource('/api/whatsapp/events')
        es.addEventListener('state', (e: MessageEvent) => {
          if (!mounted) return
          try {
            const data = JSON.parse(e.data)
            setStatus(data.status)
            setQrDataUrl(data.qr ?? null)
            setError(null)
            if (data.status === 'UNSUPPORTED') {
              setError('Ambiente não suportado para executar o client WhatsApp aqui. Use um servidor dedicado.')
            }
          } catch (err) {
            console.error('parse state', err)
          }
        })
        es.addEventListener('qr', (e: MessageEvent) => {
          if (!mounted) return
          try {
            const data = JSON.parse(e.data)
            setQrDataUrl(data.qr ?? null)
            setError(null)
          } catch (err) {
            console.error('parse qr', err)
          }
        })
        es.onerror = (ev) => {
          console.error('EventSource error', ev)
          setError('Erro de conexão de eventos. Tentando reconectar...')
        }
      } catch (err) {
        console.error(err)
        setError(String(err))
      }
    }

    startEvents()
    return () => {
      mounted = false
      if (es) es.close()
    }
  }, [])

  const handleTest = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '5524999946480',
          message: 'Teste de conexão do sistema',
        }),
      })
      const json = await res.json()
      if (json?.ok) {
        alert('Mensagem de teste enviada (se o sistema estiver conectado).')
      } else {
        alert('Falha ao enviar teste: ' + JSON.stringify(json))
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar teste. Verifique o servidor WhatsApp.')
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true)
    setDisconnectResult(null)
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      const json = await res.json().catch(() => null)
      setDisconnectResult(json)
      if (json?.ok) {
        setStatus('DISCONNECTED')
        setQrDataUrl(null)
        // show detailed result if there is killed info
        if (json.killed) {
          alert('Desconectado. Resultado: ' + JSON.stringify(json.killed))
        } else {
          alert('Desconectado.')
        }
      } else {
        alert('Falha ao desconectar: ' + JSON.stringify(json))
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao desconectar.')
    } finally {
      setIsDisconnecting(false)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <h3>Conectar WhatsApp</h3>
      <div style={{ margin: 20 }}>
        {status === 'CONNECTED' ? (
          <div>Dispositivo conectado ✅</div>
        ) : qrDataUrl ? (
          <img src={qrDataUrl} alt="QR para conectar WhatsApp" style={{ maxWidth: 320 }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Spinner animation="border" size="sm" /> Aguardando QR...
          </div>
        )}
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="success" onClick={handleTest} disabled={status !== 'CONNECTED'}>
          Testar
        </Button>
        <Button variant="danger" onClick={handleDisconnect} disabled={isDisconnecting}>
          {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
        </Button>
      </div>
      {disconnectResult && (
        <pre style={{ marginTop: 8, maxWidth: 500, overflow: 'auto' }}>
          {JSON.stringify(disconnectResult, null, 2)}
        </pre>
      )}
    </div>
  )
}

