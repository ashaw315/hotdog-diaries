import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hotdog Diaries',
  description: 'A website that scans social media for hotdog content and posts it 6 times daily',
  keywords: ['hotdog', 'social media', 'food', 'content'],
  authors: [{ name: 'Hotdog Diaries Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}