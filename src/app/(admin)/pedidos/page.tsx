 "use client";
 
 import PedidosLista from '@/components/PedidosLista'
 import { getPedidos } from '@/services/pedidos'
 
 export default function PedidosPage() {
   return (
     <PedidosLista
       entity="pedido"
       title="Pedidos"
       subName="Consulta e acompanhamento"
       fetchFn={getPedidos}
       newItemPath="/pedidos/0"
       itemRouteBase="/pedidos"
     />
   )
 }


