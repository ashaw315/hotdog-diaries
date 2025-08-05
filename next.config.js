/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Ignore pg-native module warnings
    if (isServer) {
      config.externals.push('pg-native')
    }
    return config
  },
  // Suppress pg-native warnings during build
  serverExternalPackages: ['pg', 'pg-native']
}

module.exports = nextConfig