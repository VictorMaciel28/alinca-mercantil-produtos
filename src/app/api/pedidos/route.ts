import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { options } from '@/app/api/auth/[...nextauth]/options'
import { tinyV3Fetch } from '@/lib/tinyOAuth'

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
      body?.vendedor?.id != null ? String(body.vendedor.id).trim() : null
    const client_vendor_externo: string | null =
      body?.client_vendor_externo != null ? body.client_vendor_externo?.toString?.().trim?.() || null : null
    const forma_recebimento: string | null =
      body?.forma_recebimento != null ? body.forma_recebimento?.toString?.().trim?.() || null : null
    const condicao_pagamento: string | null =
      body?.condicao_pagamento != null ? body.condicao_pagamento?.toString?.().trim?.() || null : null
    const endereco_entrega: any = body?.endereco_entrega && typeof body.endereco_entrega === 'object' ? body.endereco_entrega : null

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

    const normalizeItems = (items: any[]): any[] => {
      if (!Array.isArray(items)) return []
      return items
        .map((it: any) => {
          const node = it?.item && typeof it.item === 'object' ? it.item : it
          const nome = (node?.descricao || node?.nome || '').toString().trim()
          const quantidade = Number(node?.quantidade || 0)
          const preco = Number(node?.valor_unitario ?? node?.preco ?? 0)
          if (!nome || quantidade <= 0) return null
          const produtoIdRaw = node?.produtoId ?? node?.produto_id ?? it?.produtoId ?? it?.produto_id
          const produtoIdNum = produtoIdRaw != null ? Number(produtoIdRaw) : null
          return {
            produto_id: produtoIdNum && !Number.isNaN(produtoIdNum) ? produtoIdNum : null,
            codigo: node?.codigo ? String(node.codigo) : null,
            nome,
            preco,
            quantidade,
            unidade: node?.unidade ? String(node.unidade) : 'UN',
          }
        })
        .filter(Boolean)
    }

    const toIsoDate = (s: any) => (s ? String(s).slice(0, 10) : new Date().toISOString().slice(0, 10))
    const rawCliente = typeof body?.cliente === 'object' ? body?.cliente : null
    const idContatoRaw = rawCliente?.id ?? rawCliente?.idContato ?? rawCliente?.external_id ?? null
    const idContato = idContatoRaw != null ? Number(idContatoRaw) : null
    const vendedorTinyId = id_vendedor_externo != null ? Number(id_vendedor_externo) : null
    const endereco = endereco_entrega || {}

    const normalizedItems = normalizeItems(body?.itens || [])
    const itensV3 = normalizedItems
      .map((it: any) => {
        const productId = it?.produto_id ? Number(it.produto_id) : null
        if (!productId || Number.isNaN(productId)) return null
        return {
          produto: { id: productId, tipo: 'P' },
          quantidade: Number(it.quantidade || 0),
          valorUnitario: Number(it.preco || 0),
        }
      })
      .filter(Boolean)

    if (itensV3.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Itens do pedido sem produto_id para API v3. Selecione produtos com vínculo de ID.' },
        { status: 400 }
      )
    }

    const pedidoV3: any = {
      data: toIsoDate(body?.data),
      valorDesconto: 0,
      valorFrete: 0,
      valorOutrasDespesas: 0,
      itens: itensV3,
      ecommerce: {
        numeroPedidoEcommerce: String(body?.numero || numeroInput || ''),
      },
      enderecoEntrega: {
        endereco: endereco?.endereco || '',
        enderecoNro: endereco?.numero || '',
        complemento: endereco?.complemento || '',
        bairro: endereco?.bairro || '',
        municipio: endereco?.cidade || '',
        cep: endereco?.cep || '',
        uf: endereco?.uf || '',
      },
    }
    if (idContato && !Number.isNaN(idContato)) pedidoV3.idContato = idContato
    pedidoV3.vendedor = { id: vendedorTinyId }
    if (body?.pagamento && typeof body.pagamento === 'object') {
      pedidoV3.pagamento = body.pagamento
    }

    const resTiny = await tinyV3Fetch('/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedidoV3),
    })
    const dataTiny = await resTiny.json().catch(() => null)

      // Try to extract Tiny-assigned order number and id
      let tinyNumero: string | null = null
      let tinyId: number | null = null
      try {
        if (dataTiny?.numeroPedido) tinyNumero = String(dataTiny.numeroPedido)
        if (dataTiny?.id) tinyId = Number(dataTiny.id)
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
          cliente: ((rawCliente?.nome as string) ?? (body?.cliente || '')).toString(),
          cnpj: ((rawCliente?.cpf_cnpj as string) ?? (body?.cnpj || '')).toString(),
          total: total,
          status: platformStatus,
          forma_recebimento,
          condicao_pagamento,
          endereco_entrega,
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

        // Commission is now computed from fiscal-note webhook flow.

        // Persist order items for edit/reload flow
        await prisma.platform_order_product.deleteMany({ where: { order_num: platformNumero } })
        if (normalizedItems.length > 0) {
          await prisma.platform_order_product.createMany({
            data: normalizedItems.map((it: any) => ({
              order_num: platformNumero,
              produto_id: it.produto_id,
              codigo: it.codigo,
              nome: it.nome,
              preco: Number(it.preco || 0),
              quantidade: Number(it.quantidade || 0),
              unidade: it.unidade || 'UN',
            })),
          })
        }

        // Return Tiny response + platform numero
        return NextResponse.json(
          { ok: true, tinyResponse: dataTiny, sentObject: pedidoV3, numero: platformNumero },
          { status: resTiny.ok ? 200 : resTiny.status }
        )
      }

      // If no numero from Tiny, just return its response for inspection
      return NextResponse.json({ ok: true, tinyResponse: dataTiny, sentObject: pedidoV3 }, { status: resTiny.ok ? 200 : resTiny.status })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao salvar pedido' }, { status: 500 })
  }
}


