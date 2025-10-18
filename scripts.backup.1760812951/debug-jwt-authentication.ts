#!/usr/bin/env tsx

/**
 * JWT Authentication Debug and Test Script
 * 
 * This script diagnoses JWT authentication issues between local and production environments.
 * It tests token generation, validation, and API endpoint authentication.
 * 
 * Usage:
 *   # Test with local environment
 *   JWT_SECRET=<local-secret> npx tsx scripts/debug-jwt-authentication.ts
 *   
 *   # Test with production environment  
 *   JWT_SECRET=<production-secret> SITE_URL=https://hotdog-diaries.vercel.app npx tsx scripts/debug-jwt-authentication.ts
 *   
 *   # Test specific token
 *   TEST_TOKEN=<token> npx tsx scripts/debug-jwt-authentication.ts
 */

import { AuthService } from '../lib/services/auth'
import { AdminService } from '../lib/services/admin'
import { db } from '../lib/db'

interface TestResult {
  test: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message: string
  details?: any
}

class JWTAuthenticationDebugger {
  private results: TestResult[] = []
  private siteUrl: string
  private testToken?: string

  constructor(options: { siteUrl?: string; testToken?: string } = {}) {
    this.siteUrl = options.siteUrl || process.env.SITE_URL || 'http://localhost:3003'
    this.testToken = options.testToken || process.env.TEST_TOKEN
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ test, status, message, details })
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
    console.log(`${icon} ${test}: ${message}`)
    if (details && process.env.VERBOSE) {
      console.log('   Details:', JSON.stringify(details, null, 2))
    }
  }

  private async testEnvironmentSetup(): Promise<void> {
    console.log('🔧 Testing Environment Setup')
    console.log('=' .repeat(50))

    // Test JWT_SECRET availability
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      this.addResult('JWT_SECRET', 'FAIL', 'JWT_SECRET environment variable not set')
      return
    } else {
      this.addResult('JWT_SECRET', 'PASS', `JWT_SECRET loaded (${jwtSecret.length} chars)`)
    }

    // Test AUTH_TOKEN in environment
    const authToken = process.env.AUTH_TOKEN
    if (authToken) {
      this.addResult('AUTH_TOKEN', 'WARN', `AUTH_TOKEN found in environment (${authToken.length} chars)`, {
        tokenPreview: authToken.substring(0, 50) + '...',
        isJWTFormat: authToken.split('.').length === 3
      })
    } else {
      this.addResult('AUTH_TOKEN', 'WARN', 'AUTH_TOKEN not set in environment')
    }

    // Test database connectivity
    try {
      await db.connect()
      const user = await AdminService.getAdminByUsername('admin')
      if (user) {
        this.addResult('Database', 'PASS', `Admin user found (ID: ${user.id})`)
      } else {
        this.addResult('Database', 'FAIL', 'Admin user not found')
      }
    } catch (error) {
      this.addResult('Database', 'FAIL', `Database error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  private async testJWTGeneration(): Promise<string | null> {
    console.log('\n🔐 Testing JWT Generation')
    console.log('=' .repeat(50))

    try {
      // Test token generation
      const testUser = { id: 1, username: 'admin' }
      const token = AuthService.generateJWT(testUser)
      
      this.addResult('JWT Generation', 'PASS', 'Token generated successfully', {
        tokenLength: token.length,
        tokenParts: token.split('.').length,
        tokenPreview: token.substring(0, 50) + '...'
      })

      // Test token format validation
      const isValidFormat = AuthService.isValidTokenFormat(token)
      this.addResult('JWT Format', isValidFormat ? 'PASS' : 'FAIL', 
        isValidFormat ? 'Token format is valid' : 'Token format is invalid')

      // Test token verification with same secret
      try {
        const decoded = AuthService.verifyJWT(token)
        this.addResult('JWT Verification', 'PASS', 'Token verified successfully', {
          userId: decoded.userId,
          username: decoded.username,
          iat: decoded.iat,
          exp: decoded.exp,
          expiresAt: new Date(decoded.exp! * 1000).toISOString()
        })
      } catch (error) {
        this.addResult('JWT Verification', 'FAIL', `Token verification failed: ${error instanceof Error ? error.message : 'Unknown'}`)
      }

      // Check if token is expired
      const isExpired = AuthService.isTokenExpired(token)
      this.addResult('JWT Expiry', isExpired ? 'FAIL' : 'PASS', 
        isExpired ? 'Token is expired' : 'Token is valid and not expired')

      return token
    } catch (error) {
      this.addResult('JWT Generation', 'FAIL', `Token generation failed: ${error instanceof Error ? error.message : 'Unknown'}`)
      return null
    }
  }

  private async testAPIAuthentication(token: string): Promise<void> {
    console.log('\n🌐 Testing API Authentication')
    console.log('=' .repeat(50))

    const testEndpoints = [
      { name: 'Post Now', path: '/api/admin/posting/post-now', method: 'GET' },
      { name: 'System Verification', path: '/api/admin/system-verification', method: 'GET' },
      { name: 'Platform Diversity', path: '/api/admin/platform-diversity', method: 'GET' }
    ]

    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(`${this.siteUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.status === 401) {
          this.addResult(`API ${endpoint.name}`, 'FAIL', 'Authentication failed (401 Unauthorized)', {
            endpoint: endpoint.path,
            status: response.status,
            statusText: response.statusText
          })
        } else if (response.ok) {
          this.addResult(`API ${endpoint.name}`, 'PASS', `Authentication successful (${response.status})`)
        } else {
          this.addResult(`API ${endpoint.name}`, 'WARN', `Unexpected response (${response.status})`, {
            status: response.status,
            statusText: response.statusText
          })
        }
      } catch (error) {
        this.addResult(`API ${endpoint.name}`, 'FAIL', `Request failed: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }
  }

  private async testProductionCompatibility(): Promise<void> {
    console.log('\n🚀 Testing Production Compatibility')
    console.log('=' .repeat(50))

    // Load production environment file if it exists
    try {
      const fs = require('fs')
      const prodEnvPath = '/Users/adamshaw/Development/websites/hotdog-diaries/.env.production'
      
      if (fs.existsSync(prodEnvPath)) {
        const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8')
        
        // Extract JWT_SECRET and AUTH_TOKEN from production
        const jwtSecretMatch = prodEnvContent.match(/JWT_SECRET="?([^"\n]+)"?/)
        const authTokenMatch = prodEnvContent.match(/AUTH_TOKEN="?([^"\n]+)"?/)
        
        if (jwtSecretMatch) {
          const prodJwtSecret = jwtSecretMatch[1]
          const localJwtSecret = process.env.JWT_SECRET
          
          if (prodJwtSecret === localJwtSecret) {
            this.addResult('JWT_SECRET Match', 'PASS', 'Production and local JWT_SECRET match')
          } else {
            this.addResult('JWT_SECRET Match', 'FAIL', 'Production and local JWT_SECRET differ', {
              localLength: localJwtSecret?.length,
              prodLength: prodJwtSecret.length,
              localPreview: localJwtSecret?.substring(0, 20) + '...',
              prodPreview: prodJwtSecret.substring(0, 20) + '...'
            })
          }
        }
        
        if (authTokenMatch) {
          const prodAuthToken = authTokenMatch[1]
          
          // Check if production AUTH_TOKEN is a valid JWT
          const isJWT = prodAuthToken.split('.').length === 3
          this.addResult('Production AUTH_TOKEN', isJWT ? 'PASS' : 'FAIL', 
            isJWT ? 'Production AUTH_TOKEN appears to be a valid JWT' : 'Production AUTH_TOKEN is not a valid JWT format', {
            tokenLength: prodAuthToken.length,
            isJWTFormat: isJWT,
            tokenPreview: prodAuthToken.substring(0, 50) + '...'
          })
          
          // If it's not JWT, try to decode as base64
          if (!isJWT) {
            try {
              const decoded = Buffer.from(prodAuthToken, 'base64').toString('utf8')
              let decodedData
              try {
                decodedData = JSON.parse(decoded)
              } catch {
                decodedData = decoded
              }
              
              this.addResult('Production AUTH_TOKEN Decoded', 'WARN', 'Token appears to be base64-encoded data', {
                decodedData
              })
            } catch {
              this.addResult('Production AUTH_TOKEN Decoded', 'FAIL', 'Could not decode production AUTH_TOKEN')
            }
          }
        }
      } else {
        this.addResult('Production Environment', 'WARN', 'Production environment file not found')
      }
    } catch (error) {
      this.addResult('Production Compatibility', 'FAIL', `Error checking production compatibility: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  private generateRecommendations(): void {
    console.log('\n📋 Recommendations')
    console.log('=' .repeat(50))

    const failures = this.results.filter(r => r.status === 'FAIL')
    const warnings = this.results.filter(r => r.status === 'WARN')

    if (failures.length === 0 && warnings.length === 0) {
      console.log('✅ All tests passed! JWT authentication is working correctly.')
      return
    }

    console.log('🔧 Issues found that need attention:')
    console.log('')

    // Check for AUTH_TOKEN vs JWT mismatch
    const authTokenResult = this.results.find(r => r.test === 'Production AUTH_TOKEN')
    if (authTokenResult && authTokenResult.status === 'FAIL') {
      console.log('1. 🚨 CRITICAL: Production AUTH_TOKEN is not a valid JWT')
      console.log('   Fix: Generate a proper JWT token and update Vercel environment:')
      console.log('   ```')
      console.log('   # Generate new token with production JWT_SECRET')
      console.log('   JWT_SECRET=<production-secret> npx tsx scripts/generate-production-jwt.ts')
      console.log('   ')
      console.log('   # Update Vercel environment')
      console.log('   vercel env add AUTH_TOKEN')
      console.log('   ```')
      console.log('')
    }

    // Check for JWT_SECRET mismatch
    const jwtSecretMatch = this.results.find(r => r.test === 'JWT_SECRET Match')
    if (jwtSecretMatch && jwtSecretMatch.status === 'FAIL') {
      console.log('2. 🚨 CRITICAL: JWT_SECRET mismatch between environments')
      console.log('   Fix: Synchronize JWT_SECRET across all environments')
      console.log('   - Use same JWT_SECRET in .env.local and Vercel')
      console.log('   - Regenerate AUTH_TOKEN with correct JWT_SECRET')
      console.log('')
    }

    // Check for API authentication failures
    const apiFailures = failures.filter(r => r.test.startsWith('API '))
    if (apiFailures.length > 0) {
      console.log('3. 🔧 API Authentication Issues:')
      apiFailures.forEach(failure => {
        console.log(`   - ${failure.test}: ${failure.message}`)
      })
      console.log('   Fix: Ensure AUTH_TOKEN environment variable matches the Bearer token being sent')
      console.log('')
    }

    // General recommendations
    console.log('💡 General Recommendations:')
    console.log('   1. Use the same JWT_SECRET across all environments')
    console.log('   2. Generate AUTH_TOKEN as a proper JWT using AuthService.generateJWT()')
    console.log('   3. Update GitHub Actions secrets with the new AUTH_TOKEN')
    console.log('   4. Test authentication after each change')
    console.log('')
    
    console.log('🔧 Quick Fix Command:')
    console.log('   npx tsx scripts/debug-jwt-authentication.ts --fix')
  }

  private printSummary(): void {
    console.log('\n📊 Test Summary')
    console.log('=' .repeat(50))

    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    const warned = this.results.filter(r => r.status === 'WARN').length

    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⚠️  Warnings: ${warned}`)
    console.log(`📋 Total Tests: ${this.results.length}`)

    if (failed === 0) {
      console.log('')
      console.log('🎉 All critical tests passed! JWT authentication is working.')
    } else {
      console.log('')
      console.log('🚨 Critical issues found that need immediate attention.')
    }
  }

  public async run(): Promise<void> {
    console.log('🔍 JWT Authentication Debugger')
    console.log('=' .repeat(60))
    console.log(`Site URL: ${this.siteUrl}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('')

    // Run all tests
    await this.testEnvironmentSetup()
    
    const token = this.testToken || await this.testJWTGeneration()
    if (token) {
      await this.testAPIAuthentication(token)
    }
    
    await this.testProductionCompatibility()
    
    // Generate recommendations
    this.generateRecommendations()
    this.printSummary()

    // Disconnect from database
    try {
      await db.disconnect()
    } catch (error) {
      // Ignore disconnect errors
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('JWT Authentication Debug and Test Script')
    console.log('')
    console.log('Usage:')
    console.log('  JWT_SECRET=<secret> npx tsx scripts/debug-jwt-authentication.ts')
    console.log('  TEST_TOKEN=<token> npx tsx scripts/debug-jwt-authentication.ts')
    console.log('  SITE_URL=<url> JWT_SECRET=<secret> npx tsx scripts/debug-jwt-authentication.ts')
    console.log('')
    console.log('Environment Variables:')
    console.log('  JWT_SECRET    JWT secret key for token generation/verification')
    console.log('  AUTH_TOKEN    Existing auth token to test (optional)')
    console.log('  TEST_TOKEN    Specific token to test (alternative to AUTH_TOKEN)')
    console.log('  SITE_URL      API base URL (default: http://localhost:3003)')
    console.log('  VERBOSE       Show detailed test information')
    console.log('')
    console.log('Examples:')
    console.log('  # Test local development')
    console.log('  JWT_SECRET=local-secret npx tsx scripts/debug-jwt-authentication.ts')
    console.log('')
    console.log('  # Test production configuration')
    console.log('  JWT_SECRET=prod-secret SITE_URL=https://hotdog-diaries.vercel.app npx tsx scripts/debug-jwt-authentication.ts')
    console.log('')
    console.log('  # Test specific token')
    console.log('  TEST_TOKEN=eyJ... npx tsx scripts/debug-jwt-authentication.ts')
    process.exit(0)
  }

  const authDebugger = new JWTAuthenticationDebugger({
    siteUrl: process.env.SITE_URL,
    testToken: process.env.TEST_TOKEN
  })

  try {
    await authDebugger.run()
  } catch (error) {
    console.error('❌ Debugger failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { JWTAuthenticationDebugger }