export const metadata = {
  title: 'VTRR Mobile',
  description: 'VTRR Mobile - Prospecção TRR',
  manifest: '/manifest.json',
  themeColor: '#071426',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png'
  },
  appleWebApp: {
    capable: true,
    title: 'VTRR Mobile',
    statusBarStyle: 'black-translucent'
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#071426'
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0, background: '#071426' }}>
        {children}
      </body>
    </html>
  )
}
