"use client";

import dynamic from 'next/dynamic';

const AppContent = dynamic(() => import('./AppContent'), { 
  ssr: false,
  loading: () => <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-bold uppercase italic">Carregando Vendedor TRR...</div>
});

export default function Page() {
  return <AppContent />;
}
