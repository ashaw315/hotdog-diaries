#!/usr/bin/env tsx

/**
 * Environment Setup Verification Script
 * 
 * This script verifies that:
 * 1. No hardcoded secrets remain in the codebase
 * 2. Environment variables are properly loaded
 * 3. The application can start with only .env.local
 */

import { env, ENV, isServiceConfigured, getDatabaseConfig } from '../lib/env'
import { db } from '../lib/db'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

console.log('🔍 Verifying Environment Setup...\n')

async function verifyEnvironment() {
  let errors = 0
  let warnings = 0
  
  // ========================================
  // 1. Check for hardcoded secrets
  // ========================================
  console.log('1️⃣  Checking for hardcoded secrets...')
  
  const secretPatterns = [
    { pattern: /AIzaSy[A-Za-z0-9_-]{33}/, name: 'YouTube API Key' },
    { pattern: /sk-[A-Za-z0-9]{40,}/, name: 'OpenAI API Key' },
    { pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, name: 'JWT Token' },
    { pattern: /[a-f0-9]{64}/, name: 'Hex Secret (64 chars)', skipFiles: ['lib/env.ts', '.env.example'] },
  ]
  
  const filesToCheck = [
    'lib/services/*.ts',
    'scripts/*.ts',
    'scripts/dev/*.ts',
    'app/api/**/*.ts',
  ]
  
  for (const globPattern of filesToCheck) {
    try {
      const files = execSync(`find . -path "./node_modules" -prune -o -path "./.git" -prune -o -name "*.ts" -o -name "*.js" | grep -E "${globPattern.replace('**', '.*').replace('*', '[^/]*')}"`, { encoding: 'utf-8' })
        .split('\n')
        .filter(Boolean)
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        
        for (const { pattern, name, skipFiles } of secretPatterns) {
          if (skipFiles?.some(skip => file.includes(skip))) continue
          
          const matches = content.match(pattern)
          if (matches && !content.includes('your-') && !content.includes('test-')) {
            console.error(`   ❌ Found potential ${name} in ${file}`)
            errors++
          }
        }
      }
    } catch (e) {
      // Ignore find/grep errors
    }
  }
  
  if (errors === 0) {
    console.log('   ✅ No hardcoded secrets found')
  }
  
  // ========================================
  // 2. Verify environment variables
  // ========================================
  console.log('\n2️⃣  Verifying environment variables...')
  
  try {
    // This will validate and throw if missing required vars
    const validatedEnv = env.validate(false)
    
    console.log('   ✅ Required environment variables are present')
    
    // Check which services are configured
    const services = ['reddit', 'youtube', 'giphy', 'pixabay', 'imgur', 'tumblr', 'bluesky'] as const
    const configuredServices = services.filter(s => isServiceConfigured(s))
    
    if (configuredServices.length === 0) {
      console.warn('   ⚠️  WARNING: No social media services configured')
      warnings++
    } else {
      console.log(`   📦 Configured services: ${configuredServices.join(', ')}`)
    }
    
    // Check database configuration
    const dbConfig = getDatabaseConfig()
    console.log(`   🗄️  Database: ${dbConfig.type}`)
    
    // Check JWT secret strength
    if (ENV.JWT_SECRET.length < 64) {
      console.error('   ❌ JWT_SECRET is too short (minimum 64 characters)')
      errors++
    } else if (ENV.JWT_SECRET.includes('test') || ENV.JWT_SECRET.includes('demo')) {
      console.warn('   ⚠️  WARNING: JWT_SECRET appears to be a test value')
      warnings++
    }
    
    // Check admin password strength
    if (ENV.ADMIN_PASSWORD.length < 12) {
      console.warn('   ⚠️  WARNING: ADMIN_PASSWORD should be at least 12 characters')
      warnings++
    }
    
  } catch (error) {
    console.error('   ❌ Environment validation failed')
    if (error instanceof Error) {
      console.error(`      ${error.message}`)
    }
    errors++
  }
  
  // ========================================
  // 3. Test database connection
  // ========================================
  console.log('\n3️⃣  Testing database connection...')
  
  try {
    await db.connect()
    const healthCheck = await db.healthCheck()
    
    if (healthCheck.connected) {
      console.log(`   ✅ Database connected (latency: ${healthCheck.latency}ms)`)
    } else {
      console.error('   ❌ Database connection failed:', healthCheck.error)
      errors++
    }
  } catch (error) {
    console.error('   ❌ Database connection error:', error)
    errors++
  } finally {
    await db.disconnect()
  }
  
  // ========================================
  // 4. Check .env files
  // ========================================
  console.log('\n4️⃣  Checking environment files...')
  
  const envFiles = {
    '.env.example': 'Template file',
    '.env.local': 'Local development',
    '.env': 'Fallback',
  }
  
  for (const [file, description] of Object.entries(envFiles)) {
    const filePath = path.resolve(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      console.log(`   ✅ ${file} exists (${description}, ${stats.size} bytes)`)
      
      // Check if .env.local has real values
      if (file === '.env.local') {
        const content = fs.readFileSync(filePath, 'utf-8')
        if (content.includes('your-') || content.includes('test-')) {
          console.warn(`   ⚠️  WARNING: ${file} contains placeholder values`)
          warnings++
        }
      }
    } else if (file === '.env.local') {
      console.error(`   ❌ ${file} is missing (required for local development)`)
      errors++
    } else {
      console.log(`   ℹ️  ${file} not found (${description})`)
    }
  }
  
  // ========================================
  // 5. Check for sensitive files in git
  // ========================================
  console.log('\n5️⃣  Checking git for sensitive files...')
  
  try {
    const gitFiles = execSync('git ls-files', { encoding: 'utf-8' }).split('\n')
    const sensitiveFiles = ['.env.local', '.env.production', 'cookies.txt']
    
    let gitIssues = false
    for (const sensitive of sensitiveFiles) {
      if (gitFiles.includes(sensitive)) {
        console.error(`   ❌ Sensitive file "${sensitive}" is tracked by git`)
        errors++
        gitIssues = true
      }
    }
    
    if (!gitIssues) {
      console.log('   ✅ No sensitive files tracked by git')
    }
  } catch (e) {
    console.log('   ℹ️  Not a git repository or git not available')
  }
  
  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(50))
  console.log('📊 VERIFICATION SUMMARY')
  console.log('='.repeat(50))
  
  if (errors === 0 && warnings === 0) {
    console.log('\n✅ All checks passed! Environment is properly configured.')
    console.log('\n🚀 The application is ready to run with:')
    console.log('   npm run dev      # Development mode')
    console.log('   npm run build    # Production build')
    console.log('   npm start        # Production server')
  } else {
    if (errors > 0) {
      console.error(`\n❌ Found ${errors} error(s) that must be fixed`)
    }
    if (warnings > 0) {
      console.warn(`\n⚠️  Found ${warnings} warning(s) to review`)
    }
    
    console.log('\n📝 Next steps:')
    if (errors > 0) {
      console.log('   1. Fix all errors listed above')
      console.log('   2. Copy .env.example to .env.local')
      console.log('   3. Fill in all required values')
      console.log('   4. Run this script again to verify')
    } else {
      console.log('   1. Review warnings above')
      console.log('   2. Consider updating configuration for production use')
    }
    
    process.exit(errors > 0 ? 1 : 0)
  }
}

// Run verification
verifyEnvironment().catch(error => {
  console.error('\n❌ Verification script failed:', error)
  process.exit(1)
})