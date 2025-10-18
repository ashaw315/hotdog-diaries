#!/usr/bin/env npx tsx

/**
 * CI Environment Diagnostic Script
 * 
 * This script performs comprehensive environment variable and database 
 * connection testing for CI/CD environments. It helps debug DATABASE_URL 
 * issues and environment detection problems.
 */

import { db } from '../lib/db'

interface EnvironmentCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: Record<string, any>
}

class CIEnvironmentChecker {
  private checks: EnvironmentCheck[] = []

  private addCheck(name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: Record<string, any>) {
    this.checks.push({ name, status, message, details })
  }

  async runAllChecks(): Promise<void> {
    console.log('🔍 CI Environment Diagnostic Check')
    console.log('==================================')
    console.log()

    // Environment variable checks
    this.checkEnvironmentVariables()
    
    // Database initialization check
    await this.checkDatabaseInitialization()
    
    // Database connection test
    await this.checkDatabaseConnection()
    
    // Generate report
    this.generateReport()
  }

  private checkEnvironmentVariables(): void {
    console.log('📋 Environment Variables Check:')
    
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      VERCEL_ENV: process.env.VERCEL_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_URL_SQLITE: process.env.DATABASE_URL_SQLITE,
      POSTGRES_URL: process.env.POSTGRES_URL,
      JWT_SECRET: process.env.JWT_SECRET
    }

    // Check NODE_ENV
    if (envVars.NODE_ENV) {
      this.addCheck(
        'NODE_ENV',
        'pass',
        `Set to: ${envVars.NODE_ENV}`,
        { value: envVars.NODE_ENV }
      )
    } else {
      this.addCheck('NODE_ENV', 'fail', 'Not set')
    }

    // Check CI detection
    const isCI = !!(envVars.CI || envVars.GITHUB_ACTIONS)
    if (isCI) {
      this.addCheck(
        'CI Detection',
        'pass',
        'CI environment detected',
        {
          CI: envVars.CI,
          GITHUB_ACTIONS: envVars.GITHUB_ACTIONS,
          VERCEL_ENV: envVars.VERCEL_ENV
        }
      )
    } else {
      this.addCheck('CI Detection', 'warning', 'CI environment not detected')
    }

    // Check DATABASE_URL
    if (envVars.DATABASE_URL) {
      const isSupabase = envVars.DATABASE_URL.includes('supabase.co')
      this.addCheck(
        'DATABASE_URL',
        'pass',
        isSupabase ? 'Set (Supabase)' : 'Set (PostgreSQL)',
        {
          type: isSupabase ? 'supabase' : 'postgres',
          length: envVars.DATABASE_URL.length,
          host: this.extractHost(envVars.DATABASE_URL)
        }
      )
    } else {
      this.addCheck('DATABASE_URL', 'warning', 'Not set')
    }

    // Check fallback options
    if (envVars.DATABASE_URL_SQLITE) {
      this.addCheck('DATABASE_URL_SQLITE', 'pass', `Set: ${envVars.DATABASE_URL_SQLITE}`)
    } else {
      this.addCheck('DATABASE_URL_SQLITE', 'warning', 'Not set')
    }

    if (envVars.POSTGRES_URL) {
      this.addCheck('POSTGRES_URL', 'pass', 'Set (fallback available)')
    } else {
      this.addCheck('POSTGRES_URL', 'warning', 'Not set')
    }

    // Check JWT_SECRET
    if (envVars.JWT_SECRET) {
      this.addCheck(
        'JWT_SECRET',
        'pass',
        `Set (${envVars.JWT_SECRET.length} chars)`,
        { length: envVars.JWT_SECRET.length }
      )
    } else {
      this.addCheck('JWT_SECRET', 'fail', 'Not set - required for authentication')
    }

    console.log()
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'invalid-url'
    }
  }

  private async checkDatabaseInitialization(): Promise<void> {
    console.log('🚀 Database Initialization Check:')
    
    try {
      // This will trigger the initializeDatabaseMode logic
      const connectionMode = (db as any).connectionMode
      const isSupabase = (db as any).isSupabase
      const isSqlite = (db as any).isSqlite

      this.addCheck(
        'Database Mode Detection',
        'pass',
        `Initialized as: ${connectionMode}`,
        {
          connectionMode,
          isSupabase,
          isSqlite
        }
      )
    } catch (error) {
      this.addCheck(
        'Database Mode Detection',
        'fail',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.stack : error }
      )
    }

    console.log()
  }

  private async checkDatabaseConnection(): Promise<void> {
    console.log('🔗 Database Connection Test:')
    
    try {
      await db.connect()
      
      const health = await db.healthCheck()
      
      if (health.connected) {
        this.addCheck(
          'Database Connection',
          'pass',
          `Connected successfully (${health.latency}ms)`,
          {
            latency: health.latency,
            poolStats: db.getPoolStats()
          }
        )
      } else {
        this.addCheck(
          'Database Connection',
          'fail',
          `Connection failed: ${health.error}`,
          { error: health.error }
        )
      }
    } catch (error) {
      this.addCheck(
        'Database Connection',
        'fail',
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.stack : error }
      )
    } finally {
      try {
        await db.disconnect()
      } catch {
        // Ignore cleanup errors
      }
    }

    console.log()
  }

  private generateReport(): void {
    console.log('📊 Diagnostic Report:')
    console.log('====================')
    
    const passed = this.checks.filter(c => c.status === 'pass').length
    const failed = this.checks.filter(c => c.status === 'fail').length
    const warnings = this.checks.filter(c => c.status === 'warning').length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⚠️  Warnings: ${warnings}`)
    console.log()

    // Show detailed results
    for (const check of this.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️'
      console.log(`${icon} ${check.name}: ${check.message}`)
      
      if (check.details && Object.keys(check.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, '\n   ')}`)
      }
    }

    console.log()

    // Overall assessment
    if (failed === 0) {
      if (warnings === 0) {
        console.log('🎉 All checks passed! Environment is properly configured.')
      } else {
        console.log('✅ Core checks passed. Review warnings for optimization opportunities.')
      }
    } else {
      console.log('🚨 Critical issues detected. CI builds may fail.')
      
      // Provide specific recommendations
      console.log()
      console.log('🔧 Recommendations:')
      
      const failedChecks = this.checks.filter(c => c.status === 'fail')
      for (const check of failedChecks) {
        console.log(`   • ${check.name}: ${this.getRecommendation(check.name)}`)
      }
    }

    // Exit with appropriate code
    if (failed > 0) {
      process.exit(1)
    }
  }

  private getRecommendation(checkName: string): string {
    const recommendations: Record<string, string> = {
      'NODE_ENV': 'Set NODE_ENV environment variable (development/production/test)',
      'DATABASE_URL': 'Add DATABASE_URL to GitHub repository secrets',
      'JWT_SECRET': 'Generate and add JWT_SECRET to repository secrets (64-char hex string)',
      'Database Connection': 'Verify DATABASE_URL is correct and accessible from CI environment'
    }

    return recommendations[checkName] || 'Review configuration and documentation'
  }
}

// Main execution
async function main() {
  const checker = new CIEnvironmentChecker()
  
  try {
    await checker.runAllChecks()
  } catch (error) {
    console.error('🚨 Diagnostic script failed:', error)
    process.exit(1)
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('ci-env-check')
if (isMainModule) {
  main()
}

export { CIEnvironmentChecker }