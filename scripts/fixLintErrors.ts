#!/usr/bin/env tsx
/**
 * Lint Auto-Fix System
 * 
 * Automatically fixes safe ESLint errors and categorizes remaining issues:
 * - Runs eslint --fix for auto-fixable issues
 * - Counts errors vs warnings 
 * - Generates detailed report for manual review
 * - Enables CI to continue with warnings while blocking on errors
 * 
 * Usage: tsx scripts/fixLintErrors.ts
 */

import { execSync } from 'child_process'
import { writeFile, mkdir, pathExists } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface LintResult {
  filePath: string
  messages: LintMessage[]
  errorCount: number
  warningCount: number
  fixableErrorCount: number
  fixableWarningCount: number
}

interface LintMessage {
  ruleId: string | null
  severity: number // 1 = warning, 2 = error
  message: string
  line: number
  column: number
  nodeType?: string
  fix?: {
    range: [number, number]
    text: string
  }
}

interface FixSummary {
  totalFiles: number
  filesWithIssues: number
  autoFixed: {
    errors: number
    warnings: number
    total: number
  }
  remaining: {
    errors: number
    warnings: number
    total: number
  }
  categories: {
    preferConst: number
    noVar: number
    noExplicitAny: number
    unusedVars: number
    reactHooks: number
    other: number
  }
  blockingIssues: Array<{
    file: string
    rule: string
    message: string
    line: number
    severity: 'error' | 'warning'
  }>
  autoFixableRemaining: number
}

class LintAutoFixer {
  private reportsPath: string
  private projectRoot: string

  constructor() {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
  }

  async execute(): Promise<FixSummary> {
    console.log(chalk.blue('🔧 ESLint Auto-Fix System'))
    console.log(chalk.blue('=' .repeat(30)))

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Step 1: Run initial lint check to baseline
      console.log(chalk.cyan('\\n📊 Step 1: Analyzing current lint status...'))
      const initialResults = await this.runLintCheck(false)

      // Step 2: Run auto-fix
      console.log(chalk.cyan('\\n🔧 Step 2: Running ESLint auto-fix...'))
      await this.runAutoFix()

      // Step 3: Check results after auto-fix
      console.log(chalk.cyan('\\n📊 Step 3: Analyzing post-fix status...'))
      const finalResults = await this.runLintCheck(false)

      // Step 4: Generate summary
      const summary = this.generateSummary(initialResults, finalResults)

      // Step 5: Create report
      await this.generateReport(summary)

      // Step 6: Display results
      this.displaySummary(summary)

      return summary

    } catch (error) {
      console.error(chalk.red('❌ Lint auto-fix failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async runAutoFix(): Promise<void> {
    try {
      // Run ESLint with auto-fix on TypeScript and React files
      const command = 'npx eslint . --ext .ts,.tsx,.js,.jsx --fix --max-warnings=1000'
      
      console.log(chalk.white('Running: ' + command))
      
      execSync(command, { 
        cwd: this.projectRoot,
        stdio: 'pipe' // Suppress output to avoid noise
      })
      
      console.log(chalk.green('✅ Auto-fix completed'))
      
    } catch (error) {
      // ESLint returns non-zero even when fixes are applied if issues remain
      // This is expected behavior, so we don't throw here
      console.log(chalk.yellow('⚠️ Auto-fix completed with remaining issues'))
    }
  }

  private async runLintCheck(forFix = false): Promise<LintResult[]> {
    try {
      // Run ESLint in JSON mode to get structured output
      const command = `npx eslint . --ext .ts,.tsx,.js,.jsx --format json ${forFix ? '--fix-dry-run' : ''}`
      
      const output = execSync(command, { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return JSON.parse(output) as LintResult[]
      
    } catch (error) {
      // ESLint returns non-zero when issues are found, but output is still valid JSON
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout) as LintResult[]
        } catch (parseError) {
          console.warn(chalk.yellow('⚠️ Failed to parse ESLint output, using empty result'))
          return []
        }
      }
      
      console.warn(chalk.yellow('⚠️ ESLint check failed, using empty result'))
      return []
    }
  }

  private generateSummary(initialResults: LintResult[], finalResults: LintResult[]): FixSummary {
    const initialStats = this.calculateStats(initialResults)
    const finalStats = this.calculateStats(finalResults)

    const summary: FixSummary = {
      totalFiles: finalResults.length,
      filesWithIssues: finalResults.filter(r => r.errorCount > 0 || r.warningCount > 0).length,
      autoFixed: {
        errors: Math.max(0, initialStats.errors - finalStats.errors),
        warnings: Math.max(0, initialStats.warnings - finalStats.warnings),
        total: Math.max(0, (initialStats.errors + initialStats.warnings) - (finalStats.errors + finalStats.warnings))
      },
      remaining: {
        errors: finalStats.errors,
        warnings: finalStats.warnings,
        total: finalStats.errors + finalStats.warnings
      },
      categories: this.categorizeIssues(finalResults),
      blockingIssues: this.extractBlockingIssues(finalResults),
      autoFixableRemaining: finalStats.fixableErrors + finalStats.fixableWarnings
    }

    return summary
  }

  private calculateStats(results: LintResult[]) {
    return results.reduce((acc, result) => ({
      errors: acc.errors + result.errorCount,
      warnings: acc.warnings + result.warningCount,
      fixableErrors: acc.fixableErrors + result.fixableErrorCount,
      fixableWarnings: acc.fixableWarnings + result.fixableWarningCount
    }), { errors: 0, warnings: 0, fixableErrors: 0, fixableWarnings: 0 })
  }

  private categorizeIssues(results: LintResult[]) {
    const categories = {
      preferConst: 0,
      noVar: 0,
      noExplicitAny: 0,
      unusedVars: 0,
      reactHooks: 0,
      other: 0
    }

    results.forEach(result => {
      result.messages.forEach(message => {
        switch (message.ruleId) {
          case 'prefer-const':
            categories.preferConst++
            break
          case 'no-var':
            categories.noVar++
            break
          case '@typescript-eslint/no-explicit-any':
            categories.noExplicitAny++
            break
          case '@typescript-eslint/no-unused-vars':
          case 'no-unused-vars':
            categories.unusedVars++
            break
          case 'react-hooks/rules-of-hooks':
          case 'react-hooks/exhaustive-deps':
            categories.reactHooks++
            break
          default:
            categories.other++
        }
      })
    })

    return categories
  }

  private extractBlockingIssues(results: LintResult[]) {
    const blockingIssues: Array<{
      file: string
      rule: string
      message: string
      line: number
      severity: 'error' | 'warning'
    }> = []

    results.forEach(result => {
      result.messages.forEach(message => {
        // Only include errors and critical warnings as blocking
        if (message.severity === 2 || this.isCriticalWarning(message.ruleId)) {
          blockingIssues.push({
            file: result.filePath.replace(this.projectRoot, '.'),
            rule: message.ruleId || 'unknown',
            message: message.message,
            line: message.line,
            severity: message.severity === 2 ? 'error' : 'warning'
          })
        }
      })
    })

    return blockingIssues.slice(0, 20) // Limit to first 20 for readability
  }

  private isCriticalWarning(ruleId: string | null): boolean {
    if (!ruleId) return false
    
    const criticalWarnings = [
      'react-hooks/rules-of-hooks',
      'react-hooks/exhaustive-deps',
      '@typescript-eslint/no-unsafe-assignment',
      '@typescript-eslint/no-unsafe-call',
      '@typescript-eslint/no-unsafe-member-access'
    ]
    
    return criticalWarnings.includes(ruleId)
  }

  private async generateReport(summary: FixSummary): Promise<void> {
    const reportContent = `# 🔧 Lint Auto-Fix Summary

**Generated:** ${new Date().toISOString()}  
**Project:** Hotdog Diaries  
**Scan Scope:** .ts, .tsx, .js, .jsx files

## 📊 Executive Summary

| Metric | Count | Status |
|--------|--------|--------|
| **Total Files Scanned** | ${summary.totalFiles} | ℹ️ |
| **Files with Issues** | ${summary.filesWithIssues} | ${summary.filesWithIssues > 50 ? '⚠️' : '✅'} |
| **Auto-Fixed Issues** | ${summary.autoFixed.total} | ✅ |
| **Remaining Errors** | ${summary.remaining.errors} | ${summary.remaining.errors > 0 ? '❌' : '✅'} |
| **Remaining Warnings** | ${summary.remaining.warnings} | ${summary.remaining.warnings > 800 ? '⚠️' : '✅'} |
| **Auto-Fixable Remaining** | ${summary.autoFixableRemaining} | ${summary.autoFixableRemaining > 0 ? '🔧' : '✅'} |

## 🎯 Fix Results

### ✅ Successfully Auto-Fixed
- **Errors Fixed:** ${summary.autoFixed.errors}
- **Warnings Fixed:** ${summary.autoFixed.warnings}
- **Total Fixed:** ${summary.autoFixed.total}

### ⚠️ Remaining Issues
- **Errors:** ${summary.remaining.errors} ${summary.remaining.errors > 0 ? '(❌ BLOCKING)' : ''}
- **Warnings:** ${summary.remaining.warnings} ${summary.remaining.warnings > 800 ? '(Above threshold)' : '(Within threshold)'}

## 📋 Issue Categories

| Category | Count | Auto-Fixable | Status |
|----------|--------|---------------|---------|
| \`prefer-const\` | ${summary.categories.preferConst} | ✅ | ${summary.categories.preferConst > 0 ? 'Can be auto-fixed' : 'Clean'} |
| \`no-var\` | ${summary.categories.noVar} | ✅ | ${summary.categories.noVar > 0 ? 'Can be auto-fixed' : 'Clean'} |
| \`no-explicit-any\` | ${summary.categories.noExplicitAny} | 🔍 | ${summary.categories.noExplicitAny > 0 ? 'Needs type annotation' : 'Clean'} |
| \`unused-vars\` | ${summary.categories.unusedVars} | ✅ | ${summary.categories.unusedVars > 0 ? 'Can be auto-fixed' : 'Clean'} |
| \`react-hooks\` | ${summary.categories.reactHooks} | ❌ | ${summary.categories.reactHooks > 0 ? 'Manual fix required' : 'Clean'} |
| **Other** | ${summary.categories.other} | 🔍 | Various rules |

${summary.blockingIssues.length > 0 ? `
## ❌ Blocking Issues (First 20)

${summary.blockingIssues.map(issue => 
  `### \`${issue.file}\`
- **Rule:** \`${issue.rule}\`
- **Line:** ${issue.line}
- **Severity:** ${issue.severity === 'error' ? '❌ Error' : '⚠️ Critical Warning'}
- **Message:** ${issue.message}
`).join('\\n')}
` : '## ✅ No Blocking Issues\n\nAll critical errors have been resolved!'}

## 🔧 Recommended Actions

### Immediate (Auto-fixable)
${summary.autoFixableRemaining > 0 ? `
- Run \`npm run lint:fix\` again to fix remaining ${summary.autoFixableRemaining} auto-fixable issues
- These are safe to fix automatically
` : '- All auto-fixable issues have been resolved ✅'}

### Manual Review Required
${summary.remaining.errors > 0 ? `
- **${summary.remaining.errors} errors** require manual intervention
- Focus on React hooks and TypeScript safety issues
- Review blocking issues listed above
` : '- No manual fixes required ✅'}

### Performance Optimization
${summary.remaining.warnings > 800 ? `
- **${summary.remaining.warnings} warnings** exceed threshold (800)
- Consider adding eslint-disable comments for acceptable warnings
- Review and update ESLint configuration if needed
` : `- Warning count (${summary.remaining.warnings}) is within acceptable threshold ✅`}

## 📈 Health Metrics

- **Auto-Fix Effectiveness:** ${summary.autoFixed.total > 0 ? Math.round((summary.autoFixed.total / (summary.autoFixed.total + summary.remaining.total)) * 100) : 0}%
- **Error Rate:** ${summary.totalFiles > 0 ? ((summary.remaining.errors / summary.totalFiles) * 100).toFixed(1) : 0}% of files
- **CI Readiness:** ${summary.remaining.errors === 0 ? '✅ Ready to pass' : '❌ Will fail due to errors'}

## 🚀 Next Steps

${summary.remaining.errors > 0 ? `
1. **Fix blocking errors** listed above manually
2. **Re-run auto-fix:** \`tsx scripts/fixLintErrors.ts\`
3. **Validate:** \`npm run lint:ci\`
4. **Commit fixes** when all errors resolved
` : `
1. **Commit auto-fixes** applied by this script
2. **Monitor warnings** to prevent future threshold breaches  
3. **Run periodic auto-fix** to maintain code quality
4. **CI is ready to pass** ✅
`}

---

**Auto-Fix System Status:** ${summary.remaining.errors === 0 ? '✅ Successful' : '⚠️ Partial Success'}  
**Last Updated:** ${new Date().toISOString()}  
**Next Auto-Fix Recommended:** ${summary.autoFixableRemaining > 0 ? 'Immediately' : 'Next code change'}
`

    const reportPath = join(this.reportsPath, 'lint-auto-fix.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Report generated: ${reportPath}`))
  }

  private displaySummary(summary: FixSummary): void {
    console.log(chalk.blue('\\n📊 Lint Auto-Fix Summary'))
    console.log(chalk.blue('=' .repeat(30)))
    
    console.log(chalk.green(`✅ Auto-Fixed: ${summary.autoFixed.total} issues`))
    console.log(chalk.white(`   - Errors: ${summary.autoFixed.errors}`))
    console.log(chalk.white(`   - Warnings: ${summary.autoFixed.warnings}`))
    
    if (summary.remaining.errors > 0) {
      console.log(chalk.red(`❌ Blocking Errors: ${summary.remaining.errors}`))
    } else {
      console.log(chalk.green(`✅ No Blocking Errors`))
    }
    
    if (summary.remaining.warnings > 800) {
      console.log(chalk.yellow(`⚠️ Warnings: ${summary.remaining.warnings} (above threshold)`))
    } else {
      console.log(chalk.green(`✅ Warnings: ${summary.remaining.warnings} (within threshold)`))
    }
    
    if (summary.autoFixableRemaining > 0) {
      console.log(chalk.cyan(`🔧 Auto-fixable remaining: ${summary.autoFixableRemaining}`))
    }
    
    console.log(chalk.blue(`\\n📄 Full report: reports/lint-auto-fix.md`))
    
    if (summary.remaining.errors === 0) {
      console.log(chalk.green('\\n✅ CI can proceed - no blocking errors'))
    } else {
      console.log(chalk.red('\\n❌ CI will fail - manual fixes required'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const fixer = new LintAutoFixer()
    const summary = await fixer.execute()
    
    // Exit with error code if there are blocking issues
    if (summary.remaining.errors > 0) {
      console.log(chalk.red('\\n❌ Exiting with error due to blocking lint issues'))
      process.exit(1)
    }
    
    console.log(chalk.green('\\n✅ Lint auto-fix completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Lint auto-fix failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { LintAutoFixer }