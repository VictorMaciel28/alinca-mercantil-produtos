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
       newItemPath="/propostas/0"
       itemRouteBase="/propostas"
     />
   );
 }


