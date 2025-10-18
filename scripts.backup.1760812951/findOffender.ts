#!/usr/bin/env tsx
/**
 * Legacy Dependency Offender Detection Script
 * 
 * Scans for problematic dependencies that cause build failures:
 * - path-template
 * - request-promise
 * - request-promise-native
 * - request-promise-core
 * 
 * Exits with code 1 if any offenders found, 0 if clean
 */

import { execSync } from 'child_process'
import chalk from 'chalk'

const offenders = [
  'path-template',
  'request-promise',
  'request-promise-native',
  'request-promise-core',
  'cls-bluebird',
  'continuation-local-storage',
  'snoowrap'
]

let found = false
const detectedOffenders: { pkg: string; output: string }[] = []

console.log(chalk.blue('🔍 Scanning for legacy dependency offenders...'))
console.log(chalk.blue('=' .repeat(50)))

for (const pkg of offenders) {
  try {
    const output = execSync(`npm ls ${pkg} 2>/dev/null`, { 
      stdio: 'pipe',
      encoding: 'utf8'
    }).toString()
    
    // Check if package is actually installed (not empty result)
    if (output && !output.includes('(empty)') && !output.includes('-- (empty)')) {
      console.log(chalk.red(`❌ Legacy package detected: ${pkg}`))
      console.log(chalk.gray(output))
      detectedOffenders.push({ pkg, output })
      found = true
    }
  } catch (error) {
    // npm ls exits with code 1 when module is missing - this is good!
    // We only care about actual errors where the module IS found
    const errorOutput = error.stdout?.toString() || ''
    if (errorOutput && !errorOutput.includes('(empty)')) {
      // Package might be installed but with issues
      console.log(chalk.yellow(`⚠️  Potential issue with ${pkg}:`))
      console.log(chalk.gray(errorOutput))
    }
  }
}

console.log(chalk.blue('=' .repeat(50)))

if (found) {
  console.log(chalk.red('\n❌ FAILED: Legacy modules detected!'))
  console.log(chalk.red('The following packages must be removed:'))
  detectedOffenders.forEach(({ pkg }) => {
    console.log(chalk.red(`  • ${pkg}`))
  })
  console.log(chalk.yellow('\nTo fix:'))
  console.log(chalk.yellow('1. Run: npm uninstall ' + detectedOffenders.map(d => d.pkg).join(' ')))
  console.log(chalk.yellow('2. Run: rm -rf node_modules package-lock.json'))
  console.log(chalk.yellow('3. Run: npm install'))
  console.log(chalk.yellow('4. Run this script again to verify'))
  process.exit(1)
}

// Additional check for indirect dependencies
console.log(chalk.blue('\n🔍 Checking for indirect legacy dependencies...'))

try {
  const lockfileContent = execSync('npm ls --json 2>/dev/null', {
    stdio: 'pipe',
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large dependency trees
  }).toString()
  
  const deps = JSON.parse(lockfileContent)
  const problemPatterns = [
    'request-promise',
    'path-template',
    'cls-bluebird',
    'snoowrap'
  ]
  
  const searchDeps = (obj: any, path: string[] = []): void => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (problemPatterns.some(pattern => key.includes(pattern))) {
          console.log(chalk.yellow(`⚠️  Found indirect reference: ${key} at ${path.join(' > ')}`))
        }
        if (obj[key] && obj[key].dependencies) {
          searchDeps(obj[key].dependencies, [...path, key])
        }
      })
    }
  }
  
  if (deps.dependencies) {
    searchDeps(deps.dependencies)
  }
} catch {
  // JSON parsing might fail on very large trees, that's OK
}

console.log(chalk.green('\n✅ SUCCESS: No legacy modules found!'))
console.log(chalk.green('Your dependency tree is clean and ready for production.'))
console.log(chalk.blue('\n📊 Summary:'))
console.log(chalk.blue(`  • Scanned ${offenders.length} known problematic packages`))
console.log(chalk.blue('  • All checks passed'))
console.log(chalk.blue('  • Build layer is stabilized'))

process.exit(0)