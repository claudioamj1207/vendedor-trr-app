import dynamic from 'next/dynamic';

const AppContent = dynamic(() => import('./AppContent'), {
  ssr: false,
});

export default function Page() {
  return <AppContent />;
}
