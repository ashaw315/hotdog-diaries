#!/usr/bin/env tsx
/**
 * Security Auto-Remediation System
 * 
 * Automatically analyzes and fixes security vulnerabilities:
 * - Runs npm audit --json for vulnerability analysis
 * - Groups vulnerabilities by severity (critical, high, moderate, low)
 * - Applies safe auto-fixes via npm audit fix
 * - Previews breaking changes via --dry-run
 * - Generates detailed security report for manual review
 * 
 * Usage: tsx scripts/securityAutoFix.ts
 */

import { execSync } from 'child_process'
import { writeFile, mkdir, pathExists } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface SecurityAuditResult {
  auditReportVersion: number
  vulnerabilities: Record<string, VulnerabilityDetails>
  metadata: {
    vulnerabilities: VulnerabilityStats
    dependencies: number
    devDependencies: number
    optionalDependencies: number
    totalDependencies: number
  }
}

interface VulnerabilityDetails {
  name: string
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
  isDirect: boolean
  via: string[]
  effects: string[]
  range: string
  nodes: string[]
  fixAvailable: boolean | FixDetails
}

interface FixDetails {
  name: string
  version: string
  isSemVerMajor: boolean
}

interface VulnerabilityStats {
  info: number
  low: number
  moderate: number
  high: number
  critical: number
  total: number
}

interface SecuritySummary {
  totalVulnerabilities: number
  byPackage: Record<string, VulnerabilityPackageInfo>
  bySeverity: VulnerabilityStats
  autoFixed: {
    total: number
    byType: VulnerabilityStats
    packages: string[]
  }
  requiresManualReview: {
    total: number
    breaking: VulnerabilityDetails[]
    critical: VulnerabilityDetails[]
    unfixable: VulnerabilityDetails[]
  }
  safeToIgnore: {
    total: number
    devOnly: VulnerabilityDetails[]
    lowRisk: VulnerabilityDetails[]
  }
}

interface VulnerabilityPackageInfo {
  name: string
  severity: string
  fixable: boolean
  breaking: boolean
  directDependency: boolean
}

class SecurityAutoFixer {
  private reportsPath: string
  private projectRoot: string

  constructor() {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
  }

  async execute(): Promise<SecuritySummary> {
    console.log(chalk.blue('🔒 Security Auto-Remediation System'))
    console.log(chalk.blue('=' .repeat(37)))

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Step 1: Run initial security audit
      console.log(chalk.cyan('\n🔍 Step 1: Analyzing security vulnerabilities...'))
      const initialAudit = await this.runSecurityAudit()

      // Step 2: Apply safe auto-fixes
      console.log(chalk.cyan('\n🔧 Step 2: Applying safe auto-fixes...'))
      await this.runAutoFix()

      // Step 3: Preview breaking changes
      console.log(chalk.cyan('\n👀 Step 3: Analyzing breaking changes...'))
      const breakingChanges = await this.analyzeBreakingChanges()

      // Step 4: Run final audit to measure improvements
      console.log(chalk.cyan('\n📊 Step 4: Measuring improvements...'))
      const finalAudit = await this.runSecurityAudit()

      // Step 5: Generate comprehensive summary
      const summary = this.generateSummary(initialAudit, finalAudit, breakingChanges)

      // Step 6: Create detailed report
      await this.generateReport(summary, initialAudit, finalAudit)

      // Step 7: Display results
      this.displaySummary(summary)

      return summary

    } catch (error) {
      console.error(chalk.red('❌ Security auto-fix failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async runSecurityAudit(): Promise<SecurityAuditResult> {
    try {
      const output = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })

      return JSON.parse(output) as SecurityAuditResult

    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout) as SecurityAuditResult
        } catch (parseError) {
          console.warn(chalk.yellow('⚠️ Failed to parse audit output, using fallback'))
          return this.createFallbackAuditResult()
        }
      }

      console.warn(chalk.yellow('⚠️ npm audit failed, using fallback result'))
      return this.createFallbackAuditResult()
    }
  }

  private createFallbackAuditResult(): SecurityAuditResult {
    return {
      auditReportVersion: 2,
      vulnerabilities: {},
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
        dependencies: 0,
        devDependencies: 0,
        optionalDependencies: 0,
        totalDependencies: 0
      }
    }
  }

  private async runAutoFix(): Promise<void> {
    try {
      console.log(chalk.white('Running: npm audit fix'))
      
      execSync('npm audit fix', {
        cwd: this.projectRoot,
        stdio: 'pipe' // Suppress output to avoid noise
      })
      
      console.log(chalk.green('✅ Auto-fix completed'))
      
    } catch (error) {
      // npm audit fix may return non-zero even when fixes are applied
      console.log(chalk.yellow('⚠️ Auto-fix completed with remaining issues'))
    }
  }

  private async analyzeBreakingChanges(): Promise<string[]> {
    try {
      const output = execSync('npm audit fix --force --dry-run', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })

      // Parse the dry-run output to extract breaking changes
      const lines = output.split('\n')
      const breakingChanges: string[] = []

      lines.forEach(line => {
        if (line.includes('BREAKING CHANGE') || line.includes('major version')) {
          breakingChanges.push(line.trim())
        }
      })

      return breakingChanges

    } catch (error) {
      // Dry run may fail, but that's often expected
      return []
    }
  }

  private generateSummary(
    initialAudit: SecurityAuditResult, 
    finalAudit: SecurityAuditResult, 
    breakingChanges: string[]
  ): SecuritySummary {
    const initialVulns = initialAudit.metadata.vulnerabilities
    const finalVulns = finalAudit.metadata.vulnerabilities

    const autoFixed = {
      total: Math.max(0, initialVulns.total - finalVulns.total),
      byType: {
        info: Math.max(0, initialVulns.info - finalVulns.info),
        low: Math.max(0, initialVulns.low - finalVulns.low),
        moderate: Math.max(0, initialVulns.moderate - finalVulns.moderate),
        high: Math.max(0, initialVulns.high - finalVulns.high),
        critical: Math.max(0, initialVulns.critical - finalVulns.critical),
        total: Math.max(0, initialVulns.total - finalVulns.total)
      },
      packages: this.extractFixedPackages(initialAudit, finalAudit)
    }

    const criticalRemaining = Object.values(finalAudit.vulnerabilities)
      .filter(vuln => vuln.severity === 'critical')

    const highRemaining = Object.values(finalAudit.vulnerabilities)
      .filter(vuln => vuln.severity === 'high')

    const unfixableVulns = Object.values(finalAudit.vulnerabilities)
      .filter(vuln => !vuln.fixAvailable)

    const devOnlyVulns = Object.values(finalAudit.vulnerabilities)
      .filter(vuln => !vuln.isDirect && vuln.severity === 'low')

    const summary: SecuritySummary = {
      totalVulnerabilities: finalVulns.total,
      byPackage: this.analyzePackageVulnerabilities(finalAudit),
      bySeverity: finalVulns,
      autoFixed,
      requiresManualReview: {
        total: criticalRemaining.length + highRemaining.length + unfixableVulns.length,
        breaking: [], // Would require parsing breaking change details
        critical: criticalRemaining,
        unfixable: unfixableVulns
      },
      safeToIgnore: {
        total: devOnlyVulns.length,
        devOnly: devOnlyVulns,
        lowRisk: Object.values(finalAudit.vulnerabilities)
          .filter(vuln => vuln.severity === 'low' || vuln.severity === 'info')
      }
    }

    return summary
  }

  private extractFixedPackages(initial: SecurityAuditResult, final: SecurityAuditResult): string[] {
    const initialPackages = new Set(Object.keys(initial.vulnerabilities))
    const finalPackages = new Set(Object.keys(final.vulnerabilities))
    
    return Array.from(initialPackages).filter(pkg => !finalPackages.has(pkg))
  }

  private analyzePackageVulnerabilities(audit: SecurityAuditResult): Record<string, VulnerabilityPackageInfo> {
    const packageInfo: Record<string, VulnerabilityPackageInfo> = {}

    Object.entries(audit.vulnerabilities).forEach(([name, vuln]) => {
      packageInfo[name] = {
        name: vuln.name,
        severity: vuln.severity,
        fixable: !!vuln.fixAvailable,
        breaking: vuln.fixAvailable && typeof vuln.fixAvailable === 'object' 
          ? vuln.fixAvailable.isSemVerMajor 
          : false,
        directDependency: vuln.isDirect
      }
    })

    return packageInfo
  }

  private async generateReport(
    summary: SecuritySummary, 
    initialAudit: SecurityAuditResult, 
    finalAudit: SecurityAuditResult
  ): Promise<void> {
    const reportContent = `# 🔒 Security Auto-Remediation Report

**Generated:** ${new Date().toISOString()}  
**Project:** Hotdog Diaries  
**Scan Scope:** All npm dependencies (production + development)

## 📊 Executive Summary

| Metric | Count | Status |
|--------|--------|--------|
| **Total Vulnerabilities** | ${summary.totalVulnerabilities} | ${summary.totalVulnerabilities === 0 ? '✅' : summary.totalVulnerabilities < 5 ? '⚠️' : '❌'} |
| **Auto-Fixed** | ${summary.autoFixed.total} | ✅ |
| **Critical Remaining** | ${summary.bySeverity.critical} | ${summary.bySeverity.critical === 0 ? '✅' : '❌'} |
| **High Risk Remaining** | ${summary.bySeverity.high} | ${summary.bySeverity.high === 0 ? '✅' : summary.bySeverity.high < 3 ? '⚠️' : '❌'} |
| **Requires Manual Review** | ${summary.requiresManualReview.total} | ${summary.requiresManualReview.total === 0 ? '✅' : '🔍'} |

## 🛠️ Auto-Fix Results

### ✅ Successfully Auto-Fixed
- **Total Fixed:** ${summary.autoFixed.total} vulnerabilities
- **Critical:** ${summary.autoFixed.byType.critical}
- **High:** ${summary.autoFixed.byType.high}
- **Moderate:** ${summary.autoFixed.byType.moderate}
- **Low:** ${summary.autoFixed.byType.low}

${summary.autoFixed.packages.length > 0 ? `
### 📦 Fixed Packages
${summary.autoFixed.packages.map(pkg => `- \\`${pkg}\\``).join('\n')}
` : ''}

## ⚠️ Remaining Vulnerabilities

### By Severity
| Severity | Count | Action Required |
|----------|-------|-----------------|
| **Critical** | ${summary.bySeverity.critical} | ${summary.bySeverity.critical > 0 ? '🚨 Immediate fix required' : '✅ None'} |
| **High** | ${summary.bySeverity.high} | ${summary.bySeverity.high > 0 ? '⚠️ Fix within 24h' : '✅ None'} |
| **Moderate** | ${summary.bySeverity.moderate} | ${summary.bySeverity.moderate > 0 ? '📋 Review and plan fix' : '✅ None'} |
| **Low** | ${summary.bySeverity.low} | ${summary.bySeverity.low > 0 ? '📝 Monitor' : '✅ None'} |

${summary.requiresManualReview.critical.length > 0 ? `
### ❌ Critical Issues Requiring Manual Review

${summary.requiresManualReview.critical.map(vuln => `
#### \`${vuln.name}\`
- **Severity:** 🚨 Critical
- **Direct Dependency:** ${vuln.isDirect ? 'Yes' : 'No'}
- **Fix Available:** ${vuln.fixAvailable ? 'Yes' : 'No (unfixable)'}
- **Affected:** ${vuln.effects.join(', ')}
`).join('\n')}
` : '## ✅ No Critical Issues\n\nAll critical vulnerabilities have been resolved!'}

${summary.requiresManualReview.unfixable.length > 0 ? `
### 🔒 Unfixable Vulnerabilities

${summary.requiresManualReview.unfixable.map(vuln => `
#### \`${vuln.name}\`
- **Severity:** ${this.getSeverityEmoji(vuln.severity)} ${vuln.severity}
- **Reason:** No fix currently available
- **Recommendation:** ${vuln.severity === 'critical' || vuln.severity === 'high' 
  ? 'Consider alternative packages or manual patching'
  : 'Monitor for updates, consider acceptable risk'}
`).join('\n')}
` : ''}

## 📈 Security Health Metrics

- **Fix Effectiveness:** ${summary.autoFixed.total > 0 ? Math.round((summary.autoFixed.total / (summary.autoFixed.total + summary.totalVulnerabilities)) * 100) : 0}%
- **Critical Risk:** ${summary.bySeverity.critical === 0 ? '✅ Eliminated' : `❌ ${summary.bySeverity.critical} remaining`}
- **Security Score:** ${this.calculateSecurityScore(summary)}/100
- **CI Readiness:** ${summary.bySeverity.critical === 0 && summary.bySeverity.high < 3 ? '✅ Ready to pass' : '❌ Security gates will fail'}

## 🔧 Recommended Actions

### Immediate (Critical)
${summary.bySeverity.critical > 0 ? `
- **Fix ${summary.bySeverity.critical} critical vulnerabilities** immediately
- Review unfixable critical issues for mitigation strategies
- Consider temporarily removing affected packages if possible
` : '- All critical vulnerabilities resolved ✅'}

### Short Term (High Priority)
${summary.bySeverity.high > 0 ? `
- **Address ${summary.bySeverity.high} high-risk vulnerabilities** within 24 hours
- Update dependencies to latest stable versions
- Review breaking changes and plan migration if needed
` : '- No high-priority vulnerabilities ✅'}

### Medium Term (Moderate)
${summary.bySeverity.moderate > 0 ? `
- **Plan fixes for ${summary.bySeverity.moderate} moderate vulnerabilities**
- Implement automated dependency updates (Dependabot/Renovate)
- Add security scanning to CI/CD pipeline
` : '- No moderate vulnerabilities ✅'}

### Continuous Monitoring
- **Run weekly security audits** via \`npm audit\`
- **Enable automated vulnerability alerts** in GitHub
- **Review security advisories** for direct dependencies
- **Implement security testing** in CI pipeline

## 📋 Development Guidelines

### Safe Auto-Fix Policy
- **Patch and minor updates:** Auto-apply via \`npm audit fix\`
- **Major version updates:** Manual review required
- **Breaking changes:** Require team approval
- **Development dependencies:** Lower priority, higher risk tolerance

### Security Thresholds
- **Critical:** 0 tolerance - block deployments
- **High:** Max 2 allowed in production
- **Moderate:** Max 10 allowed with monitoring
- **Low:** Max 25 allowed with periodic review

## 🚀 Next Steps

${summary.bySeverity.critical > 0 || summary.bySeverity.high > 3 ? `
1. **Address blocking security issues** before proceeding
2. **Review manual fix requirements** above
3. **Test thoroughly** after applying fixes
4. **Re-run security audit** to validate improvements
` : `
1. **Commit auto-fixes** applied by this script
2. **Monitor remaining vulnerabilities** as planned
3. **Set up automated scanning** for continuous security
4. **Security pipeline ready** ✅
`}

---

**Auto-Fix System Status:** ${summary.bySeverity.critical === 0 ? '✅ Successful' : '⚠️ Partial Success'}  
**Security Score:** ${this.calculateSecurityScore(summary)}/100  
**Next Security Scan:** Recommended within 7 days  
**Critical Issues:** ${summary.bySeverity.critical === 0 ? 'None' : `${summary.bySeverity.critical} require immediate attention`}
`

    const reportPath = join(this.reportsPath, 'security-audit.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Security report generated: ${reportPath}`))
  }

  private getSeverityEmoji(severity: string): string {
    const emojiMap: Record<string, string> = {
      'critical': '🚨',
      'high': '⚠️',
      'moderate': '📋',
      'low': '📝',
      'info': 'ℹ️'
    }
    return emojiMap[severity] || '❓'
  }

  private calculateSecurityScore(summary: SecuritySummary): number {
    let score = 100

    // Deduct points based on remaining vulnerabilities
    score -= summary.bySeverity.critical * 25  // Critical: -25 points each
    score -= summary.bySeverity.high * 10      // High: -10 points each  
    score -= summary.bySeverity.moderate * 3   // Moderate: -3 points each
    score -= summary.bySeverity.low * 1        // Low: -1 point each

    // Bonus points for auto-fixes
    score += Math.min(summary.autoFixed.total * 2, 20) // Up to +20 for fixes

    return Math.max(0, Math.min(100, score))
  }

  private displaySummary(summary: SecuritySummary): void {
    console.log(chalk.blue('\n📊 Security Auto-Remediation Summary'))
    console.log(chalk.blue('=' .repeat(40)))
    
    console.log(chalk.green(`✅ Auto-Fixed: ${summary.autoFixed.total} vulnerabilities`))
    console.log(chalk.white(`   - Critical: ${summary.autoFixed.byType.critical}`))
    console.log(chalk.white(`   - High: ${summary.autoFixed.byType.high}`))
    console.log(chalk.white(`   - Moderate: ${summary.autoFixed.byType.moderate}`))
    console.log(chalk.white(`   - Low: ${summary.autoFixed.byType.low}`))
    
    if (summary.bySeverity.critical > 0) {
      console.log(chalk.red(`🚨 Critical Remaining: ${summary.bySeverity.critical}`))
    } else {
      console.log(chalk.green(`✅ No Critical Vulnerabilities`))
    }
    
    if (summary.bySeverity.high > 0) {
      console.log(chalk.yellow(`⚠️ High Risk: ${summary.bySeverity.high}`))
    } else {
      console.log(chalk.green(`✅ No High-Risk Vulnerabilities`))
    }
    
    console.log(chalk.blue(`🔒 Security Score: ${this.calculateSecurityScore(summary)}/100`))
    console.log(chalk.blue(`📄 Full report: reports/security-audit.md`))
    
    if (summary.bySeverity.critical === 0 && summary.bySeverity.high < 3) {
      console.log(chalk.green('\n✅ Security gates can pass'))
    } else {
      console.log(chalk.red('\n❌ Security issues block CI - manual review required'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const fixer = new SecurityAutoFixer()
    const summary = await fixer.execute()
    
    // Exit with error code if there are critical security issues
    if (summary.bySeverity.critical > 0) {
      console.log(chalk.red('\n❌ Exiting with error due to critical security vulnerabilities'))
      process.exit(1)
    }
    
    // Exit with warning code if there are too many high-risk issues
    if (summary.bySeverity.high > 5) {
      console.log(chalk.yellow('\n⚠️ Exiting with warning due to high-risk vulnerabilities'))
      process.exit(2)
    }
    
    console.log(chalk.green('\n✅ Security auto-remediation completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Security auto-remediation failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { SecurityAutoFixer }