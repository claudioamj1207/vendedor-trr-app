export const metadata = {
  title: 'VTRR',
  description: 'Sistema VTRR - Vendedor TRR',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon-192.png'
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0, background: '#061a3a' }}>
        {children}
      </body>
    </html>
  )
}
