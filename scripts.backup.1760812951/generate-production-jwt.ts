#!/usr/bin/env tsx

/**
 * Generate Production JWT Token
 * 
 * This script generates a JWT token using the production JWT_SECRET for the admin user.
 * The generated token can be used to update the AUTH_TOKEN GitHub secret.
 * 
 * Usage:
 *   # Using production JWT_SECRET from environment:
 *   JWT_SECRET=<production-secret> npx tsx scripts/generate-production-jwt.ts
 *   
 *   # Or set it inline:
 *   npx tsx scripts/generate-production-jwt.ts <jwt-secret>
 */

import { AuthService } from '../lib/services/auth'

interface AdminUser {
  id: number
  username: string
}

async function generateProductionJWT() {
  try {
    console.log('🔐 Generating Production JWT Token for Hotdog Diaries')
    console.log('=' .repeat(55))
    
    // Get JWT_SECRET from command line argument or environment variable
    const jwtSecret = process.argv[2] || process.env.JWT_SECRET
    
    if (!jwtSecret) {
      console.error('❌ ERROR: JWT_SECRET not provided')
      console.error('')
      console.error('Usage Options:')
      console.error('  1. JWT_SECRET=<secret> npx tsx scripts/generate-production-jwt.ts')
      console.error('  2. npx tsx scripts/generate-production-jwt.ts <secret>')
      console.error('')
      console.error('To get the production JWT_SECRET:')
      console.error('  vercel env pull .env.production')
      console.error('  # Then look for JWT_SECRET in the file')
      process.exit(1)
    }

    // Temporarily set the JWT_SECRET environment variable
    const originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = jwtSecret

    console.log('📋 Token Generation Details:')
    console.log(`  JWT_SECRET length: ${jwtSecret.length} characters`)
    console.log(`  JWT_SECRET preview: ${jwtSecret.substring(0, 16)}...${jwtSecret.substring(jwtSecret.length - 8)}`)
    console.log('')

    // Admin user details (these should match production database)
    const adminUser: AdminUser = {
      id: 1,
      username: 'admin'
    }

    console.log('👤 Admin User Details:')
    console.log(`  User ID: ${adminUser.id}`)
    console.log(`  Username: ${adminUser.username}`)
    console.log('')

    // Generate the JWT token using AuthService
    console.log('🔧 Generating JWT token...')
    const token = AuthService.generateJWT(adminUser)
    
    // Verify the token works
    console.log('✅ Token generated successfully!')
    console.log('')
    
    // Test token verification
    try {
      const decoded = AuthService.verifyJWT(token)
      console.log('🔍 Token Verification Test:')
      console.log(`  ✅ Token is valid`)
      console.log(`  User ID: ${decoded.userId}`)
      console.log(`  Username: ${decoded.username}`)
      console.log(`  Issued at: ${new Date((decoded.iat || 0) * 1000).toISOString()}`)
      console.log(`  Expires at: ${new Date((decoded.exp || 0) * 1000).toISOString()}`)
      console.log('')
    } catch (error) {
      console.error('❌ Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Output the token for GitHub secrets
    console.log('🎯 PRODUCTION AUTH_TOKEN:')
    console.log('=' .repeat(55))
    console.log(token)
    console.log('=' .repeat(55))
    console.log('')
    
    console.log('📝 Next Steps:')
    console.log('1. Copy the token above')
    console.log('2. Update GitHub secret:')
    console.log('   gh secret set AUTH_TOKEN --body="<paste-token-here>"')
    console.log('')
    console.log('3. Or update via GitHub UI:')
    console.log('   Settings → Secrets and variables → Actions → AUTH_TOKEN')
    console.log('')
    console.log('⚠️  IMPORTANT: This token expires in 24 hours!')
    console.log('   You may want to regenerate it periodically or extend the expiry.')

    // Restore original JWT_SECRET
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret
    } else {
      delete process.env.JWT_SECRET
    }

  } catch (error) {
    console.error('❌ Failed to generate production JWT token:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Generate Production JWT Token for Hotdog Diaries')
  console.log('')
  console.log('Usage:')
  console.log('  JWT_SECRET=<production-secret> npx tsx scripts/generate-production-jwt.ts')
  console.log('  npx tsx scripts/generate-production-jwt.ts <jwt-secret>')
  console.log('')
  console.log('Options:')
  console.log('  --help, -h    Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  # Using environment variable:')
  console.log('  JWT_SECRET=abc123... npx tsx scripts/generate-production-jwt.ts')
  console.log('')
  console.log('  # Using command line argument:')
  console.log('  npx tsx scripts/generate-production-jwt.ts abc123...')
  process.exit(0)
}

// Run the script
generateProductionJWT()