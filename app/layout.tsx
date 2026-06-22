export const metadata = {
  title: 'Vendedor TRR',
  description: 'Sistema de Gestão',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0, background: 'black' }}>
        {children}
      </body>
    </html>
  )
}
