 "use client";
 
 import PedidosLista from '@/components/PedidosLista'
 import { getPedidos } from '@/services/pedidos'
 import { getPropostas } from '@/services/propostas'
 import { useSearchParams } from 'next/navigation'
 
 export default function PedidosPage() {
   const searchParams = useSearchParams()
   const entityParam = searchParams?.get('entity') ?? ''
   const isPropostaView = entityParam === 'proposta'
 
   return (
     <PedidosLista
       entity={isPropostaView ? 'proposta' : 'pedido'}
       title={isPropostaView ? 'Propostas Comerciais' : 'Pedidos'}
       subName="Consulta e acompanhamento"
       fetchFn={isPropostaView ? getPropostas : getPedidos}
       newItemPath={isPropostaView ? '/pedidos/0?entity=proposta' : '/pedidos/0'}
       itemRouteBase="/pedidos"
     />
   )
 }


