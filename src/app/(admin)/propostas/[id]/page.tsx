 "use client";
 
 import { useEffect } from "react";
 import { useParams, useRouter } from "next/navigation";
 import PageTitle from '@/components/PageTitle'
 import { Card } from 'react-bootstrap'
 
 export default function PropostasIdRedirectPage() {
   const params = useParams();
   const router = useRouter();
   const id = params?.id ?? '0';
 
   useEffect(() => {
     // Redireciona para o mesmo formulário de pedidos por enquanto
     router.replace(`/pedidos/${id}`);
   }, [id, router]);
 
   return (
     <>
       <PageTitle title="Redirecionando..." subName="Propostas" />
       <Card className="border-0 shadow-sm">
         <Card.Body>Redirecionando para o formulário...</Card.Body>
       </Card>
     </>
   );
 }


