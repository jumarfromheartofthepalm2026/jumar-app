import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'جُمار — تمريات طبيعية',
  description: 'حلوى تمر طبيعية بدون سكر مضاف',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
