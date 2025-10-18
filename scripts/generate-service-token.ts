#!/usr/bin/env tsx
/**
 * Generate a service account token for GitHub Actions CI/CD
 * Usage: npm run generate:service-token
 */

import { AuthService } from '../lib/services/auth'
import { AdminService } from '../lib/services/admin'
import { db } from '../lib/db'
import * as crypto from 'crypto'

async function generateServiceToken() {
  console.log('🔐 Service Account Token Generator')
  console.log('==================================\n')

  try {
    // Connect to database
    await db.connect()

    // Generate service account secret
    const serviceSecret = crypto.randomBytes(32).toString('hex')
    
    // Get or create service account
    let serviceAccount = await AdminService.getServiceAccount()
    
    if (!serviceAccount) {
      console.log('📝 Creating new service account...')
      serviceAccount = await AdminService.createServiceAccount()
      console.log('✅ Service account created:', serviceAccount.username)
    } else {
      console.log('✅ Service account found:', serviceAccount.username)
    }

    // Generate service token (30-day expiry)
    const serviceToken = AuthService.generateServiceToken({
      id: serviceAccount.id,
      username: serviceAccount.username
    })

    // Get token expiry
    const expiry = AuthService.getTokenExpiry(serviceToken)

    console.log('\n🎉 Service Token Generated Successfully!')
    console.log('========================================\n')
    
    console.log('📋 GITHUB SECRETS TO CONFIGURE:')
    console.log('--------------------------------')
    console.log('')
    console.log('1. SERVICE_ACCOUNT_SECRET:')
    console.log(`   ${serviceSecret}`)
    console.log('')
    console.log('2. AUTH_TOKEN (backup - optional):')
    console.log(`   ${serviceToken}`)
    console.log('')
    
    console.log('📝 SETUP INSTRUCTIONS:')
    console.log('----------------------')
    console.log('1. Go to GitHub repository settings')
    console.log('2. Navigate to Secrets and variables > Actions')
    console.log('3. Add/Update the following secrets:')
    console.log('   - SERVICE_ACCOUNT_SECRET (use value above)')
    console.log('   - AUTH_TOKEN (optional backup)')
    console.log('')
    
    console.log('📊 TOKEN INFORMATION:')
    console.log('---------------------')
    console.log('Account ID:', serviceAccount.id)
    console.log('Username:', serviceAccount.username)
    console.log('Token Type: Service Account (30-day)')
    console.log('Expires:', expiry ? expiry.toISOString() : 'Unknown')
    console.log('')
    
    console.log('⚠️  IMPORTANT NOTES:')
    console.log('-------------------')
    console.log('• Save SERVICE_ACCOUNT_SECRET in your .env.local file:')
    console.log(`  SERVICE_ACCOUNT_SECRET="${serviceSecret}"`)
    console.log('• This secret is used to generate fresh tokens automatically')
    console.log('• Tokens will auto-refresh before expiry in GitHub Actions')
    console.log('• The service account has admin privileges - keep it secure!')
    console.log('')
    
    console.log('✨ Your CI/CD authentication is now configured!')
    console.log('GitHub Actions will automatically refresh tokens as needed.')

  } catch (error) {
    console.error('❌ Error generating service token:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run if executed directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('generate-service-token')
if (isMainModule) {
  generateServiceToken()
}