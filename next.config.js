/** @type {import('next').NextConfig} */

// CI-safe environment fallbacks
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
if (isCI) {
  // Set dummy API keys for CI environment to prevent missing key errors
  process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'fake-test-youtube-key'
  process.env.IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || 'fake-test-imgur-id'
  process.env.BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || 'test@fake.com'
  process.env.BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD || 'fake-test-password'
  process.env.GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'fake-test-giphy-key'
  process.env.PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || 'fake-test-pixabay-key'
  process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'fake-test-reddit-id'
  process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'fake-test-reddit-secret'
}

const nextConfig = {
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
    // Ignore pg-native module warnings
    if (isServer) {
      config.externals.push('pg-native')
      // Fix "self is not defined" error in server builds
      config.output.globalObject = 'this'
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