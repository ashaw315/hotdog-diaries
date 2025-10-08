#!/usr/bin/env tsx
/**
 * Build Stabilization Validation Script
 * 
 * Validates that the build layer stabilization is complete and working
 */

import { execSync } from 'child_process'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

interface ValidationResult {
  test: string
  command: string
  expected: string
  actual: string
  passed: boolean
}

const validationResults: ValidationResult[] = []

function runValidation(test: string, command: string, expected: string, validator: (output: string, error?: any) => boolean) {
  console.log(chalk.blue(`\n🧪 ${test}`))
  console.log(chalk.gray(`   Command: ${command}`))
  
  let output = ''
  let error = null
  let passed = false
  
  try {
    output = execSync(command, { encoding: 'utf8', stdio: 'pipe' }).toString()
    passed = validator(output, null)
  } catch (err) {
    error = err
    output = err.stdout?.toString() || err.stderr?.toString() || ''
    // For npm ls commands, exit code 1 with (empty) output is actually success
    passed = validator(output, err)
  }
  
  validationResults.push({
    test,
    command,
    expected,
    actual: passed ? '✅ Passed' : '❌ Failed',
    passed
  })
  
  if (passed) {
    console.log(chalk.green(`   ✅ ${expected}`))
  } else {
    console.log(chalk.red(`   ❌ Failed: ${expected}`))
    if (output) {
      console.log(chalk.gray(`   Output: ${output.substring(0, 100)}...`))
    }
  }
}

console.log(chalk.blue('=' .repeat(60)))
console.log(chalk.blue.bold('🧱 Build Layer Stabilization Validation'))
console.log(chalk.blue('=' .repeat(60)))

// 1. Check for legacy dependencies
runValidation(
  'Dependency scan - path-template',
  'npm ls path-template 2>&1',
  'empty (not found)',
  (output, error) => output.includes('(empty)') || (error && error.code === 1 && output.includes('(empty)'))
)

runValidation(
  'Dependency scan - request-promise',
  'npm ls request-promise 2>&1',
  'empty (not found)',
  (output, error) => output.includes('(empty)') || (error && error.code === 1 && output.includes('(empty)'))
)

runValidation(
  'Dependency scan - snoowrap',
  'npm ls snoowrap 2>&1',
  'empty (not found)',
  (output, error) => output.includes('(empty)') || (error && error.code === 1 && output.includes('(empty)'))
)

// 2. Verify offender script works
runValidation(
  'Offender detection script',
  'npx tsx scripts/findOffender.ts',
  'No legacy modules found',
  (output) => output.includes('No legacy modules found')
)

// 3. Check webpack config has aliases
runValidation(
  'Webpack aliases configured',
  'grep "path-template.: false" next.config.js',
  'Alias blocks configured',
  (output) => output.includes('path-template')
)

// 4. Check vercel.json has clean build command
runValidation(
  'Vercel clean build configured',
  'grep "rm -rf node_modules" vercel.json',
  'Clean build command present',
  (output) => output.includes('rm -rf node_modules')
)

// 5. Check CI has audit step
runValidation(
  'CI pre-build audit configured',
  'grep "findOffender" .github/workflows/ci.yml',
  'Audit step present',
  (output) => output.includes('findOffender')
)

// 6. Verify security audit passes
runValidation(
  'Security audit',
  'npm audit --json',
  '0 vulnerabilities',
  (output) => {
    const audit = JSON.parse(output)
    return audit.metadata.vulnerabilities.total === 0
  }
)

// 7. Test local build
console.log(chalk.blue('\n🏗️  Testing local build (this may take a minute)...'))
runValidation(
  'Local build test',
  'CI=true NODE_ENV=test npm run build --silent 2>&1 | grep "Compiled successfully"',
  '✅ Build completes',
  (output) => output.includes('Compiled successfully')
)

// Summary
console.log(chalk.blue('\n' + '=' .repeat(60)))
console.log(chalk.blue.bold('📋 Validation Summary'))
console.log(chalk.blue('=' .repeat(60)))

const totalTests = validationResults.length
const passedTests = validationResults.filter(r => r.passed).length
const failedTests = totalTests - passedTests

console.log('\n📊 Results:')
console.log(`   Total tests: ${totalTests}`)
console.log(`   ${chalk.green(`Passed: ${passedTests}`)}`)
console.log(`   ${failedTests > 0 ? chalk.red(`Failed: ${failedTests}`) : chalk.gray(`Failed: ${failedTests}`)}`)

if (failedTests === 0) {
  console.log(chalk.green.bold('\n✅ SUCCESS: Build layer is fully stabilized!'))
  console.log(chalk.green('All validation checks passed.'))
  console.log(chalk.blue('\n🚀 Next Steps:'))
  console.log(chalk.blue('   1. Commit changes: git add . && git commit -m "chore: Phase 4.4 – final build stabilization"'))
  console.log(chalk.blue('   2. Push to main: git push origin main'))
  console.log(chalk.blue('   3. Monitor Vercel deployment'))
  console.log(chalk.blue('   4. Verify CI pipeline passes'))
} else {
  console.log(chalk.red.bold('\n❌ VALIDATION FAILED'))
  console.log(chalk.red('Some checks did not pass. Review the failed tests above.'))
  console.log(chalk.yellow('\nFailed tests:'))
  validationResults.filter(r => !r.passed).forEach(r => {
    console.log(chalk.yellow(`   • ${r.test}: ${r.actual}`))
  })
}

console.log(chalk.blue('\n' + '=' .repeat(60)))
console.log(chalk.gray('Build Stabilization Validation Complete'))
console.log(chalk.gray(new Date().toISOString()))
console.log(chalk.blue('=' .repeat(60)))

process.exit(failedTests > 0 ? 1 : 0)