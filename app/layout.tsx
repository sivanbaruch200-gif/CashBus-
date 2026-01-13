import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CashBus - פיצוי אוטומטי על עיכובים בתחבורה ציבורית',
  description: 'פלטפורמת Legal-Tech לקבלת פיצויים אוטומטיים על עיכובים והפסדים בתחבורה ציבורית',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
