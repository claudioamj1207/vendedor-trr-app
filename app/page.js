import dynamic from 'next/dynamic';
import './globals.css'; // <-- ESTA É A LINHA QUE TRAZ O VISUAL E AS CORES DE VOLTA

const AppContent = dynamic(() => import('./AppContent'), {
  ssr: false,
});

export default function Page() {
  return <AppContent />;
}
