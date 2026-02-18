export type PedidoStatus = 'Pendente' | 'Pago' | 'Cancelado' | 'Faturado' | 'Em aberto' | 'Entregue' | 'Proposta'

export interface Pedido {
  numero: number
  data: string // ISO date: YYYY-MM-DD
  cliente: string
  cnpj: string
  total: number
  status: PedidoStatus
}

// Lista de exemplo comentada: agora os dados vêm da API
// let MOCK_PEDIDOS: Pedido[] = [
//   { numero: 1001, data: '2025-09-01', cliente: 'Empresa Alpha Ltda.', cnpj: '12.345.678/0001-90', total: 1234.56, status: 'Em aberto' },
//   { numero: 1002, data: '2025-09-05', cliente: 'Comercial Beta S.A.', cnpj: '98.765.432/0001-10', total: 9876.0, status: 'Faturado' },
//   { numero: 1003, data: '2025-09-10', cliente: 'Gamma Indústria ME', cnpj: '11.222.333/0001-44', total: 450.0, status: 'Entregue' },
// ]

export async function getPedidos(): Promise<Pedido[]> {
  const res = await fetch('/api/pedidos')
  const json = await res.json()
  if (!res.ok || !json?.ok) return []
  return json.data as Pedido[]
}

export function getNextPedidoNumero(): number {
  // Mantém cálculo local apenas para exibição antes do salvamento
  // O número oficial é definido no servidor ao salvar
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
}): Promise<Pedido> {
  const res = await fetch('/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao salvar pedido')

  const numero = Number(json.numero)
  const saved = await getPedidoByNumero(numero)
  if (!saved) throw new Error('Falha ao carregar pedido salvo')
  return saved
}


