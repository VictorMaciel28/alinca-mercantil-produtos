import { prisma } from '@/lib/prisma'

function onlyDigits(v: string | null | undefined) {
  return (v || '').replace(/\D/g, '')
}

async function resolveRole(idVendedorExterno: string): Promise<'VENDEDOR' | 'TELEVENDAS'> {
  const tipo = await prisma.vendedor_tipo_acesso.findUnique({
    where: { id_vendedor_externo: idVendedorExterno },
    select: { tipo: true },
  })
  return tipo?.tipo === 'TELEVENDAS' ? 'TELEVENDAS' : 'VENDEDOR'
}

export async function recomputeCommissionsForOrder(orderNumero: number) {
  const order = await prisma.platform_order.findUnique({
    where: { numero: orderNumero },
    include: { cliente_rel: true },
  })
  if (!order) return { ok: false, reason: 'order_not_found' as const }

  const total = Number(order.total || 0)
  if (!(total > 0)) return { ok: false, reason: 'order_total_invalid' as const, order_num: orderNumero }

  const pedidoVendor = (order.id_vendedor_externo || '').trim()
  if (!pedidoVendor) return { ok: false, reason: 'order_vendor_missing' as const, order_num: orderNumero }

  let carteiraVendor =
    (order.cliente_rel?.id_vendedor_externo || '').trim() ||
    (order.client_vendor_externo || '').trim() ||
    ''

  if (!carteiraVendor && order.id_client_externo != null) {
    const cli = await prisma.cliente.findUnique({
      where: { external_id: order.id_client_externo },
      select: { id_vendedor_externo: true },
    })
    carteiraVendor = (cli?.id_vendedor_externo || '').trim()
  }

  if (!carteiraVendor) {
    const cnpjDigits = onlyDigits(order.cnpj)
    if (cnpjDigits) {
      const cliByCpf = await prisma.cliente.findFirst({
        where: { cpf_cnpj: { contains: cnpjDigits } },
        select: { id_vendedor_externo: true },
      })
      carteiraVendor = (cliByCpf?.id_vendedor_externo || '').trim()
    }
  }

  await prisma.platform_commission.deleteMany({ where: { order_num: order.numero } })

  const entries: { beneficiary_externo: string; role: 'VENDEDOR' | 'TELEVENDAS'; percent: number; amount: number }[] = []
  const pedidoVendorRole = await resolveRole(pedidoVendor)

  if (!carteiraVendor || carteiraVendor === pedidoVendor) {
    entries.push({
      beneficiary_externo: pedidoVendor,
      role: pedidoVendorRole,
      percent: 5,
      amount: (total * 5) / 100,
    })
  } else {
    const carteiraVendorRole = await resolveRole(carteiraVendor)
    entries.push({
      beneficiary_externo: pedidoVendor,
      role: 'TELEVENDAS',
      percent: 1,
      amount: (total * 1) / 100,
    })
    entries.push({
      beneficiary_externo: carteiraVendor,
      role: carteiraVendorRole,
      percent: 4,
      amount: (total * 4) / 100,
    })
  }

  await prisma.platform_commission.createMany({
    data: entries.map((e) => ({
      order_num: order.numero,
      beneficiary_externo: e.beneficiary_externo,
      role: e.role as any,
      percent: e.percent,
      amount: Number((Math.round(e.amount * 100) / 100).toFixed(2)),
    })),
  })

  return {
    ok: true as const,
    order_num: order.numero,
    total,
    entries: entries.length,
  }
}

