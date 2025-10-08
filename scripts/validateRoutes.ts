#!/usr/bin/env tsx
/**
 * Route Pattern Validator
 * 
 * Validates that all route patterns in Next.js configuration files
 * follow proper syntax to prevent "Can not repeat 'path' without a prefix and suffix" errors.
 */

import fs from 'fs'
import chalk from 'chalk'

interface RouteIssue {
  file: string
  line: number
  text: string
  reason: string
}

const issues: RouteIssue[] = []

function scanFile(file: string, regexes: { pattern: RegExp, reason: string }[]) {
  if (!fs.existsSync(file)) return
  
  console.log(chalk.blue(`🔍 Scanning ${file}...`))
  
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    regexes.forEach(({ pattern, reason }) => {
      if (pattern.test(line)) {
        issues.push({ 
          file, 
          line: index + 1, 
          text: line.trim(),
          reason
        })
      }
    })
  })
}

console.log(chalk.blue('🛡️ Route Pattern Validation'))
console.log(chalk.blue('=' .repeat(50)))

// Scan next.config.js for invalid route patterns
scanFile('next.config.js', [
  {
    pattern: /source:\s*['"](:path\*|\w+\*|\*[^/]|:.*\*)['"]/,
    reason: 'Invalid pattern: must not use raw :path* or similar patterns'
  },
  {
    pattern: /source:\s*['"]([^/])/,
    reason: 'Invalid pattern: must start with forward slash (/)'
  },
  {
    pattern: /source:\s*['"][^'"]*:path[^'"]*['"]/,
    reason: 'Dangerous pattern: contains :path which can cause repeat() errors'
  }
])

// Scan middleware.ts for invalid matcher patterns
scanFile('middleware.ts', [
  {
    pattern: /matcher:\s*\[[^\]]*['"](:path\*|\w+\*|\*[^/]|:.*\*)['"]/,
    reason: 'Invalid matcher: must not use raw :path* or similar patterns'
  },
  {
    pattern: /matcher:\s*\[[^\]]*['"](?!\/)/,
    reason: 'Invalid matcher: must start with forward slash (/)'
  },
  {
    pattern: /matcher:\s*\[[^\]]*['"][^'"]*:path[^'"]*['"]/,
    reason: 'Dangerous matcher: contains :path which can cause repeat() errors'
  }
])

// Scan vercel.json for invalid src patterns
scanFile('vercel.json', [
  {
    pattern: /"src":\s*":path\*"/,
    reason: 'Invalid src: must not use raw :path* pattern'
  },
  {
    pattern: /"src":\s*"[^/]/,
    reason: 'Invalid src: must start with forward slash (/)'
  },
  {
    pattern: /"src":\s*"[^"]*:path[^"]*"/,
    reason: 'Dangerous src: contains :path which can cause repeat() errors'
  }
])

console.log(chalk.blue('\n' + '=' .repeat(50)))

if (issues.length > 0) {
  console.log(chalk.red.bold('❌ Invalid route patterns detected:'))
  console.log('')
  
  issues.forEach(issue => {
    console.log(chalk.red(`📁 ${issue.file}:${issue.line}`))
    console.log(chalk.yellow(`   ${issue.text}`))
    console.log(chalk.gray(`   → ${issue.reason}`))
    console.log('')
  })
  
  console.log(chalk.yellow('🔧 Recommended fixes:'))
  console.log(chalk.yellow('   • Replace :path* with /:slug* or /(.*) for catch-all routes'))
  console.log(chalk.yellow('   • Ensure all patterns start with forward slash (/)'))
  console.log(chalk.yellow('   • Use specific parameter names instead of generic "path"'))
  console.log('')
  console.log(chalk.red.bold('Exiting with error to prevent build failures...'))
  
  process.exit(1)
} else {
  console.log(chalk.green('✅ All route patterns are valid and safe'))
  console.log(chalk.green('No patterns found that could cause repeat(\'path\') errors'))
}

console.log(chalk.blue('=' .repeat(50)))
console.log(chalk.gray('Route Pattern Validation Complete'))
console.log(chalk.gray(new Date().toISOString()))

process.exit(0)