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

    // NOTE: persisting to the platform DB is commented out for now per request.
    // The code below would normally update or create the platform_order and recompute commissions.
    // It is intentionally disabled so we only forward to Tiny and return its response + the sent object.

    // Prepare object to send to Tiny (the frontend body is forwarded as-is under 'pedido')
    const tinyToken = process.env.TINY_API_TOKEN
    if (!tinyToken) {
      return NextResponse.json({ ok: false, error: 'Token Tiny não configurado' }, { status: 500 })
    }

    // Prepare objeto para Tiny: Tiny espera `pedido.cliente` como objeto.
    const pedidoToSend: any = { ...body }
    // If cliente is a plain string (nome) or missing, replace with object containing cpf_cnpj (CNPJ)
    if (!pedidoToSend.cliente || typeof pedidoToSend.cliente === 'string') {
      // When UI provides cliente as string, convert to Tiny's expected object with nome and cpf_cnpj
      pedidoToSend.cliente = {
        nome: (body?.cliente || '').toString().trim(),
        cpf_cnpj: (body?.cnpj || '').toString().trim(),
      }
    } else if (typeof pedidoToSend.cliente === 'object') {
      // Ensure object has both nome and cpf_cnpj populated (prefer explicit fields, fallback to top-level cnpj)
      if (!pedidoToSend.cliente.cpf_cnpj) {
        pedidoToSend.cliente.cpf_cnpj = (body?.cnpj || '').toString().trim()
      }
      if (!pedidoToSend.cliente.nome && body?.cliente) {
        pedidoToSend.cliente.nome = (body?.cliente || '').toString().trim()
      }
    }
    // Remove top-level cnpj to avoid duplication (Tiny expects cliente.cpf_cnpj)
    delete pedidoToSend.cnpj
    // Ensure data_pedido is in Tiny's expected dd/mm/YYYY format
    const makeDDMMYYYY = (isoOrStr: string | Date) => {
      const d = typeof isoOrStr === 'string' && isoOrStr.length >= 10 ? new Date(isoOrStr) : new Date(isoOrStr)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }
    // prefer body.data (ISO YYYY-MM-DD) else today's date
    pedidoToSend.data_pedido = body?.data ? makeDDMMYYYY(body.data) : makeDDMMYYYY(new Date())

    // Build form data for Tiny (Tiny expects 'pedido' as JSON string)
    const formData = new URLSearchParams()
    formData.append('token', tinyToken)
    formData.append('formato', 'json')
    formData.append('pedido', JSON.stringify({ pedido: pedidoToSend }))

    try {
      const resTiny = await fetch('https://api.tiny.com.br/api2/pedido.incluir.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formData.toString(),
      })
      const dataTiny = await resTiny.json().catch(() => null)

      // Try to extract Tiny-assigned order number and id
      let tinyNumero: string | null = null
      let tinyId: number | null = null
      try {
        const reg = dataTiny?.retorno?.registros?.registro
        const registro = Array.isArray(reg) ? reg[0] : reg
        if (registro) {
          if (registro.numero) tinyNumero = String(registro.numero)
          if (registro.id) tinyId = Number(registro.id)
        }
      } catch (e) {
        // ignore extraction errors
      }

      // If Tiny returned a numero, persist (create or update) the platform_order with that numero
      if (tinyNumero) {
        const platformNumero = Number(tinyNumero)
        // Map status string to platform enum
        const statusMap: Record<string, any> = {
          Pendente: 'PENDENTE',
          Pago: 'PAGO',
          Cancelado: 'CANCELADO',
          Faturado: 'FATURADO',
          'Em aberto': 'EM_ABERTO',
          Entregue: 'ENTREGUE',
          Proposta: 'PROPOSTA',
        }

        const platformStatus = statusMap[(body?.status as string) || 'Pendente'] ?? 'PENDENTE'

        // Build record payload
        const baseOrderData: any = {
          numero: platformNumero,
          data: dataStr ? new Date(dataStr) : new Date(),
          cliente: (pedidoToSend?.cliente?.nome ?? (body?.cliente || '')).toString(),
          cnpj: (pedidoToSend?.cliente?.cpf_cnpj ?? (body?.cnpj || '')).toString(),
          total: total,
          status: platformStatus,
          id_vendedor_externo: id_vendedor_externo,
          client_vendor_externo: client_vendor_externo,
        }
        // do not store tiny_id directly on platform_order (no such column)

        // Upsert: if exists update, else create
        const existing = await prisma.platform_order.findUnique({ where: { numero: platformNumero } })
        let savedOrder
        if (existing) {
          // For update, connect vendedor relation if vendedorId provided
          const updateData: any = { ...baseOrderData }
          if (vendedorId) {
            updateData.vendedor = { connect: { id: vendedorId } }
          }
          savedOrder = await prisma.platform_order.update({
            where: { numero: platformNumero },
            data: updateData,
          })
        } else {
          // For create, include vendedor relation connect when available
          const createData: any = { ...baseOrderData }
          if (vendedorId) {
            createData.vendedor = { connect: { id: vendedorId } }
          }
          savedOrder = await prisma.platform_order.create({ data: createData })
        }

        // If Tiny provided an id, store it on platform_order.tiny_id
        if (tinyId) {
          try {
            await prisma.platform_order.update({
              where: { numero: platformNumero },
              data: { tiny_id: tinyId },
            })
          } catch (e) {
            // ignore errors updating tiny_id
          }
        }

        // Recompute commissions
        await recomputeCommissions(savedOrder.numero)

        // Return Tiny response + platform numero
        return NextResponse.json(
          { ok: true, tinyResponse: dataTiny, sentObject: body, numero: platformNumero },
          { status: resTiny.ok ? 200 : resTiny.status }
        )
      }

      // If no numero from Tiny, just return its response for inspection
      return NextResponse.json({ ok: true, tinyResponse: dataTiny, sentObject: body }, { status: resTiny.ok ? 200 : resTiny.status })
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: 'Falha ao comunicar com Tiny', details: err?.message || String(err) }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar pedido' }, { status: 500 })
  }
}


