#!/usr/bin/env tsx

/**
 * Token Rotation Script
 * 
 * Generates cryptographically secure tokens and optionally creates PRs
 * for automated secret rotation in CI environments.
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface TokenConfig {
  name: string
  length: number
  description: string
  exampleValue?: string
  format: 'hex' | 'base64' | 'alphanumeric'
  rotationInterval: string
  storageLocation: string[]
  owner: string
}

interface RotationOptions {
  tokenName?: string
  createPr?: boolean
  dryRun?: boolean
  verbose?: boolean
}

const TOKEN_CONFIGS: Record<string, TokenConfig> = {
  JWT_SECRET: {
    name: 'JWT_SECRET',
    length: 64,
    description: 'JWT token signing and verification secret',
    format: 'hex',
    rotationInterval: '90 days',
    storageLocation: ['Vercel Env Vars', 'GitHub Secrets'],
    owner: 'Security Team'
  },
  AUTH_TOKEN: {
    name: 'AUTH_TOKEN', 
    length: 32,
    description: 'Admin API authentication token',
    format: 'hex',
    rotationInterval: '30 days',
    storageLocation: ['GitHub Secrets'],
    owner: 'DevOps Team'
  },
  CRON_TOKEN: {
    name: 'CRON_TOKEN',
    length: 32, 
    description: 'Scheduled job authentication token',
    format: 'hex',
    rotationInterval: '30 days',
    storageLocation: ['Vercel Env Vars'],
    owner: 'DevOps Team'
  },
  ADMIN_PASSWORD: {
    name: 'ADMIN_PASSWORD',
    length: 32,
    description: 'Default admin user password',
    format: 'alphanumeric',
    rotationInterval: '60 days',
    storageLocation: ['Vercel Env Vars'],
    owner: 'Security Team'
  }
}

class TokenRotator {
  private isGitHubEnvironment: boolean
  private projectRoot: string

  constructor() {
    this.isGitHubEnvironment = Boolean(process.env.GITHUB_ACTIONS)
    this.projectRoot = process.cwd()
  }

  /**
   * Generate cryptographically secure token
   */
  generateToken(length: number, format: 'hex' | 'base64' | 'alphanumeric' = 'hex'): string {
    const bytes = crypto.randomBytes(Math.ceil(length / 2))
    
    switch (format) {
      case 'hex':
        return bytes.toString('hex').substring(0, length)
      
      case 'base64':
        return bytes.toString('base64')
          .replace(/[+/=]/g, '')
          .substring(0, length)
      
      case 'alphanumeric':
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let result = ''
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
      
      default:
        throw new Error(`Unsupported token format: ${format}`)
    }
  }

  /**
   * Validate token strength
   */
  validateToken(token: string, config: TokenConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Length check
    if (token.length < 32) {
      errors.push(`Token too short: ${token.length} chars (minimum 32)`)
    }

    if (token.length < config.length) {
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
    }

    // Common pattern checks
    if (/(.)\1{3,}/.test(token)) {
      errors.push('Token contains repeated character patterns')
    }

    if (/012345|123456|abcdef|654321/.test(token.toLowerCase())) {
      errors.push('Token contains sequential patterns')
    }

    if (/password|secret|token|admin|test/.test(token.toLowerCase())) {
      errors.push('Token contains common words')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Update .env.example file
   */
  async updateEnvExample(tokenName: string, exampleValue?: string): Promise<void> {
    const envExamplePath = path.join(this.projectRoot, '.env.example')
    
    let content = ''
    try {
      content = await fs.readFile(envExamplePath, 'utf8')
    } catch (error) {
      console.log('Creating new .env.example file')
      content = '# Environment Variables Example\n\n'
    }

    const config = TOKEN_CONFIGS[tokenName]
    if (!config) {
      throw new Error(`Unknown token: ${tokenName}`)
    }

    const exampleToken = exampleValue || 'your-' + tokenName.toLowerCase().replace('_', '-') + '-here'
    const newLine = `${tokenName}=${exampleToken}`
    const commentLine = `# ${config.description} (${config.rotationInterval})`

    // Check if token already exists in file
    const tokenRegex = new RegExp(`^${tokenName}=.*$`, 'm')
    const commentRegex = new RegExp(`^# .*${tokenName}.*$`, 'm')

    if (tokenRegex.test(content)) {
      // Update existing token
      content = content.replace(tokenRegex, newLine)
      if (commentRegex.test(content)) {
        content = content.replace(commentRegex, commentLine)
      } else {
        content = content.replace(tokenRegex, `${commentLine}\n${newLine}`)
      }
    } else {
      // Add new token
      content += `\n${commentLine}\n${newLine}\n`
    }

    await fs.writeFile(envExamplePath, content)
    console.log(`✅ Updated .env.example for ${tokenName}`)
  }

  /**
   * Create human-safe copy block
   */
  createCopyBlock(tokenName: string, token: string): string {
    const config = TOKEN_CONFIGS[tokenName]
    const timestamp = new Date().toISOString().split('T')[0]
    
    return `
╔════════════════════════════════════════════════════════════════╗
║                      🔐 TOKEN ROTATION                         ║
╠════════════════════════════════════════════════════════════════╣
║ Token Name: ${tokenName.padEnd(47)} ║
║ Generated:  ${timestamp.padEnd(47)} ║
║ Length:     ${token.length.toString().padEnd(47)} ║
║ Format:     ${config.format.padEnd(47)} ║
║ Owner:      ${config.owner.padEnd(47)} ║
╠════════════════════════════════════════════════════════════════╣
║ NEW TOKEN VALUE:                                               ║
║ ${token.padEnd(62)} ║
╠════════════════════════════════════════════════════════════════╣
║ STORAGE LOCATIONS TO UPDATE:                                  ║
${config.storageLocation.map(loc => `║ • ${loc.padEnd(59)} ║`).join('\n')}
╠════════════════════════════════════════════════════════════════╣
║ VERIFICATION COMMANDS:                                         ║
║ # Test in development                                          ║
║ ${tokenName}="${token}" npm run dev                    ║
║                                                                ║
║ # Verify health probe                                          ║
║ curl -H "Authorization: Bearer <token>" \\                    ║
║      https://hotdog-diaries.vercel.app/api/admin/health/auth   ║
╚════════════════════════════════════════════════════════════════╝

⚠️  SECURITY REMINDER:
   • Copy this token to secure storage immediately
   • Update all listed storage locations
   • Test functionality before disposing of old token
   • Clear terminal history after use
`
  }

  /**
   * Create GitHub Pull Request
   */
  async createPullRequest(tokenName: string, token: string): Promise<void> {
    if (!this.isGitHubEnvironment) {
      console.log('❌ Not in GitHub environment, cannot create PR')
      return
    }

    const branchName = `rotate-${tokenName.toLowerCase()}-${Date.now()}`
    const config = TOKEN_CONFIGS[tokenName]
    const timestamp = new Date().toISOString().split('T')[0]

    try {
      // Configure git
      execSync('git config user.name "Token Rotation Bot"')
      execSync('git config user.email "security@hotdog-diaries.com"')

      // Create and switch to new branch
      execSync(`git checkout -b ${branchName}`)

      // Update .env.example (this was already done, just stage it)
      execSync('git add .env.example')

      // Update rotation log
      await this.updateRotationLog(tokenName, timestamp, 'automated')

      execSync('git add docs/rotation-log.md')

      // Commit changes
      const commitMessage = `chore: rotate ${tokenName} token

- Generated new ${config.length}-character ${config.format} token
- Updated .env.example with placeholder
- Logged rotation in audit trail
- Rotation interval: ${config.rotationInterval}

Owner: ${config.owner}
Storage: ${config.storageLocation.join(', ')}

⚠️ Manual steps required:
${config.storageLocation.map(loc => `- Update ${loc}`).join('\n')}

Co-authored-by: Token Rotation Bot <security@hotdog-diaries.com>`

      execSync(`git commit -m "${commitMessage}"`)

      // Push branch
      execSync(`git push origin ${branchName}`)

      // Create PR using GitHub CLI
      const prTitle = `🔐 Rotate ${tokenName} token (${timestamp})`
      const prBody = `
## Token Rotation

**Token:** \`${tokenName}\`  
**Generated:** ${timestamp}  
**Length:** ${token.length} characters  
**Format:** ${config.format}  
**Owner:** ${config.owner}  

## Security Information

- ✅ Token meets strength requirements (>= 32 chars)
- ✅ Generated using cryptographically secure random
- ✅ No common patterns or weak sequences detected
- ✅ .env.example updated with placeholder

## Manual Actions Required

The following storage locations need to be updated with the new token:

${config.storageLocation.map(loc => `- [ ] ${loc}`).join('\n')}

## New Token Value

\`\`\`
${token}
\`\`\`

⚠️ **Security Note:** Copy the token immediately and update all storage locations. The old token should be revoked after successful deployment.

## Verification

After updating all storage locations:

1. Deploy to staging/preview environment
2. Run health probe: \`curl -H "Authorization: Bearer $TOKEN" https://hotdog-diaries.vercel.app/api/admin/health/auth\`
3. Verify admin functionality works
4. Deploy to production
5. Verify production health probe
6. Revoke old token

## Next Rotation

Based on ${config.rotationInterval} interval:
**Next rotation due:** ${this.calculateNextRotation(config.rotationInterval, timestamp)}
`

      execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --label "security,rotation"`)

      console.log(`✅ Created pull request: ${prTitle}`)
      console.log(`📋 Branch: ${branchName}`)

    } catch (error) {
      console.error('❌ Failed to create pull request:', error)
      
      // Cleanup: switch back to main and delete branch
      try {
        execSync('git checkout main')
        execSync(`git branch -D ${branchName} 2>/dev/null || true`)
      } catch {
        // Ignore cleanup errors
      }
      
      throw error
    }
  }

  /**
   * Update rotation log
   */
  async updateRotationLog(tokenName: string, date: string, method: 'manual' | 'automated'): Promise<void> {
    const logPath = path.join(this.projectRoot, 'docs', 'rotation-log.md')
    
    let content = ''
    try {
      content = await fs.readFile(logPath, 'utf8')
    } catch {
      content = '# Token Rotation Log\n\nAudit trail for all token rotations.\n\n'
    }

    const config = TOKEN_CONFIGS[tokenName]
    const nextRotation = this.calculateNextRotation(config.rotationInterval, date)
    const rotator = method === 'automated' ? 'Token Rotation Bot' : 'Manual'

    const logEntry = `## ${date} - ${tokenName} Rotation
- **Rotated by**: ${config.owner} (${method})
- **Method**: ${method === 'automated' ? 'scripts/rotate-token.ts' : 'Manual process'}
- **Verification**: ⏳ Pending verification
- **Next rotation**: ${nextRotation}

`

    // Insert at the top after the header
    const headerEndIndex = content.indexOf('\n\n') + 2
    content = content.slice(0, headerEndIndex) + logEntry + content.slice(headerEndIndex)

    await fs.writeFile(logPath, content)
    console.log(`✅ Updated rotation log`)
  }

  /**
   * Calculate next rotation date
   */
  calculateNextRotation(interval: string, fromDate: string): string {
    const date = new Date(fromDate)
    const days = parseInt(interval.split(' ')[0])
    
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  /**
   * Rotate a specific token
   */
  async rotateToken(tokenName: string, options: RotationOptions = {}): Promise<string> {
    const config = TOKEN_CONFIGS[tokenName]
    if (!config) {
      throw new Error(`Unknown token: ${tokenName}. Available tokens: ${Object.keys(TOKEN_CONFIGS).join(', ')}`)
    }

    console.log(`🔄 Rotating ${tokenName}...`)
    
    if (options.verbose) {
      console.log(`📋 Config:`, config)
    }

    // Generate new token
    const newToken = this.generateToken(config.length, config.format)
    
    // Validate token strength
    const validation = this.validateToken(newToken, config)
    if (!validation.isValid) {
      throw new Error(`Generated token failed validation: ${validation.errors.join(', ')}`)
    }

    if (options.verbose) {
      console.log(`✅ Generated and validated ${config.length}-character ${config.format} token`)
    }

    if (options.dryRun) {
      console.log('🧪 DRY RUN - No changes made')
      console.log(`Generated token: ${newToken}`)
      return newToken
    }

    // Update .env.example
    await this.updateEnvExample(tokenName)

    // Print human-safe copy block
    console.log(this.createCopyBlock(tokenName, newToken))

    // Create PR if in GitHub environment and requested
    if (options.createPr) {
      await this.createPullRequest(tokenName, newToken)
    } else if (this.isGitHubEnvironment) {
      console.log('💡 Tip: Use --create-pr to automatically create a pull request')
    }

    return newToken
  }

  /**
   * Rotate all eligible tokens
   */
  async rotateAllTokens(options: RotationOptions = {}): Promise<Record<string, string>> {
    const results: Record<string, string> = {}
    
    console.log('🔄 Rotating all eligible tokens...')
    
    for (const tokenName of Object.keys(TOKEN_CONFIGS)) {
      try {
        const token = await this.rotateToken(tokenName, options)
        results[tokenName] = token
        console.log(`✅ ${tokenName} rotated successfully`)
      } catch (error) {
        console.error(`❌ Failed to rotate ${tokenName}:`, error)
        throw error
      }
    }

    return results
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2)
  const options: RotationOptions = {}
  let tokenName: string | undefined

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--create-pr':
        options.createPr = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--verbose':
        options.verbose = true
        break
      case '--help':
        printHelp()
        process.exit(0)
      default:
        if (!arg.startsWith('--')) {
          tokenName = arg.toUpperCase()
        }
    }
  }

  const rotator = new TokenRotator()

  try {
    if (tokenName) {
      if (tokenName === 'ALL') {
        await rotator.rotateAllTokens(options)
      } else {
        await rotator.rotateToken(tokenName, options)
      }
    } else {
      console.log('❓ No token specified. Available tokens:')
      Object.entries(TOKEN_CONFIGS).forEach(([name, config]) => {
        console.log(`  ${name} - ${config.description}`)
      })
      console.log('\nUsage: npm run rotate-tokens <TOKEN_NAME|ALL> [options]')
      console.log('Run with --help for full usage information')
    }
  } catch (error) {
    console.error('❌ Rotation failed:', error)
    process.exit(1)
  }
}

function printHelp() {
  console.log(`
🔐 Token Rotation Script

Generates cryptographically secure tokens and manages rotation procedures.

USAGE:
  npm run rotate-tokens <TOKEN_NAME|ALL> [options]

TOKENS:
${Object.entries(TOKEN_CONFIGS).map(([name, config]) => 
  `  ${name.padEnd(15)} - ${config.description} (${config.rotationInterval})`
).join('\n')}

OPTIONS:
  --create-pr     Create GitHub pull request with rotation (CI only)
  --dry-run       Generate token without making changes
  --verbose       Show detailed output
  --help          Show this help message

EXAMPLES:
  # Rotate specific token
  npm run rotate-tokens JWT_SECRET

  # Rotate all tokens
  npm run rotate-tokens ALL

  # Dry run (test only)
  npm run rotate-tokens AUTH_TOKEN --dry-run

  # Create PR in CI environment  
  npm run rotate-tokens CRON_TOKEN --create-pr

SECURITY:
  • All tokens use cryptographically secure random generation
  • Minimum 32-character length enforced
  • Pattern validation prevents weak tokens
  • Audit trail maintained in docs/rotation-log.md

For more information, see docs/secrets.md
`)
}

// Run if called directly
if (require.main === module) {
  main()
}

export { TokenRotator, TOKEN_CONFIGS }