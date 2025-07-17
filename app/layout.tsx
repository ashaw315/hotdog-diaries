import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hotdog Diaries',
  description: 'A website that scans social media for hotdog content and posts it 6 times daily',
  keywords: ['hotdog', 'social media', 'food', 'content'],
  authors: [{ name: 'Hotdog Diaries Team' }],
  viewport: 'width=device-width, initial-scale=1',
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