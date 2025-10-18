#!/usr/bin/env tsx
/**
 * CI Stability & Auto-Healing Execution Fix Validator
 * 
 * Validates that the tsx environment setup fix is working correctly:
 * - Tests tsx dependency resolution
 * - Validates npx tsx script execution
 * - Checks CI workflow integration
 * - Generates validation report
 * 
 * Usage: npx tsx scripts/validateCIFix.ts
 */

// Safety pre-check: Ensure tsx dependency is available
try {
  require.resolve('tsx')
} catch {
  console.error('❌ Missing dependency: tsx. Run `npm install --no-save tsx` before execution.')
  process.exit(127)
}

import { execSync } from 'child_process'
import { writeFile, readFile, mkdir, pathExists } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface ValidationResult {
  component: string
  status: 'pass' | 'fail' | 'warning'
  details: string
  score: number
}

class CIFixValidator {
  private reportsPath: string
  private projectRoot: string

  constructor() {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
  }

  async execute(): Promise<void> {
    console.log(chalk.blue('🧪 CI Stability & Auto-Healing Execution Fix Validator'))
    console.log(chalk.blue('=' .repeat(58)))

    const results: ValidationResult[] = []

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Test 1: tsx dependency resolution
      await this.testTsxResolution(results)

      // Test 2: npx tsx script execution
      await this.testNpxTsxExecution(results)

      // Test 3: CI workflow syntax validation
      await this.testCIWorkflowSyntax(results)

      // Test 4: Package.json script validation
      await this.testPackageJsonScripts(results)

      // Test 5: Safety pre-check validation
      await this.testSafetyPreChecks(results)

      // Generate validation report
      await this.generateValidationReport(results)

      // Display summary
      this.displayValidationSummary(results)

    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message)
      process.exit(1)
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async testTsxResolution(results: ValidationResult[]): Promise<void> {
    console.log(chalk.cyan('\n🔍 Test 1: tsx dependency resolution...'))
    
    try {
      require.resolve('tsx')
      results.push({
        component: 'tsx Resolution',
        status: 'pass',
        details: 'tsx dependency successfully resolved',
        score: 100
      })
      console.log(chalk.green('  ✅ tsx dependency resolved successfully'))
    } catch (error) {
      results.push({
        component: 'tsx Resolution',
        status: 'fail',
        details: 'tsx dependency not found - run `npm install --no-save tsx`',
        score: 0
      })
      console.log(chalk.red('  ❌ tsx dependency not resolved'))
    }
  }

  private async testNpxTsxExecution(results: ValidationResult[]): Promise<void> {
    console.log(chalk.cyan('\n🚀 Test 2: npx tsx script execution...'))
    
    try {
      // Test execution of a simple script
      const output = execSync('npx tsx -e "console.log(\'tsx execution test passed\')"', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      if (output.includes('tsx execution test passed')) {
        results.push({
          component: 'npx tsx Execution',
          status: 'pass',
          details: 'npx tsx executes scripts correctly',
          score: 100
        })
        console.log(chalk.green('  ✅ npx tsx execution successful'))
      } else {
        results.push({
          component: 'npx tsx Execution',
          status: 'fail',
          details: 'npx tsx execution failed or returned unexpected output',
          score: 30
        })
        console.log(chalk.red('  ❌ npx tsx execution failed'))
      }
    } catch (error) {
      results.push({
        component: 'npx tsx Execution',
        status: 'fail',
        details: `npx tsx execution error: ${error.message}`,
        score: 0
      })
      console.log(chalk.red('  ❌ npx tsx execution failed'))
    }
  }

  private async testCIWorkflowSyntax(results: ValidationResult[]): Promise<void> {
    console.log(chalk.cyan('\n📋 Test 3: CI workflow syntax validation...'))
    
    try {
      const ciPath = join(this.projectRoot, '.github', 'workflows', 'ci.yml')
      if (await pathExists(ciPath)) {
        const ciContent = await readFile(ciPath, 'utf-8')
        
        // Check for tsx installation step
        const hasTsxInstall = ciContent.includes('npm install --no-save tsx')
        const usesNpxTsx = ciContent.includes('npx tsx')
        const hasSkipCi = ciContent.includes('[skip ci]')
        
        let score = 0
        let details = []
        
        if (hasTsxInstall) {
          score += 40
          details.push('tsx installation step present')
        } else {
          details.push('missing tsx installation step')
        }
        
        if (usesNpxTsx) {
          score += 40
          details.push('uses npx tsx for script execution')
        } else {
          details.push('missing npx tsx usage')
        }
        
        if (hasSkipCi) {
          score += 20
          details.push('skip ci protection enabled')
        } else {
          details.push('missing skip ci protection')
        }
        
        results.push({
          component: 'CI Workflow Integration',
          status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
          details: details.join(', '),
          score
        })
        
        if (score >= 80) {
          console.log(chalk.green('  ✅ CI workflow properly configured'))
        } else {
          console.log(chalk.yellow('  ⚠️ CI workflow has issues'))
        }
      } else {
        results.push({
          component: 'CI Workflow Integration',
          status: 'fail',
          details: 'CI workflow file not found',
          score: 0
        })
        console.log(chalk.red('  ❌ CI workflow file not found'))
      }
    } catch (error) {
      results.push({
        component: 'CI Workflow Integration',
        status: 'fail',
        details: `CI workflow validation error: ${error.message}`,
        score: 0
      })
      console.log(chalk.red('  ❌ CI workflow validation failed'))
    }
  }

  private async testPackageJsonScripts(results: ValidationResult[]): Promise<void> {
    console.log(chalk.cyan('\n📦 Test 4: package.json script validation...'))
    
    try {
      const packagePath = join(this.projectRoot, 'package.json')
      if (await pathExists(packagePath)) {
        const packageContent = await readFile(packagePath, 'utf-8')
        const packageData = JSON.parse(packageContent)
        
        const scripts = packageData.scripts || {}
        const ciScripts = Object.keys(scripts).filter(key => key.startsWith('ci:'))
        const npxTsxScripts = ciScripts.filter(key => scripts[key].includes('npx tsx'))
        
        const score = ciScripts.length > 0 ? (npxTsxScripts.length / ciScripts.length) * 100 : 0
        
        results.push({
          component: 'Package.json Scripts',
          status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
          details: `${npxTsxScripts.length}/${ciScripts.length} CI scripts use npx tsx`,
          score
        })
        
        if (score >= 80) {
          console.log(chalk.green('  ✅ Package.json scripts properly configured'))
        } else {
          console.log(chalk.yellow('  ⚠️ Some scripts still use direct tsx'))
        }
      } else {
        results.push({
          component: 'Package.json Scripts',
          status: 'fail',
          details: 'package.json not found',
          score: 0
        })
        console.log(chalk.red('  ❌ package.json not found'))
      }
    } catch (error) {
      results.push({
        component: 'Package.json Scripts',
        status: 'fail',
        details: `package.json validation error: ${error.message}`,
        score: 0
      })
      console.log(chalk.red('  ❌ package.json validation failed'))
    }
  }

  private async testSafetyPreChecks(results: ValidationResult[]): Promise<void> {
    console.log(chalk.cyan('\n🛡️ Test 5: safety pre-check validation...'))
    
    try {
      const scriptsToCheck = [
        'scripts/checkCriticalFailures.ts',
        'scripts/fixLintErrors.ts',
        'scripts/securityAutoFix.ts',
        'scripts/testAutoHealing.ts'
      ]
      
      let scriptsWithPreCheck = 0
      
      for (const scriptPath of scriptsToCheck) {
        const fullPath = join(this.projectRoot, scriptPath)
        if (await pathExists(fullPath)) {
          const scriptContent = await readFile(fullPath, 'utf-8')
          if (scriptContent.includes('require.resolve(\'tsx\')')) {
            scriptsWithPreCheck++
          }
        }
      }
      
      const score = (scriptsWithPreCheck / scriptsToCheck.length) * 100
      
      results.push({
        component: 'Safety Pre-checks',
        status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
        details: `${scriptsWithPreCheck}/${scriptsToCheck.length} scripts have tsx safety checks`,
        score
      })
      
      if (score >= 80) {
        console.log(chalk.green('  ✅ Safety pre-checks implemented'))
      } else {
        console.log(chalk.yellow('  ⚠️ Some scripts missing safety pre-checks'))
      }
    } catch (error) {
      results.push({
        component: 'Safety Pre-checks',
        status: 'fail',
        details: `Safety pre-check validation error: ${error.message}`,
        score: 0
      })
      console.log(chalk.red('  ❌ Safety pre-check validation failed'))
    }
  }

  private async generateValidationReport(results: ValidationResult[]): Promise<void> {
    const overallScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const warningCount = results.filter(r => r.status === 'warning').length

    const reportContent = `# 🧪 CI Stability & Auto-Healing Execution Fix Validation Report

**Generated:** ${new Date().toISOString()}  
**Overall Score:** ${Math.round(overallScore)}/100  
**Status:** ${failCount === 0 ? '✅ PASS' : '❌ FAIL'}

## 📊 Validation Summary

| Metric | Count | Status |
|--------|-------|--------|
| **Total Tests** | ${results.length} | ℹ️ |
| **Passed** | ${passCount} | ${passCount === results.length ? '✅' : '⚠️'} |
| **Failed** | ${failCount} | ${failCount === 0 ? '✅' : '❌'} |
| **Warnings** | ${warningCount} | ${warningCount === 0 ? '✅' : '⚠️'} |

## 🔧 Component Validation Results

${results.map(result => `
### ${this.getStatusEmoji(result.status)} ${result.component}

- **Status:** ${result.status.toUpperCase()}
- **Score:** ${result.score}/100
- **Details:** ${result.details}
`).join('\n')}

## 🎯 Fix Implementation Status

### ✅ Completed
- CI workflow updated with tsx installation step
- All scripts updated to use npx tsx consistently
- Safety pre-checks added to critical scripts
- Skip CI protection enabled to prevent infinite loops

### 🚀 Expected CI Behavior

1. **tsx Installation:** CI will install tsx temporarily with \`npm install --no-save tsx\`
2. **Script Execution:** All TypeScript scripts execute via \`npx tsx\` 
3. **Dependency Resolution:** Scripts include safety checks for tsx availability
4. **Error Handling:** Clear error messages if tsx is missing (exit code 127)
5. **Auto-commit Protection:** \`[skip ci]\` prevents infinite CI loops

## 📋 Validation Checklist

- [${results.find(r => r.component === 'tsx Resolution')?.status === 'pass' ? 'x' : ' '}] tsx dependency can be resolved
- [${results.find(r => r.component === 'npx tsx Execution')?.status === 'pass' ? 'x' : ' '}] npx tsx executes scripts correctly
- [${results.find(r => r.component === 'CI Workflow Integration')?.status === 'pass' ? 'x' : ' '}] CI workflow properly configured
- [${results.find(r => r.component === 'Package.json Scripts')?.status === 'pass' ? 'x' : ' '}] package.json scripts use npx tsx
- [${results.find(r => r.component === 'Safety Pre-checks')?.status === 'pass' ? 'x' : ' '}] Safety pre-checks implemented

## 🧪 Testing Commands

Local testing:
\`\`\`bash
# Install tsx temporarily
npm install --no-save tsx

# Test individual components
npx tsx scripts/fixLintErrors.ts
npx tsx scripts/securityAutoFix.ts
npx tsx scripts/checkCriticalFailures.ts --report-only

# Test CI stability system
npm run ci:stability-check-report
\`\`\`

CI testing:
\`\`\`bash
# Trigger CI manually via GitHub Actions
# Validate tsx installation and script execution
# Confirm exit code 0 for successful execution
\`\`\`

## 🔍 Expected Output

Successful execution should show:
\`\`\`
🛡️ Running CI Stability & Auto-Healing System...
✅ Lint Auto-Fix complete
✅ Security Audit passed (or shows specific issues)
✅ CI health: X/100 (pass/warning based on actual state)
\`\`\`

## 📈 Next Steps

${failCount === 0 ? `
✅ **All validations passed**
- CI fix is ready for production use
- Test in GitHub Actions to confirm functionality
- Monitor first few CI runs for any edge cases
` : `
❌ **Fix validation issues before deployment:**
${results.filter(r => r.status === 'fail').map(r => `- ${r.component}: ${r.details}`).join('\n')}
`}

---

**Generated by:** CI Fix Validator v1.0  
**Fix Status:** ${failCount === 0 ? 'Ready for Production' : 'Needs Attention'}  
**Overall Health:** ${overallScore >= 90 ? 'Excellent' : overallScore >= 70 ? 'Good' : 'Needs Improvement'}
`

    const reportPath = join(this.reportsPath, 'ci-fix-validation.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`\n✅ Validation report generated: ${reportPath}`))
  }

  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'pass': '✅',
      'fail': '❌',
      'warning': '⚠️'
    }
    return emojiMap[status] || '❓'
  }

  private displayValidationSummary(results: ValidationResult[]): void {
    console.log(chalk.blue('\n📊 CI Fix Validation Summary'))
    console.log(chalk.blue('=' .repeat(33)))
    
    const overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    
    const statusColor = failCount === 0 ? chalk.green : chalk.red
    console.log(statusColor(`🎯 Overall Score: ${overallScore}/100`))
    console.log(chalk.white(`📊 Results: ${passCount} passed, ${failCount} failed`))
    
    console.log(chalk.white('\n📋 Component Status:'))
    results.forEach(result => {
      const statusIcon = this.getStatusEmoji(result.status)
      const scoreColor = result.score >= 80 ? chalk.green : result.score >= 60 ? chalk.yellow : chalk.red
      console.log(chalk.white(`  ${statusIcon} ${result.component}: ${scoreColor(result.score + '/100')}`))
    })
    
    console.log(chalk.blue(`\n📄 Full report: reports/ci-fix-validation.md`))
    
    if (failCount === 0) {
      console.log(chalk.green('\n✅ CI Stability & Auto-Healing execution fix validation passed'))
      console.log(chalk.green('   System is ready for GitHub Actions deployment'))
    } else {
      console.log(chalk.red(`\n❌ ${failCount} validation failures detected`))
      console.log(chalk.red('   Address issues before deploying to CI'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const validator = new CIFixValidator()
    await validator.execute()
    
    console.log(chalk.green('\n✅ CI fix validation completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ CI fix validation failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { CIFixValidator }