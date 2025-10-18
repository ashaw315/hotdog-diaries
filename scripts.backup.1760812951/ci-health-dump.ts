#!/usr/bin/env tsx

/**
 * CI Health Debug Logger
 * Dumps comprehensive environment and configuration info for debugging CI issues
 */

console.log('🧪 ================================')
console.log('🧪 CI ENVIRONMENT HEALTH SUMMARY')
console.log('🧪 ================================')

console.log('\n📋 Basic Environment:')
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ NOT SET')
console.log('CI:', process.env.CI || '❌ NOT SET')
console.log('GITHUB_ACTIONS:', process.env.GITHUB_ACTIONS || '❌ NOT SET')
console.log('VERCEL:', process.env.VERCEL || '❌ NOT SET')

console.log('\n🔑 API Keys Status:')
console.log('YOUTUBE_API_KEY:', process.env.YOUTUBE_API_KEY ? '✅ SET (' + process.env.YOUTUBE_API_KEY.substring(0, 8) + '...)' : '❌ NOT SET')
console.log('IMGUR_CLIENT_ID:', process.env.IMGUR_CLIENT_ID ? '✅ SET (' + process.env.IMGUR_CLIENT_ID.substring(0, 8) + '...)' : '❌ NOT SET')
console.log('GIPHY_API_KEY:', process.env.GIPHY_API_KEY ? '✅ SET (' + process.env.GIPHY_API_KEY.substring(0, 8) + '...)' : '❌ NOT SET')
console.log('PIXABAY_API_KEY:', process.env.PIXABAY_API_KEY ? '✅ SET (' + process.env.PIXABAY_API_KEY.substring(0, 8) + '...)' : '❌ NOT SET')
console.log('REDDIT_CLIENT_ID:', process.env.REDDIT_CLIENT_ID ? '✅ SET (' + process.env.REDDIT_CLIENT_ID.substring(0, 8) + '...)' : '❌ NOT SET')
console.log('REDDIT_CLIENT_SECRET:', process.env.REDDIT_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET')

console.log('\n🦋 Bluesky Credentials:')
console.log('BLUESKY_IDENTIFIER:', process.env.BLUESKY_IDENTIFIER || '❌ NOT SET')
console.log('BLUESKY_APP_PASSWORD:', process.env.BLUESKY_APP_PASSWORD ? '✅ SET' : '❌ NOT SET')

console.log('\n🗄️ Database Configuration:')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET (PostgreSQL)' : '❌ NOT SET')
console.log('DATABASE_URL_SQLITE:', process.env.DATABASE_URL_SQLITE ? '✅ SET (' + process.env.DATABASE_URL_SQLITE + ')' : '❌ NOT SET')
console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? '✅ SET (Vercel)' : '❌ NOT SET')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET')
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET')

console.log('\n🔐 Authentication:')
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET')
console.log('ADMIN_USERNAME:', process.env.ADMIN_USERNAME || '❌ NOT SET')
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '✅ SET' : '❌ NOT SET')
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL || '❌ NOT SET')

console.log('\n🎭 Playwright Configuration:')
console.log('PLAYWRIGHT_BASE_URL:', process.env.PLAYWRIGHT_BASE_URL || '❌ NOT SET')
console.log('BASE_URL:', process.env.BASE_URL || '❌ NOT SET')
console.log('DEBUG:', process.env.DEBUG || '❌ NOT SET')

console.log('\n🔍 Test Environment Detection:')
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isVercel = process.env.VERCEL === '1'
const isTest = process.env.NODE_ENV === 'test'
const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

console.log('Is CI Environment:', isCI ? '✅ YES' : '❌ NO')
console.log('Is GitHub Actions:', isGitHubActions ? '✅ YES' : '❌ NO')
console.log('Is Vercel:', isVercel ? '✅ YES' : '❌ NO')
console.log('Is Test Mode:', isTest ? '✅ YES' : '❌ NO')
console.log('Is Development:', isDev ? '✅ YES' : '❌ NO')
console.log('Is Production:', isProd ? '✅ YES' : '❌ NO')

console.log('\n⚙️ Build Environment:')
console.log('PWD:', process.cwd())
console.log('Node Version:', process.version)
console.log('Platform:', process.platform)
console.log('Architecture:', process.arch)

// Check for critical missing variables
console.log('\n🚨 Critical Issues Check:')
const issues = []

if (!process.env.JWT_SECRET) {
  issues.push('❌ JWT_SECRET is missing - authentication will fail')
}

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_SQLITE && !process.env.POSTGRES_URL) {
  issues.push('❌ No database URL configured - database connections will fail')
}

if (isCI && !process.env.CI) {
  issues.push('⚠️ Environment appears to be CI but CI flag not set')
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  issues.push('⚠️ Admin credentials not set - admin login tests may fail')
}

if (issues.length === 0) {
  console.log('✅ No critical issues detected!')
} else {
  console.log('Found', issues.length, 'issues:')
  issues.forEach(issue => console.log('  ', issue))
}

console.log('\n💡 Quick Fix Commands:')
if (!process.env.JWT_SECRET) {
  console.log('export JWT_SECRET="ci-test-jwt-secret-' + Date.now() + '"')
}
if (!process.env.DATABASE_URL_SQLITE && !process.env.DATABASE_URL) {
  console.log('export DATABASE_URL_SQLITE="./test_hotdog_diaries.db"')
}
if (!process.env.ADMIN_USERNAME) {
  console.log('export ADMIN_USERNAME="admin"')
}
if (!process.env.ADMIN_PASSWORD) {
  console.log('export ADMIN_PASSWORD="StrongAdminPass123!"')
}

console.log('\n🧪 ================================')
console.log('🧪 CI HEALTH SUMMARY COMPLETE')
console.log('🧪 ================================\n')

// Exit with appropriate code
if (issues.filter(i => i.includes('❌')).length > 0) {
  console.log('⚠️ Exiting with warning code due to critical issues')
  process.exit(1)
} else {
  console.log('✅ Environment health check passed')
  process.exit(0)
}