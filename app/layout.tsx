import type { Metadata, Viewport } from 'next'
import { Bungee, Pacifico, Anton, Bebas_Neue, Inter } from 'next/font/google'
import './globals.css'

const bungee = Bungee({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee',
  display: 'swap'
})

const pacifico = Pacifico({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
  display: 'swap'
})

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap'
})

const bebasNeue = Bebas_Neue({
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  display: 'swap'
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

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
    <html lang="en" className={`${bungee.variable} ${pacifico.variable} ${anton.variable} ${bebasNeue.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Pacifico&family=Dancing+Script:wght@400;700&family=Bungee&family=Anton&family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className={`${bungee.variable} ${pacifico.variable} ${anton.variable} ${bebasNeue.variable} ${inter.variable}`}>{children}</body>
    </html>
  )
}