export type PedidoStatus = 'Pendente' | 'Pago' | 'Cancelado' | 'Faturado' | 'Em aberto' | 'Entregue'

export interface Pedido {
  numero: number
  data: string // ISO date: YYYY-MM-DD
  cliente: string
  cnpj: string
  total: number
  status: PedidoStatus
}

let MOCK_PEDIDOS: Pedido[] = [
  { numero: 1001, data: '2025-09-01', cliente: 'Empresa Alpha Ltda.', cnpj: '12.345.678/0001-90', total: 1234.56, status: 'Em aberto' },
  { numero: 1002, data: '2025-09-05', cliente: 'Comercial Beta S.A.', cnpj: '98.765.432/0001-10', total: 9876.0, status: 'Faturado' },
  { numero: 1003, data: '2025-09-10', cliente: 'Gamma Indústria ME', cnpj: '11.222.333/0001-44', total: 450.0, status: 'Entregue' },
]

export function getPedidos(): Pedido[] {
  return [...MOCK_PEDIDOS]
}

export function getNextPedidoNumero(): number {
  const max = MOCK_PEDIDOS.reduce((m, p) => Math.max(m, p.numero), 0)
  return (max || 1000) + 1
}

export function getPedidoByNumero(numero: number): Pedido | undefined {
  return MOCK_PEDIDOS.find((p) => p.numero === numero)
}

export function savePedido(input: Partial<Pedido> & { numero?: number }): Pedido {
  const isNew = !input.numero || input.numero === 0
  if (isNew) {
    const nextNumero = (MOCK_PEDIDOS.reduce((max, p) => Math.max(max, p.numero), 1000) || 1000) + 1
    const novo: Pedido = {
      numero: nextNumero,
      data: input.data || new Date().toISOString().slice(0, 10),
      cliente: input.cliente || 'Cliente Exemplo',
      cnpj: input.cnpj || '00.000.000/0000-00',
      total: input.total ?? 0,
      status: (input.status as PedidoStatus) || 'Pendente',
    }
    MOCK_PEDIDOS = [novo, ...MOCK_PEDIDOS]
    return novo
  } else {
    const idx = MOCK_PEDIDOS.findIndex((p) => p.numero === input.numero)
    if (idx >= 0) {
      const atualizado: Pedido = {
        ...MOCK_PEDIDOS[idx],
        data: input.data ?? MOCK_PEDIDOS[idx].data,
        cliente: input.cliente ?? MOCK_PEDIDOS[idx].cliente,
        cnpj: input.cnpj ?? MOCK_PEDIDOS[idx].cnpj,
        total: input.total ?? MOCK_PEDIDOS[idx].total,
        status: (input.status as PedidoStatus) ?? MOCK_PEDIDOS[idx].status,
      }
      MOCK_PEDIDOS[idx] = atualizado
      return atualizado
    }
    // se não existir, cria como novo com o número informado
    const novo: Pedido = {
      numero: input.numero,
      data: input.data || new Date().toISOString().slice(0, 10),
      cliente: input.cliente || 'Cliente Exemplo',
      cnpj: input.cnpj || '00.000.000/0000-00',
      total: input.total ?? 0,
      status: (input.status as PedidoStatus) || 'Pendente',
    }
    MOCK_PEDIDOS = [novo, ...MOCK_PEDIDOS]
    return novo
  }
}


