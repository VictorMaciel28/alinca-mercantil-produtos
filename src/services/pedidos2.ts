export type PedidoStatus = 'Pendente' | 'Pago' | 'Cancelado' | 'Faturado' | 'Em aberto' | 'Entregue' | 'Proposta'

export interface Pedido {
  numero: number
  data: string // ISO date: YYYY-MM-DD
  cliente: string
  cnpj: string
  total: number
  status: PedidoStatus
}

export async function getPedidos(): Promise<Pedido[]> {
  const res = await fetch('/api/pedidos')
  const json = await res.json()
  if (!res.ok || !json?.ok) return []
  return json.data as Pedido[]
}

export function getNextPedidoNumero(): number {
  return 1001
}

export async function getPedidoByNumero(numero: number): Promise<Pedido | undefined> {
  if (!numero) return undefined
  const res = await fetch(`/api/pedidos/${numero}`)
  const json = await res.json()
  if (!res.ok || !json?.ok) return undefined
  return json.data as Pedido
}

export async function savePedido(input: Partial<Pedido> & {
  numero?: number
  id_vendedor_externo?: string | null
  client_vendor_externo?: string | null
}): Promise<any> {
  const res = await fetch('/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao salvar pedido')
  // If backend returned a platform 'numero', fetch and return the saved order as before.
  if (json?.numero) {
    const numero = Number(json.numero)
    const savedRes = await fetch(`/api/pedidos/${numero}`)
    const savedJson = await savedRes.json()
    if (!savedRes.ok || !savedJson?.ok) throw new Error('Falha ao carregar pedido salvo')
    return savedJson.data as Pedido
  }

  // Otherwise return the raw response (e.g. Tiny API response) so the caller can inspect it.
  return json
}

