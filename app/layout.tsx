import type { Metadata, Viewport } from 'next'
import { Bungee, Pacifico, Anton, Bebas_Neue, Inter } from 'next/font/google'
import './globals.css'
import CIRuntimeGuard from './ci-runtime-guard'

// Import CI disable logic as early as possible
import '@/lib/init/ci-disable'

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
        {process.env.NEXT_PUBLIC_CI === 'true' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                console.log('🧪 CI MODE: Early browser script running');
                
                // Override fetch immediately
                const originalFetch = window.fetch;
                window.fetch = async (...args) => {
                  const url = args[0]?.toString?.() ?? '';
                  if (url.includes('/api/admin/metrics') || url.includes('/api/admin/me')) {
                    console.log('🧪 [CI] Early blocking API call:', url);
                    return new Response(
                      JSON.stringify({ success: true, message: 'CI early mock', data: {} }),
                      { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                  }
                  return originalFetch(...args);
                };
                
                // Override timers immediately
                const origSetInterval = window.setInterval;
                window.setInterval = (fn, ms, ...rest) => {
                  if (ms > 2000) {
                    console.log('🧪 [CI] Early blocking setInterval:', ms + 'ms');
                    return -1;
                  }
                  return origSetInterval(fn, ms, ...rest);
                };
                
                console.log('✅ [CI] Early browser overrides installed');
              `,
            }}
          />
        )}
      </head>
      <body className={`${bungee.variable} ${pacifico.variable} ${anton.variable} ${bebasNeue.variable} ${inter.variable}`}>
        <CIRuntimeGuard />
        {children}
      </body>
    </html>
  )
}