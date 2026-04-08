"use client";

import dynamic from 'next/dynamic';

// Ordem direta para a Vercel não tentar pré-carregar nada
export const dynamic = "force-dynamic";

const AppContent = dynamic(() => import('./AppContent'), { 
  ssr: false,
  loading: () => (
    <div style={{ background: 'black', minHeight: '100vh', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
      CARREGANDO VENDEDOR TRR...
    </div>
  )
});

export default function Page() {
  return <AppContent />;
}
