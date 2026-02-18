import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'

export async function GET() {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: true, data: [] })

    const userEmail = session.user.email || null
    // Resolve vendedor for this session user (prefer lookup by email). Fallback: numeric session.user.id if it looks like a vendedor id.
    let vendedorId: number | null = null
    let id_vendedor_externo: string | null = null
    let isAdmin = false
    let vendRecord = null
    if (userEmail) {
      vendRecord = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vendRecord?.id ?? null
      id_vendedor_externo = vendRecord?.id_vendedor_externo ?? null
      if (vendRecord?.id_vendedor_externo) {
        const nivel = await prisma.vendedor_nivel_acesso.findUnique({ where: { id_vendedor_externo: vendRecord.id_vendedor_externo } }).catch(() => null)
        if (nivel?.nivel === 'ADMINISTRADOR') isAdmin = true
      }
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }

    // If admin, return all orders
    let rows
    if (isAdmin) {
      rows = await prisma.platform_order.findMany({ where: { NOT: { status: 'PROPOSTA' as any } }, orderBy: { created_at: 'desc' } })
    } else {
      // If we couldn't resolve a vendedor id, return empty result (no access)
      if (!vendedorId) return NextResponse.json({ ok: true, data: [] })

      rows = await prisma.platform_order.findMany({
        where: {
          NOT: { status: 'PROPOSTA' as any },
          ...(id_vendedor_externo
            ? {
                OR: [{ vendedor_id: vendedorId }, { id_vendedor_externo }],
              }
            : { vendedor_id: vendedorId }),
        },
        orderBy: { created_at: 'desc' },
      })
    }

    const data = rows.map((r) => ({
      numero: r.numero,
      data: r.data.toISOString().slice(0, 10),
      cliente: r.cliente,
      cnpj: r.cnpj,
      total: Number(r.total),
      status:
      r.status === 'PROPOSTA'
        ? 'Proposta'
        : r.status === 'PENDENTE'
        ? 'Pendente'
        : r.status === 'PAGO'
        ? 'Pago'
        : r.status === 'CANCELADO'
        ? 'Cancelado'
        : r.status === 'FATURADO'
        ? 'Faturado'
        : r.status === 'EM_ABERTO'
        ? 'Em aberto'
        : 'Entregue',
      id_vendedor_externo: r.id_vendedor_externo,
    }))

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao listar pedidos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(options as any)) as any
    if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const userEmail = session.user.email || null
    // Resolve vendedor.id for this session user (prefer vendor email lookup). Fallback: numeric session.user.id if it seems to be a vendedor id.
    let vendedorId: number | null = null
    if (userEmail) {
      const vend = await prisma.vendedor.findFirst({ where: { email: userEmail } })
      vendedorId = vend?.id ?? null
    }
    if (!vendedorId && session.user?.id) {
      const maybe = Number(session.user.id)
      vendedorId = Number.isNaN(maybe) ? null : maybe
    }

    const body = await req.json()
    const numeroInput = Number(body?.numero || 0)
    const dataStr = (body?.data || '').toString().slice(0, 10)
    const cliente = (body?.cliente || '').toString().trim()
    const cnpj = (body?.cnpj || '').toString().trim()
    const total = Number(body?.total || 0)
    const statusStr = (body?.status || 'Pendente').toString()
    const id_vendedor_externo =
      body?.id_vendedor_externo != null ? body.id_vendedor_externo?.toString?.().trim?.() || null : null
    const client_vendor_externo: string | null =
      body?.client_vendor_externo != null ? body.client_vendor_externo?.toString?.().trim?.() || null : null

    if (!cliente) return NextResponse.json({ ok: false, error: 'Cliente obrigatório' }, { status: 400 })

    const statusMap: Record<string, any> = {
      Pendente: 'PENDENTE',
      Pago: 'PAGO',
      Cancelado: 'CANCELADO',
      Faturado: 'FATURADO',
      'Em aberto': 'EM_ABERTO',
      Entregue: 'ENTREGUE',
    }

    const status = statusMap[statusStr] ?? 'PENDENTE'

    // helper to compute and save commissions for this order
    const recomputeCommissions = async (orderNumero: number) => {
      // Determine who is placing the order
      let meExterno: string | null = null
      let meTipo: 'VENDEDOR' | 'TELEVENDAS' | null = null
      if (userEmail) {
        const me = await prisma.vendedor.findFirst({ where: { email: userEmail } })
        meExterno = me?.id_vendedor_externo ?? null
        if (meExterno) {
          const tipo = await prisma.vendedor_tipo_acesso.findUnique({ where: { id_vendedor_externo: meExterno } })
          meTipo = (tipo?.tipo as any) || 'VENDEDOR'
        }
      }

      // Attempt to find the client's vendor by CNPJ (digits only)
      const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')
      const cnpjDigits = onlyDigits(cnpj)
      let clientVendorExterno: string | null = client_vendor_externo
      if (!clientVendorExterno && cnpjDigits) {
        // fallback: best-effort by CNPJ
        const cli = await prisma.cliente.findFirst({ where: { cpf_cnpj: { contains: cnpjDigits } } })
        clientVendorExterno = cli?.id_vendedor_externo ?? null
      }

      // Clean existing commissions for this order
      await prisma.platform_commission.deleteMany({ where: { order_num: orderNumero } })

      const entries: { beneficiary_externo: string; role: 'VENDEDOR' | 'TELEVENDAS'; percent: number; amount: number }[] = []

      if (meTipo === 'TELEVENDAS' && meExterno) {
        if (clientVendorExterno) {
          // 1% to telemarketing (who created the order), 4% to client's vendor
          entries.push({ beneficiary_externo: meExterno, role: 'TELEVENDAS', percent: 1, amount: (total * 1) / 100 })
          entries.push({ beneficiary_externo: clientVendorExterno, role: 'VENDEDOR', percent: 4, amount: (total * 4) / 100 })
        } else {
          // 5% to telemarketing
          entries.push({ beneficiary_externo: meExterno, role: 'TELEVENDAS', percent: 5, amount: (total * 5) / 100 })
        }
      } else if (meTipo === 'VENDEDOR' && meExterno) {
        // 5% to vendor
        entries.push({ beneficiary_externo: meExterno, role: 'VENDEDOR', percent: 5, amount: (total * 5) / 100 })
      }

      if (entries.length > 0) {
        await prisma.platform_commission.createMany({
          data: entries.map((e) => ({
            order_num: orderNumero,
            beneficiary_externo: e.beneficiary_externo,
            role: e.role as any,
            percent: e.percent,
            amount: Number((Math.round(e.amount * 100) / 100).toFixed(2)),
          })),
        })
      }
    }

    if (numeroInput && numeroInput > 0) {
      const existing = await prisma.platform_order.findUnique({ where: { numero: numeroInput } })
      if (!existing || existing.vendedor_id !== vendedorId) {
        return NextResponse.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })
      }

      const updated = await prisma.platform_order.update({
        where: { numero: numeroInput },
        data: {
          data: dataStr ? new Date(dataStr) : existing.data,
          cliente,
          cnpj,
          total,
          status,
          id_vendedor_externo: id_vendedor_externo,
          client_vendor_externo: client_vendor_externo,
        },
      })

      await recomputeCommissions(updated.numero)
      return NextResponse.json({ ok: true, numero: updated.numero })
    }

    const maxRow = await prisma.platform_order.findFirst({
      select: { numero: true },
      orderBy: { numero: 'desc' },
    })
    const nextNumero = (maxRow?.numero || 1000) + 1

    const created = await prisma.platform_order.create({
      data: {
        numero: nextNumero,
        data: dataStr ? new Date(dataStr) : new Date(),
        cliente,
        cnpj,
        total,
        status,
        id_vendedor_externo: id_vendedor_externo,
        client_vendor_externo: client_vendor_externo,
        vendedor_id: vendedorId,
      },
    })

    await recomputeCommissions(created.numero)
    return NextResponse.json({ ok: true, numero: created.numero })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar pedido' }, { status: 500 })
  }
}


