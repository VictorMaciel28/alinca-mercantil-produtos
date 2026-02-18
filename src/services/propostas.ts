import type { Pedido } from './pedidos'

export async function getPropostas(): Promise<Pedido[]> {
  try {
    const res = await fetch('/api/propostas')
    const json = await res.json()
    if (!res.ok || !json?.ok) return []
    return json.data as Pedido[]
  } catch {
    // se a API não existir ainda, retornar lista vazia para não quebrar a UI
    return []
  }
}
