import './globals.css'

export const metadata = {
  title: 'Vendedor TRR',
  description: 'Sistema de Gestão',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br">
      <body>{children}</body>
    </html>
  )
}
