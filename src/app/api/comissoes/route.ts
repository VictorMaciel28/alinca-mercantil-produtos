import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const roleParam = (searchParams.get('role') || '').toString().trim().toUpperCase()
    const vendorExterno = (searchParams.get('vendor_externo') || '').toString().trim()
    const vendorNome = (searchParams.get('vendor_nome') || '').toString().trim()
    const startStr = (searchParams.get('start') || '').toString().slice(0, 10)
    const endStr = (searchParams.get('end') || '').toString().slice(0, 10)

    // Build where
    const where: any = {}
    if (roleParam === 'VENDEDOR' || roleParam === 'TELEVENDAS') {
      where.role = roleParam
    }

    // Filter by vendor beneficiary
    if (vendorExterno) {
      where.beneficiary_externo = vendorExterno
    } else if (vendorNome) {
      const vends = await prisma.vendedor.findMany({
        where: { nome: { contains: vendorNome } },
        select: { id_vendedor_externo: true },
        take: 200,
      })
      const externos = vends.map((v) => v.id_vendedor_externo).filter((x): x is string => !!x)
      if (externos.length > 0) {
        where.beneficiary_externo = { in: externos }
      } else {
        where.beneficiary_externo = '__none__' // no results
      }
    }

    // Date range
    if (startStr || endStr) {
      where.created_at = {}
      if (startStr) where.created_at.gte = new Date(startStr + 'T00:00:00.000Z')
      if (endStr) where.created_at.lte = new Date(endStr + 'T23:59:59.999Z')
    }

    const rows = await prisma.platform_commission.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { order: true },
      take: 1000,
    })

    // Map vendedor do pedido (by order.id_vendedor_externo) to nome
    const orderVendorExternals = Array.from(
      new Set(
        rows
          .map((r) => r.order?.id_vendedor_externo)
          .filter((x): x is string => !!x)
      )
    )
    const orderVendors =
      orderVendorExternals.length > 0
        ? await prisma.vendedor.findMany({
            where: { id_vendedor_externo: { in: orderVendorExternals } },
            select: { id_vendedor_externo: true, nome: true },
          })
        : []
    const orderVendNameByExt = new Map(orderVendors.map((v) => [v.id_vendedor_externo!, v.nome]))

    // Map vendedor pertencente preferindo order.client_vendor_externo
    const clientVendorExternals = Array.from(
      new Set(
        rows
          .map((r) => r.order?.client_vendor_externo)
          .filter((x): x is string => !!x)
      )
    )
    const clientVendors =
      clientVendorExternals.length > 0
        ? await prisma.vendedor.findMany({
            where: { id_vendedor_externo: { in: clientVendorExternals } },
            select: { id_vendedor_externo: true, nome: true },
          })
        : []
    const clientVendNameByExt = new Map(clientVendors.map((v) => [v.id_vendedor_externo!, v.nome]))

    const data = rows.map((r) => {
      const o = r.order
      const orderVendorExterno = o?.id_vendedor_externo || null
      const orderVendorNome = orderVendorExterno ? orderVendNameByExt.get(orderVendorExterno) || null : null
      const clientExterno = o?.client_vendor_externo || null
      const clientVend = clientExterno ? { externo: clientExterno, nome: clientVendNameByExt.get(clientExterno) || null } : null

      return {
        id: r.id,
        role: r.role,
        percent: Number(r.percent),
        amount: Number(r.amount),
        created_at: r.created_at.toISOString(),
        order_num: r.order_num,
        order: o
          ? {
              numero: o.numero,
              data: o.data.toISOString().slice(0, 10),
              cliente: o.cliente,
              cnpj: o.cnpj,
              total: Number(o.total),
              status: o.status,
            }
          : null,
        order_vendor: orderVendorExterno
          ? { externo: orderVendorExterno, nome: orderVendorNome }
          : null,
        client_vendor: clientVend,
      }
    })

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar comissões' }, { status: 500 })
  }
}


