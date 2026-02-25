import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Telltale',
  description: 'Sailing team video review',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-gray-50">{children}</body>
    </html>
  )
}
