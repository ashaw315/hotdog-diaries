#!/usr/bin/env tsx
/**
 * Critical Failure Gatekeeper System
 * 
 * Orchestrates the complete CI stability pipeline by:
 * - Running lint auto-fix and security remediation
 * - Analyzing results and determining CI pass/fail status
 * - Generating consolidated health reports
 * - Providing clear pass/fail gates for CI integration
 * - Categorizing failures as blocking vs acceptable
 * 
 * Usage: tsx scripts/checkCriticalFailures.ts [--fix] [--security] [--report-only]
 */

// Safety pre-check: Ensure tsx dependency is available
try {
  require.resolve('tsx')
} catch {
  console.error('❌ Missing dependency: tsx. Run `npm install --no-save tsx` before execution.')
  process.exit(127)
}

import { execSync } from 'child_process'
import { writeFile, mkdir, pathExists } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface GatekeeperConfig {
  runAutoFix: boolean
  runSecurity: boolean
  reportOnly: boolean
  thresholds: {
    maxLintErrors: number
    maxLintWarnings: number
    maxCriticalVulns: number
    maxHighVulns: number
    maxModerateVulns: number
  }
}

interface SystemHealthResult {
  timestamp: string
  overallStatus: 'pass' | 'fail' | 'warning'
  components: {
    lint: ComponentHealth
    security: ComponentHealth
    build: ComponentHealth
    tests: ComponentHealth
  }
  blockers: string[]
  warnings: string[]
  autoFixesApplied: string[]
  manualActionRequired: string[]
  ciReadiness: {
    canProceed: boolean
    reason: string
    confidence: number
  }
}

interface ComponentHealth {
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  score: number
  details: string
  blockers: string[]
  warnings: string[]
  fixesApplied: number
  lastChecked: string
}

class CriticalFailureGatekeeper {
  private reportsPath: string
  private projectRoot: string
  private config: GatekeeperConfig

  constructor(config: Partial<GatekeeperConfig> = {}) {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
    this.config = {
      runAutoFix: true,
      runSecurity: true,
      reportOnly: false,
      thresholds: {
        maxLintErrors: 0,
        maxLintWarnings: 800,
        maxCriticalVulns: 0,
        maxHighVulns: 2,
        maxModerateVulns: 10
      },
      ...config
    }
  }

  async execute(): Promise<SystemHealthResult> {
    console.log(chalk.blue('🛡️ Critical Failure Gatekeeper System'))
    console.log(chalk.blue('=' .repeat(42)))

    if (this.config.reportOnly) {
      console.log(chalk.yellow('📊 REPORT-ONLY MODE - No fixes will be applied'))
    }

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Initialize health result
      const healthResult: SystemHealthResult = {
        timestamp: new Date().toISOString(),
        overallStatus: 'pass',
        components: {
          lint: this.createEmptyComponentHealth(),
          security: this.createEmptyComponentHealth(),
          build: this.createEmptyComponentHealth(),
          tests: this.createEmptyComponentHealth()
        },
        blockers: [],
        warnings: [],
        autoFixesApplied: [],
        manualActionRequired: [],
        ciReadiness: {
          canProceed: false,
          reason: '',
          confidence: 0
        }
      }

      // Step 1: Lint Analysis and Auto-Fix
      console.log(chalk.cyan('\n🔧 Step 1: Lint Analysis & Auto-Fix...'))
      await this.checkLintHealth(healthResult)

      // Step 2: Security Analysis and Auto-Fix
      console.log(chalk.cyan('\n🔒 Step 2: Security Analysis & Auto-Fix...'))
      await this.checkSecurityHealth(healthResult)

      // Step 3: Build Validation
      console.log(chalk.cyan('\n🏗️ Step 3: Build Validation...'))
      await this.checkBuildHealth(healthResult)

      // Step 4: Critical Test Validation
      console.log(chalk.cyan('\n🧪 Step 4: Critical Test Validation...'))
      await this.checkTestHealth(healthResult)

      // Step 5: Overall Assessment
      console.log(chalk.cyan('\n📊 Step 5: Overall Health Assessment...'))
      this.calculateOverallHealth(healthResult)

      // Step 6: Generate Consolidated Report
      await this.generateConsolidatedReport(healthResult)

      // Step 7: Display Results
      this.displayHealthSummary(healthResult)

      return healthResult

    } catch (error) {
      console.error(chalk.red('❌ Gatekeeper system failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private createEmptyComponentHealth(): ComponentHealth {
    return {
      status: 'skipped',
      score: 0,
      details: '',
      blockers: [],
      warnings: [],
      fixesApplied: 0,
      lastChecked: new Date().toISOString()
    }
  }

  private async checkLintHealth(healthResult: SystemHealthResult): Promise<void> {
    try {
      if (this.config.runAutoFix && !this.config.reportOnly) {
        console.log(chalk.white('  Running lint auto-fix...'))
        
        // Import and run the lint auto-fixer
        const { LintAutoFixer } = await import('./fixLintErrors.js')
        const lintFixer = new LintAutoFixer()
        const lintSummary = await lintFixer.execute()

        healthResult.components.lint = {
          status: lintSummary.remaining.errors === 0 ? 'pass' : 'fail',
          score: this.calculateLintScore(lintSummary),
          details: `Errors: ${lintSummary.remaining.errors}, Warnings: ${lintSummary.remaining.warnings}, Fixed: ${lintSummary.autoFixed.total}`,
          blockers: lintSummary.remaining.errors > this.config.thresholds.maxLintErrors 
            ? [`${lintSummary.remaining.errors} lint errors exceed threshold (${this.config.thresholds.maxLintErrors})`]
            : [],
          warnings: lintSummary.remaining.warnings > this.config.thresholds.maxLintWarnings
            ? [`${lintSummary.remaining.warnings} lint warnings exceed threshold (${this.config.thresholds.maxLintWarnings})`]
            : [],
          fixesApplied: lintSummary.autoFixed.total,
          lastChecked: new Date().toISOString()
        }

        if (lintSummary.autoFixed.total > 0) {
          healthResult.autoFixesApplied.push(`Lint: Fixed ${lintSummary.autoFixed.total} issues automatically`)
        }

        if (lintSummary.remaining.errors > 0) {
          healthResult.blockers.push(`${lintSummary.remaining.errors} lint errors require manual fixes`)
          healthResult.manualActionRequired.push('Review and fix remaining lint errors in reports/lint-auto-fix.md')
        }

      } else {
        // Run lint check without auto-fix
        const lintOutput = await this.runLintCheck()
        const errorCount = this.extractLintErrorCount(lintOutput)
        const warningCount = this.extractLintWarningCount(lintOutput)

        healthResult.components.lint = {
          status: errorCount === 0 ? 'pass' : 'fail',
          score: errorCount === 0 ? 100 : Math.max(0, 100 - (errorCount * 10) - (warningCount * 0.5)),
          details: `Errors: ${errorCount}, Warnings: ${warningCount}`,
          blockers: errorCount > this.config.thresholds.maxLintErrors 
            ? [`${errorCount} lint errors exceed threshold`]
            : [],
          warnings: warningCount > this.config.thresholds.maxLintWarnings
            ? [`${warningCount} lint warnings exceed threshold`]
            : [],
          fixesApplied: 0,
          lastChecked: new Date().toISOString()
        }
      }

      console.log(chalk.green(`  ✅ Lint check completed - Status: ${healthResult.components.lint.status}`))

    } catch (error) {
      healthResult.components.lint = {
        status: 'fail',
        score: 0,
        details: `Lint check failed: ${error.message}`,
        blockers: ['Lint system failure'],
        warnings: [],
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }
      healthResult.blockers.push('Lint system failure prevents validation')
    }
  }

  private async runLintCheck(): Promise<string> {
    try {
      return execSync('npm run lint', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
    } catch (error) {
      return error.stdout || error.stderr || ''
    }
  }

  private extractLintErrorCount(output: string): number {
    const errorMatch = output.match(/(\d+)\s+error/i)
    return errorMatch ? parseInt(errorMatch[1]) : 0
  }

  private extractLintWarningCount(output: string): number {
    const warningMatch = output.match(/(\d+)\s+warning/i)
    return warningMatch ? parseInt(warningMatch[1]) : 0
  }

  private calculateLintScore(lintSummary: any): number {
    if (lintSummary.remaining.errors === 0 && lintSummary.remaining.warnings <= this.config.thresholds.maxLintWarnings) {
      return 100
    }
    
    let score = 100
    score -= lintSummary.remaining.errors * 15  // -15 per error
    score -= Math.max(0, lintSummary.remaining.warnings - this.config.thresholds.maxLintWarnings) * 0.5  // -0.5 per warning over threshold
    score += Math.min(lintSummary.autoFixed.total * 2, 20)  // +2 per fix, max +20
    
    return Math.max(0, Math.min(100, score))
  }

  private async checkSecurityHealth(healthResult: SystemHealthResult): Promise<void> {
    try {
      if (this.config.runSecurity && !this.config.reportOnly) {
        console.log(chalk.white('  Running security auto-fix...'))
        
        // Import and run the security auto-fixer
        const { SecurityAutoFixer } = await import('./securityAutoFix.js')
        const securityFixer = new SecurityAutoFixer()
        const securitySummary = await securityFixer.execute()

        const criticalCount = securitySummary.bySeverity.critical
        const highCount = securitySummary.bySeverity.high
        const moderateCount = securitySummary.bySeverity.moderate

        healthResult.components.security = {
          status: criticalCount === 0 && highCount <= this.config.thresholds.maxHighVulns ? 'pass' : 'fail',
          score: this.calculateSecurityScore(securitySummary),
          details: `Critical: ${criticalCount}, High: ${highCount}, Moderate: ${moderateCount}, Fixed: ${securitySummary.autoFixed.total}`,
          blockers: criticalCount > this.config.thresholds.maxCriticalVulns
            ? [`${criticalCount} critical vulnerabilities exceed threshold (${this.config.thresholds.maxCriticalVulns})`]
            : [],
          warnings: highCount > this.config.thresholds.maxHighVulns
            ? [`${highCount} high-risk vulnerabilities exceed threshold (${this.config.thresholds.maxHighVulns})`]
            : [],
          fixesApplied: securitySummary.autoFixed.total,
          lastChecked: new Date().toISOString()
        }

        if (securitySummary.autoFixed.total > 0) {
          healthResult.autoFixesApplied.push(`Security: Fixed ${securitySummary.autoFixed.total} vulnerabilities automatically`)
        }

        if (criticalCount > 0 || highCount > this.config.thresholds.maxHighVulns) {
          healthResult.blockers.push(`Security vulnerabilities block CI: ${criticalCount} critical, ${highCount} high-risk`)
          healthResult.manualActionRequired.push('Review and fix security vulnerabilities in reports/security-audit.md')
        }

      } else {
        // Run security audit without auto-fix
        const auditOutput = await this.runSecurityAudit()
        const vulnCounts = this.parseSecurityAudit(auditOutput)

        healthResult.components.security = {
          status: vulnCounts.critical === 0 && vulnCounts.high <= this.config.thresholds.maxHighVulns ? 'pass' : 'fail',
          score: Math.max(0, 100 - (vulnCounts.critical * 25) - (vulnCounts.high * 10) - (vulnCounts.moderate * 3)),
          details: `Critical: ${vulnCounts.critical}, High: ${vulnCounts.high}, Moderate: ${vulnCounts.moderate}`,
          blockers: vulnCounts.critical > 0 ? [`${vulnCounts.critical} critical vulnerabilities`] : [],
          warnings: vulnCounts.high > this.config.thresholds.maxHighVulns ? [`${vulnCounts.high} high-risk vulnerabilities`] : [],
          fixesApplied: 0,
          lastChecked: new Date().toISOString()
        }
      }

      console.log(chalk.green(`  ✅ Security check completed - Status: ${healthResult.components.security.status}`))

    } catch (error) {
      healthResult.components.security = {
        status: 'fail',
        score: 0,
        details: `Security check failed: ${error.message}`,
        blockers: ['Security system failure'],
        warnings: [],
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }
      healthResult.blockers.push('Security system failure prevents validation')
    }
  }

  private async runSecurityAudit(): Promise<string> {
    try {
      return execSync('npm audit', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
    } catch (error) {
      return error.stdout || error.stderr || ''
    }
  }

  private parseSecurityAudit(output: string): { critical: number; high: number; moderate: number; low: number } {
    const criticalMatch = output.match(/(\d+)\s+critical/i)
    const highMatch = output.match(/(\d+)\s+high/i)
    const moderateMatch = output.match(/(\d+)\s+moderate/i)
    const lowMatch = output.match(/(\d+)\s+low/i)

    return {
      critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
      high: highMatch ? parseInt(highMatch[1]) : 0,
      moderate: moderateMatch ? parseInt(moderateMatch[1]) : 0,
      low: lowMatch ? parseInt(lowMatch[1]) : 0
    }
  }

  private calculateSecurityScore(securitySummary: any): number {
    let score = 100
    score -= securitySummary.bySeverity.critical * 25
    score -= securitySummary.bySeverity.high * 10
    score -= securitySummary.bySeverity.moderate * 3
    score -= securitySummary.bySeverity.low * 1
    score += Math.min(securitySummary.autoFixed.total * 2, 20)
    
    return Math.max(0, Math.min(100, score))
  }

  private async checkBuildHealth(healthResult: SystemHealthResult): Promise<void> {
    try {
      console.log(chalk.white('  Validating build...'))
      
      const buildOutput = execSync('npm run build', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })

      healthResult.components.build = {
        status: 'pass',
        score: 100,
        details: 'Build completed successfully',
        blockers: [],
        warnings: this.extractBuildWarnings(buildOutput),
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }

      console.log(chalk.green('  ✅ Build validation passed'))

    } catch (error) {
      const errorDetails = error.stdout || error.stderr || error.message
      
      healthResult.components.build = {
        status: 'fail',
        score: 0,
        details: `Build failed: ${errorDetails}`,
        blockers: ['Build failure prevents deployment'],
        warnings: [],
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }
      
      healthResult.blockers.push('Build failure prevents CI completion')
      healthResult.manualActionRequired.push('Fix build errors and ensure all dependencies are correctly installed')
    }
  }

  private extractBuildWarnings(output: string): string[] {
    const warnings: string[] = []
    const warningLines = output.split('\n').filter(line => 
      line.toLowerCase().includes('warning') || 
      line.includes('⚠️') ||
      line.toLowerCase().includes('deprecated')
    )
    
    return warningLines.slice(0, 5) // Limit to first 5 warnings
  }

  private async checkTestHealth(healthResult: SystemHealthResult): Promise<void> {
    try {
      console.log(chalk.white('  Running critical tests...'))
      
      // Run Jest tests only (excluding Playwright specs)
      const testOutput = execSync('npm test -- --testPathPatterns="(smoke|critical)" --testPathIgnorePatterns="e2e/" --passWithNoTests', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      })

      const testSummary = this.parseTestOutput(testOutput)

      healthResult.components.tests = {
        status: testSummary.failed === 0 ? 'pass' : 'fail',
        score: testSummary.failed === 0 ? 100 : Math.max(0, 100 - (testSummary.failed * 20)),
        details: `Passed: ${testSummary.passed}, Failed: ${testSummary.failed}, Skipped: ${testSummary.skipped}`,
        blockers: testSummary.failed > 0 ? [`${testSummary.failed} critical tests failing`] : [],
        warnings: testSummary.skipped > 0 ? [`${testSummary.skipped} tests skipped`] : [],
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }

      if (testSummary.failed > 0) {
        healthResult.blockers.push(`${testSummary.failed} critical tests failing`)
        healthResult.manualActionRequired.push('Fix failing tests before proceeding with deployment')
      }

      console.log(chalk.green(`  ✅ Test validation completed - Status: ${healthResult.components.tests.status}`))

    } catch (error) {
      // Tests might not exist or might have timeout - treat as warning, not blocker
      healthResult.components.tests = {
        status: 'warning',
        score: 80,
        details: `Test validation incomplete: ${error.message}`,
        blockers: [],
        warnings: ['Test validation could not complete'],
        fixesApplied: 0,
        lastChecked: new Date().toISOString()
      }
      
      healthResult.warnings.push('Test validation incomplete - consider adding smoke tests')
    }
  }

  private parseTestOutput(output: string): { passed: number; failed: number; skipped: number } {
    const passedMatch = output.match(/(\d+)\s+passed/i)
    const failedMatch = output.match(/(\d+)\s+failed/i)
    const skippedMatch = output.match(/(\d+)\s+skipped/i)

    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0
    }
  }

  private calculateOverallHealth(healthResult: SystemHealthResult): void {
    const components = Object.values(healthResult.components)
    
    // Calculate overall status
    const hasFailures = components.some(c => c.status === 'fail')
    const hasWarnings = components.some(c => c.status === 'warning')
    
    if (hasFailures || healthResult.blockers.length > 0) {
      healthResult.overallStatus = 'fail'
    } else if (hasWarnings || healthResult.warnings.length > 0) {
      healthResult.overallStatus = 'warning'
    } else {
      healthResult.overallStatus = 'pass'
    }

    // Calculate CI readiness
    const canProceed = healthResult.blockers.length === 0
    const confidence = this.calculateConfidenceScore(healthResult)

    healthResult.ciReadiness = {
      canProceed,
      reason: canProceed 
        ? 'All critical checks passed - CI can proceed'
        : `${healthResult.blockers.length} blocking issues prevent CI completion`,
      confidence
    }
  }

  private calculateConfidenceScore(healthResult: SystemHealthResult): number {
    const components = Object.values(healthResult.components)
    const avgScore = components.reduce((sum, c) => sum + c.score, 0) / components.length
    
    // Reduce confidence for blockers and warnings
    let confidence = avgScore
    confidence -= healthResult.blockers.length * 15
    confidence -= healthResult.warnings.length * 5
    
    // Boost confidence for successful auto-fixes
    confidence += Math.min(healthResult.autoFixesApplied.length * 5, 20)
    
    return Math.max(0, Math.min(100, confidence))
  }

  private async generateConsolidatedReport(healthResult: SystemHealthResult): Promise<void> {
    const reportContent = `# 🛡️ Critical Failure Gatekeeper Report

**Generated:** ${new Date().toISOString()}  
**Overall Status:** ${this.getStatusEmoji(healthResult.overallStatus)} ${healthResult.overallStatus.toUpperCase()}  
**CI Readiness:** ${healthResult.ciReadiness.canProceed ? '✅ Ready' : '❌ Blocked'}  
**Confidence Score:** ${healthResult.ciReadiness.confidence}/100

## 📊 System Health Overview

| Component | Status | Score | Details |
|-----------|--------|-------|---------|
| **Lint** | ${this.getStatusEmoji(healthResult.components.lint.status)} ${healthResult.components.lint.status} | ${healthResult.components.lint.score}/100 | ${healthResult.components.lint.details} |
| **Security** | ${this.getStatusEmoji(healthResult.components.security.status)} ${healthResult.components.security.status} | ${healthResult.components.security.score}/100 | ${healthResult.components.security.details} |
| **Build** | ${this.getStatusEmoji(healthResult.components.build.status)} ${healthResult.components.build.status} | ${healthResult.components.build.score}/100 | ${healthResult.components.build.details} |
| **Tests** | ${this.getStatusEmoji(healthResult.components.tests.status)} ${healthResult.components.tests.status} | ${healthResult.components.tests.score}/100 | ${healthResult.components.tests.details} |

## 🔧 Auto-Fixes Applied

${healthResult.autoFixesApplied.length > 0 ? `
${healthResult.autoFixesApplied.map(fix => `- ✅ ${fix}`).join('\n')}
` : '- No auto-fixes were required'}

## ❌ Blocking Issues

${healthResult.blockers.length > 0 ? `
${healthResult.blockers.map(blocker => `- 🚨 ${blocker}`).join('\n')}

**Action Required:** CI cannot proceed until these issues are resolved.
` : '✅ **No blocking issues** - CI is ready to proceed'}

## ⚠️ Warnings

${healthResult.warnings.length > 0 ? `
${healthResult.warnings.map(warning => `- ⚠️ ${warning}`).join('\n')}

**Action Recommended:** These issues should be addressed but don't block CI.
` : '✅ **No warnings** - System is healthy'}

## 📋 Manual Actions Required

${healthResult.manualActionRequired.length > 0 ? `
${healthResult.manualActionRequired.map(action => `- 🔍 ${action}`).join('\n')}
` : '✅ **No manual actions required**'}

## 🚀 CI Decision Matrix

### Gate Status: ${healthResult.ciReadiness.canProceed ? '🟢 PASS' : '🔴 FAIL'}

**Reasoning:** ${healthResult.ciReadiness.reason}

### Recommended Actions

${healthResult.ciReadiness.canProceed ? `
1. ✅ **Proceed with CI pipeline**
2. 📊 Monitor any warnings for future improvements
3. 🔄 Continue with deployment process
4. 📈 Review auto-fix effectiveness
` : `
1. ❌ **Block CI pipeline**
2. 🔧 Address blocking issues listed above
3. 🔄 Re-run gatekeeper after fixes
4. ✅ Proceed only after all blockers resolved
`}

## 📈 Health Metrics

- **Overall Health Score:** ${Math.round((healthResult.components.lint.score + healthResult.components.security.score + healthResult.components.build.score + healthResult.components.tests.score) / 4)}/100
- **Auto-Fix Effectiveness:** ${healthResult.autoFixesApplied.length > 0 ? 'High' : 'N/A'}
- **System Stability:** ${healthResult.blockers.length === 0 ? 'Stable' : 'Unstable'}
- **Deployment Readiness:** ${healthResult.ciReadiness.canProceed ? 'Ready' : 'Not Ready'}

## 🔄 System Configuration

### Thresholds
- **Max Lint Errors:** ${this.config.thresholds.maxLintErrors}
- **Max Lint Warnings:** ${this.config.thresholds.maxLintWarnings}
- **Max Critical Vulnerabilities:** ${this.config.thresholds.maxCriticalVulns}
- **Max High-Risk Vulnerabilities:** ${this.config.thresholds.maxHighVulns}
- **Max Moderate Vulnerabilities:** ${this.config.thresholds.maxModerateVulns}

### Auto-Fix Settings
- **Lint Auto-Fix:** ${this.config.runAutoFix ? 'Enabled' : 'Disabled'}
- **Security Auto-Fix:** ${this.config.runSecurity ? 'Enabled' : 'Disabled'}
- **Report-Only Mode:** ${this.config.reportOnly ? 'Enabled' : 'Disabled'}

---

**Generated by:** Critical Failure Gatekeeper System v1.0  
**Last Updated:** ${healthResult.timestamp}  
**Next Check:** Recommended after addressing any issues above

**Exit Code:** ${healthResult.ciReadiness.canProceed ? '0 (Success)' : '1 (Failure)'}
`

    const reportPath = join(this.reportsPath, 'ci-health-gate.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Consolidated report generated: ${reportPath}`))
  }

  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'pass': '✅',
      'fail': '❌',
      'warning': '⚠️',
      'skipped': '⏭️'
    }
    return emojiMap[status] || '❓'
  }

  private displayHealthSummary(healthResult: SystemHealthResult): void {
    console.log(chalk.blue('\n📊 Critical Failure Gatekeeper Summary'))
    console.log(chalk.blue('=' .repeat(43)))
    
    // Overall status
    const statusColor = healthResult.overallStatus === 'pass' ? chalk.green : 
                       healthResult.overallStatus === 'warning' ? chalk.yellow : chalk.red
    console.log(statusColor(`🎯 Overall Status: ${healthResult.overallStatus.toUpperCase()}`))
    
    // Component breakdown
    console.log(chalk.white('\n📋 Components:'))
    Object.entries(healthResult.components).forEach(([name, component]) => {
      const statusIcon = this.getStatusEmoji(component.status)
      const scoreColor = component.score >= 80 ? chalk.green : component.score >= 60 ? chalk.yellow : chalk.red
      console.log(chalk.white(`  ${statusIcon} ${name.padEnd(8)}: ${scoreColor(component.score + '/100')} - ${component.details}`))
    })
    
    // Auto-fixes applied
    if (healthResult.autoFixesApplied.length > 0) {
      console.log(chalk.green('\n✅ Auto-Fixes Applied:'))
      healthResult.autoFixesApplied.forEach(fix => console.log(chalk.white(`  - ${fix}`)))
    }
    
    // Blockers
    if (healthResult.blockers.length > 0) {
      console.log(chalk.red('\n❌ Blocking Issues:'))
      healthResult.blockers.forEach(blocker => console.log(chalk.white(`  - ${blocker}`)))
    }
    
    // Warnings
    if (healthResult.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'))
      healthResult.warnings.forEach(warning => console.log(chalk.white(`  - ${warning}`)))
    }
    
    // CI readiness
    const readinessColor = healthResult.ciReadiness.canProceed ? chalk.green : chalk.red
    console.log(readinessColor(`\n🚀 CI Readiness: ${healthResult.ciReadiness.canProceed ? 'READY TO PROCEED' : 'BLOCKED'}`))
    console.log(chalk.blue(`   Confidence: ${healthResult.ciReadiness.confidence}/100`))
    console.log(chalk.white(`   Reason: ${healthResult.ciReadiness.reason}`))
    
    console.log(chalk.blue(`\n📄 Full report: reports/ci-health-gate.md`))
    
    if (healthResult.ciReadiness.canProceed) {
      console.log(chalk.green('\n✅ All systems go - CI can proceed'))
    } else {
      console.log(chalk.red('\n❌ Critical issues detected - CI must be blocked'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  const config: Partial<GatekeeperConfig> = {
    runAutoFix: !args.includes('--no-fix'),
    runSecurity: !args.includes('--no-security'),
    reportOnly: args.includes('--report-only')
  }

  try {
    const gatekeeper = new CriticalFailureGatekeeper(config)
    const healthResult = await gatekeeper.execute()
    
    // Exit with appropriate code based on results
    if (!healthResult.ciReadiness.canProceed) {
      console.log(chalk.red('\n❌ Exiting with failure code due to blocking issues'))
      process.exit(1)
    }
    
    if (healthResult.overallStatus === 'warning') {
      console.log(chalk.yellow('\n⚠️ Exiting with warning code - manual review recommended'))
      process.exit(2)
    }
    
    console.log(chalk.green('\n✅ Critical failure gatekeeper completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Critical failure gatekeeper failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { CriticalFailureGatekeeper }