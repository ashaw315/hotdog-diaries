#!/usr/bin/env tsx

/**
 * CI Secret Validation Script
 * 
 * Validates token strength and environment variable completeness
 * for CI/CD security gates.
 */

import fs from 'fs/promises'
import path from 'path'
import { TOKEN_CONFIGS } from './rotate-token.ts'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface TokenValidation {
  tokenName: string
  value: string
  isValid: boolean
  errors: string[]
}

interface EnvValidation {
  missingVars: string[]
  orphanedVars: string[]
}

class SecretValidator {
  private projectRoot: string

  constructor() {
    this.projectRoot = process.cwd()
  }

  /**
   * Validate token strength according to security requirements
   */
  validateTokenStrength(tokenName: string, token: string): TokenValidation {
    const errors: string[] = []
    const config = TOKEN_CONFIGS[tokenName]

    if (!config) {
      errors.push(`Unknown token: ${tokenName}`)
      return { tokenName, value: token, isValid: false, errors }
    }

    // Length validation
    if (token.length < 32) {
      errors.push(`Token too short: ${token.length} chars (minimum 32)`)
    }

    // For JWT tokens, be more flexible with length requirements
    if (config.format !== 'jwt' && token.length < config.length) {
      errors.push(`Token shorter than required: ${token.length}/${config.length} chars`)
    }

    // Format validation
    switch (config.format) {
      case 'hex':
        if (!/^[a-fA-F0-9]+$/.test(token)) {
          errors.push('Token must be valid hexadecimal')
        }
        break
      
      case 'base64':
        try {
          Buffer.from(token, 'base64')
        } catch {
          errors.push('Token must be valid base64')
        }
        break
      
      case 'alphanumeric':
        if (!/^[a-zA-Z0-9]+$/.test(token)) {
          errors.push('Token must be alphanumeric')
        }
        break
      
      case 'jwt':
        // JWT tokens have format: header.payload.signature (base64url encoded parts)
        const jwtParts = token.split('.')
        if (jwtParts.length !== 3) {
          errors.push('JWT token must have 3 parts (header.payload.signature)')
        } else {
          // Validate each part is valid base64url
          for (let i = 0; i < 3; i++) {
            const part = jwtParts[i]
            if (!/^[A-Za-z0-9_-]+$/.test(part)) {
              errors.push(`JWT part ${i + 1} contains invalid base64url characters`)
            }
          }
          
          // Try to decode header to verify it's JWT
          try {
            // Convert base64url to base64
            const base64Header = jwtParts[0].replace(/-/g, '+').replace(/_/g, '/') + '=='.substring(0, (4 - jwtParts[0].length % 4) % 4)
            const header = JSON.parse(Buffer.from(base64Header, 'base64').toString())
            if (!header.alg || !header.typ || header.typ !== 'JWT') {
              errors.push('Token header is not valid JWT format')
            }
          } catch {
            errors.push('Token header cannot be decoded as JWT')
          }
        }
        break
    }

    // Pattern validation - detect weak patterns (skip for JWT tokens)
    if (config.format !== 'jwt') {
      const patterns = [
        { regex: /(.)\\1{3,}/, message: 'Contains repeated character patterns' },
        { regex: /012345|123456|abcdef|654321|fedcba/, message: 'Contains sequential patterns' },
        { regex: /password|secret|token|admin|test|demo|example/i, message: 'Contains common words' },
        { regex: /^(00000|11111|22222|33333|44444|55555|66666|77777|88888|99999|aaaaa|bbbbb)/, message: 'Starts with repeated characters' },
        { regex: /qwerty|asdfgh|zxcvbn|admin123|password123/i, message: 'Contains keyboard patterns or common passwords' }
      ]

      for (const pattern of patterns) {
        if (pattern.regex.test(token)) {
          errors.push(pattern.message)
        }
      }
    }

    // Additional entropy checks (skip for JWT tokens)
    if (config.format !== 'jwt' && token.length >= 32) {
      const uniqueChars = new Set(token.toLowerCase()).size
      const expectedMinUniqueChars = Math.min(token.length * 0.6, 16)
      
      if (uniqueChars < expectedMinUniqueChars) {
        errors.push(`Low entropy: only ${uniqueChars} unique characters (expected >= ${Math.floor(expectedMinUniqueChars)})`)
      }
    }

    return {
      tokenName,
      value: token,
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get all environment variables referenced in the codebase
   */
  async getCodebaseEnvVars(): Promise<string[]> {
    const envVars = new Set<string>()
    
    // Patterns to find process.env usage
    const envPatterns = [
      /process\.env\.([A-Z_][A-Z0-9_]*)/g,
      /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g
    ]

    // Files to scan
    const scanPatterns = [
      'app/**/*.{ts,tsx,js,jsx}',
      'lib/**/*.{ts,tsx,js,jsx}',
      'components/**/*.{ts,tsx,js,jsx}',
      'scripts/**/*.{ts,tsx,js,jsx}',
      'middleware.{ts,js}',
      'next.config.{js,mjs}',
      '.github/**/*.{yml,yaml}'
    ]

    try {
      const { glob } = await import('glob')
      
      for (const pattern of scanPatterns) {
        const files = await glob(pattern, { cwd: this.projectRoot })
        
        for (const file of files) {
          try {
            const content = await fs.readFile(path.join(this.projectRoot, file), 'utf8')
            
            for (const envPattern of envPatterns) {
              let match
              while ((match = envPattern.exec(content)) !== null) {
                envVars.add(match[1])
              }
            }
          } catch (error) {
            // Skip files that can't be read
            continue
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not scan codebase for environment variables:', error)
    }

    return Array.from(envVars).sort()
  }

  /**
   * Parse .env.example file to get referenced variables
   */
  async getEnvExampleVars(): Promise<string[]> {
    const envExamplePath = path.join(this.projectRoot, '.env.example')
    
    try {
      const content = await fs.readFile(envExamplePath, 'utf8')
      const vars: string[] = []
      
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/)
          if (match) {
            vars.push(match[1])
          }
        }
      }
      
      return vars.sort()
    } catch (error) {
      return []
    }
  }

  /**
   * Validate environment variable completeness
   */
  async validateEnvCompleteness(): Promise<EnvValidation> {
    const codebaseVars = await this.getCodebaseEnvVars()
    const envExampleVars = await this.getEnvExampleVars()
    
    const codebaseSet = new Set(codebaseVars)
    const envExampleSet = new Set(envExampleVars)
    
    // Find variables used in code but not in .env.example
    const missingVars = codebaseVars.filter(varName => {
      // Skip certain system/framework variables that don't need to be in .env.example
      const skipVars = [
        'NODE_ENV', 'PORT', 'PWD', 'PATH', 'HOME', 'USER',
        'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_REGION',
        'GITHUB_ACTIONS', 'GITHUB_SHA', 'GITHUB_REF',
        'CI', 'BUILD_ID', 'NEXT_RUNTIME'
      ]
      
      return !skipVars.includes(varName) && !envExampleSet.has(varName)
    })
    
    // Find variables in .env.example but not used in code
    const orphanedVars = envExampleVars.filter(varName => !codebaseSet.has(varName))
    
    return { missingVars, orphanedVars }
  }

  /**
   * Validate current environment tokens
   */
  async validateCurrentTokens(): Promise<TokenValidation[]> {
    const results: TokenValidation[] = []
    
    for (const [tokenName, config] of Object.entries(TOKEN_CONFIGS)) {
      const tokenValue = process.env[tokenName]
      
      if (!tokenValue) {
        results.push({
          tokenName,
          value: '',
          isValid: false,
          errors: ['Token not found in environment']
        })
        continue
      }
      
      const validation = this.validateTokenStrength(tokenName, tokenValue)
      results.push(validation)
    }
    
    return results
  }

  /**
   * Run all validations
   */
  async validateAll(): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    
    console.log('🔍 CI Secret Validation')
    console.log('========================')
    console.log('')
    
    // 1. Validate current environment tokens
    console.log('1️⃣ Validating current environment tokens...')
    const tokenValidations = await this.validateCurrentTokens()
    
    for (const validation of tokenValidations) {
      if (!validation.isValid) {
        if (validation.value === '') {
          warnings.push(`${validation.tokenName}: ${validation.errors.join(', ')}`)
        } else {
          errors.push(`${validation.tokenName}: ${validation.errors.join(', ')}`)
        }
      } else {
        console.log(`  ✅ ${validation.tokenName}`)
      }
    }
    
    console.log('')
    
    // 2. Validate environment variable completeness
    console.log('2️⃣ Validating environment variable completeness...')
    const envValidation = await this.validateEnvCompleteness()
    
    if (envValidation.missingVars.length > 0) {
      errors.push(`Missing variables in .env.example: ${envValidation.missingVars.join(', ')}`)
      console.log(`  ❌ Missing in .env.example: ${envValidation.missingVars.join(', ')}`)
    } else {
      console.log('  ✅ All codebase variables present in .env.example')
    }
    
    if (envValidation.orphanedVars.length > 0) {
      warnings.push(`Orphaned variables in .env.example: ${envValidation.orphanedVars.join(', ')}`)
      console.log(`  ⚠️  Orphaned in .env.example: ${envValidation.orphanedVars.join(', ')}`)
    }
    
    console.log('')
    
    // 3. Summary
    const isValid = errors.length === 0
    
    console.log('📊 Summary')
    console.log('==========')
    
    if (isValid) {
      console.log('✅ All validations passed')
    } else {
      console.log(`❌ ${errors.length} error(s) found`)
      errors.forEach(error => console.log(`   • ${error}`))
    }
    
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s)`)
      warnings.forEach(warning => console.log(`   • ${warning}`))
    }
    
    console.log('')
    
    return { isValid, errors, warnings }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2)
  const shouldFailOnWarnings = args.includes('--strict')
  const isVerbose = args.includes('--verbose')
  
  if (args.includes('--help')) {
    console.log(`
🔐 CI Secret Validation Script

Validates token strength and environment variable completeness for CI/CD security gates.

USAGE:
  npm run validate-secrets [options]

OPTIONS:
  --strict     Fail on warnings as well as errors
  --verbose    Show detailed output
  --help       Show this help message

VALIDATION CHECKS:
  • Token strength (length >= 32, valid format, no weak patterns)
  • Environment variable completeness (.env.example vs codebase usage)
  • Pattern detection (sequential chars, common words, low entropy)

EXIT CODES:
  0 - All validations passed
  1 - Validation errors found (weak tokens, missing env vars)
  2 - Warnings found (only with --strict)

EXAMPLES:
  # Basic validation
  npm run validate-secrets

  # Strict mode (fail on warnings)
  npm run validate-secrets --strict

  # Verbose output
  npm run validate-secrets --verbose
`)
    process.exit(0)
  }
  
  const validator = new SecretValidator()
  
  try {
    const result = await validator.validateAll()
    
    if (!result.isValid) {
      console.log('❌ Validation failed - see errors above')
      process.exit(1)
    }
    
    if (shouldFailOnWarnings && result.warnings.length > 0) {
      console.log('❌ Strict mode enabled - warnings treated as errors')
      process.exit(2)
    }
    
    console.log('🎉 Secret validation passed!')
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Validation script failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { SecretValidator }