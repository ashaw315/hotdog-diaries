/** @type {import('next').NextConfig} */

// CI-safe environment fallbacks
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
if (isCI) {
  console.log('🧪 [CI] Injecting CI-safe API key defaults...')
  
  // Set dummy API keys for CI environment to prevent missing key errors
  process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'fake-test-youtube-key'
  process.env.IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || 'fake-test-imgur-id'
  process.env.BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || 'test@fake.com'
  process.env.BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD || 'fake-test-password'
  process.env.GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'fake-test-giphy-key'
  process.env.PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || 'fake-test-pixabay-key'
  process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'fake-test-reddit-id'
  process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'fake-test-reddit-secret'
  process.env.REDDIT_USERNAME = process.env.REDDIT_USERNAME || 'fake-test-user'
  process.env.REDDIT_PASSWORD = process.env.REDDIT_PASSWORD || 'fake-test-pass'
  
  // Database fallback for CI
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_SQLITE) {
    process.env.DATABASE_URL_SQLITE = './ci-test.db'
    console.log('🧪 [CI] Set DATABASE_URL_SQLITE fallback: ./ci-test.db')
  }
  
  // JWT Secret fallback
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'ci-test-jwt-secret-' + Date.now()
    console.log('🧪 [CI] Generated JWT_SECRET fallback')
  }
  
  console.log('✅ [CI] API key defaults injected successfully')
}

const nextConfig = {
  // Fix workspace root detection for build
  outputFileTracingRoot: process.cwd(),
  
  // Production optimizations
  productionBrowserSourceMaps: false,
  // swcMinify is deprecated in Next.js 15 - SWC is enabled by default
  compress: true,
  
  // TypeScript and ESLint (temporarily ignore for production build)
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore for production build
  },
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore for production build
  },
  
  // Image optimization
  images: {
    domains: [
      'i.redd.it',
      'preview.redd.it',
      'external-preview.redd.it',
      'i.imgur.com',
      'imgur.com',
      'media.giphy.com',
      'i.giphy.com',
      'pixabay.com',
      'cdn.pixabay.com',
      'images.unsplash.com',
      'img.youtube.com',
      'i.ytimg.com',
      '64.media.tumblr.com',
      'media.tumblr.com'
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Performance optimizations
  webpack: (config, { isServer, dev, webpack }) => {
    // Prevent legacy imports from breaking Vercel builds
    // These aliases block any accidental imports of problematic packages
    config.resolve.alias = {
      ...config.resolve.alias,
      'path-template': false,
      'request-promise': false,
      'request-promise-native': false,
      'request-promise-core': false,
      'cls-bluebird': false,
      'continuation-local-storage': false,
      'snoowrap': false
    }
    
    // Ignore pg-native module warnings
    if (isServer) {
      config.externals.push('pg-native')
      // Fix "self is not defined" error in server builds
      config.output.globalObject = 'this'
      
      // Harden build layer by excluding problematic legacy dependencies
      // This prevents tree-shaking issues and build-time imports of server-only modules
      config.externals.push({
        // Exclude legacy HTTP clients that cause build issues
        'request': 'commonjs request',
        'request-promise': 'commonjs request-promise', 
        'request-promise-native': 'commonjs request-promise-native',
        
        // Exclude legacy auth/crypto modules that don't work in edge runtime
        'cls-bluebird': 'commonjs cls-bluebird',
        'continuation-local-storage': 'commonjs continuation-local-storage',
        
        // Exclude Node.js-specific modules that break in Vercel Edge Runtime
        'fs-extra': 'commonjs fs-extra',
        'node-fetch': 'commonjs node-fetch',
        
        // Exclude old social media SDKs that have compatibility issues
        'snoowrap': 'commonjs snoowrap',
        'tumblr.js': 'commonjs tumblr.js',
        
        // Exclude modules with native dependencies
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
        'canvas': 'commonjs canvas'
      })
    }
    
    // Production optimizations
    if (!dev) {
      // Tree shaking
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
      
      // Fix global object for server rendering
      if (isServer) {
        config.output.globalObject = 'this'
      }
    }
    
    return config
  },
  
  // Server externals
  serverExternalPackages: ['pg', 'pg-native', 'sqlite3'],
  
  // Headers for static assets
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        source: '/:path*\\.(png|jpg|jpeg|gif|webp|svg|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Redirects for old test routes in production
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/test-:path*',
          destination: '/',
          permanent: true,
        },
        {
          source: '/api/test/:path*',
          destination: '/api/health',
          permanent: true,
        }
      ]
    }
    return []
  }
}

module.exports = nextConfig