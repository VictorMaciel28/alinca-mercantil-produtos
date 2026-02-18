 "use client";
 
 import PedidosLista from '@/components/PedidosLista'
 import { getPropostas } from '@/services/propostas'
 
 export default function PropostasComerciaisPage() {
   return (
    <PedidosLista
      entity="proposta"
      title="Propostas Comerciais"
      subName="Consulta e acompanhamento"
      fetchFn={getPropostas}
      newItemPath="/pedidos/0?entity=proposta"
      itemRouteBase="/pedidos"
    />
   );
 }


