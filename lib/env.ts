// Environment variable loader for CLI contexts
// Next.js automatically loads .env files in web context, but CLI scripts need explicit loading

import { config } from 'dotenv'
import path from 'path'

let envLoaded = false

export function loadEnv() {
  if (envLoaded) return
  
  // Load .env.local first (highest priority)
  config({ path: path.resolve(process.cwd(), '.env.local') })
  
  // Load .env as fallback
  config({ path: path.resolve(process.cwd(), '.env') })
  
  envLoaded = true
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Environment loaded:', {
      youtube: process.env.YOUTUBE_API_KEY ? `${process.env.YOUTUBE_API_KEY.length} chars` : 'missing',
      giphy: process.env.GIPHY_API_KEY ? `${process.env.GIPHY_API_KEY.length} chars` : 'missing',
      reddit: process.env.REDDIT_CLIENT_ID ? `${process.env.REDDIT_CLIENT_ID.length} chars` : 'missing',
      pixabay: process.env.PIXABAY_API_KEY ? `${process.env.PIXABAY_API_KEY.length} chars` : 'missing'
    })
  }
}

// Auto-load when imported (useful for CLI scripts)
loadEnv()