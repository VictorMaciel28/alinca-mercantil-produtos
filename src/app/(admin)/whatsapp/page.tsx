 "use client";

import { useCallback, useEffect, useState } from 'react'
import { Button, Spinner } from 'react-bootstrap'

export default function WhatsAppPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('DISCONNECTED')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchQr() {
      try {
        const res = await fetch('/api/whatsapp')
        const json = await res.json()
        if (!mounted) return
        setStatus(json.status)
        setQrDataUrl(json.qr)
        setError(null)
      } catch (err) {
        console.error(err)
        if (!mounted) return
        setError(String(err))
      }
    }

    fetchQr()
    const id = setInterval(fetchQr, 2000)
    if (typeof window !== 'undefined') (window as any).__waPollRef = id
    return () => {
      mounted = false
      clearInterval(id)
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
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      const json = await res.json()
      if (json?.ok) {
        setStatus('DISCONNECTED')
        setQrDataUrl(null)
        alert('Desconectado.')
      } else {
        alert('Falha ao desconectar: ' + JSON.stringify(json))
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao desconectar.')
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
        <Button variant="danger" onClick={handleDisconnect} disabled={status === 'DISCONNECTED'}>
          Desconectar
        </Button>
      </div>
    </div>
  )
}

