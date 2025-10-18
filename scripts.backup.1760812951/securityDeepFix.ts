#!/usr/bin/env tsx
/**
 * Security Deep Remediation Module
 * 
 * Advanced security vulnerability remediation system that:
 * - Parses npm audit JSON output for detailed vulnerability analysis
 * - Attempts safe dependency upgrades and patches
 * - Isolates risky packages when upgrades aren't feasible
 * - Generates comprehensive before/after reports
 * - Integrates with the CI auto-healing pipeline
 * 
 * Usage: tsx scripts/securityDeepFix.ts [--dry-run] [--aggressive]
 */

import { execSync } from 'child_process'
import { writeFile, mkdir, pathExists, readFile } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface VulnerabilityDetail {
  id: string
  title: string
  severity: 'critical' | 'high' | 'moderate' | 'low'
  vulnerable_versions: string
  patched_versions: string
  overview: string
  url: string
  module_name: string
  findings: Array<{
    version: string
    paths: string[]
  }>
}

interface AuditResult {
  vulnerabilities: Record<string, VulnerabilityDetail>
  metadata: {
    vulnerabilities: {
      critical: number
      high: number
      moderate: number
      low: number
      total: number
    }
    dependencies: {
      prod: number
      dev: number
      optional: number
      peer: number
      peerOptional: number
      total: number
    }
  }
}

interface PackageUpgradeAttempt {
  packageName: string
  currentVersion: string
  targetVersion: string
  upgradeType: 'patch' | 'minor' | 'major' | 'exact'
  safe: boolean
  applied: boolean
  error?: string
  vulnerabilitiesFixed: string[]
}

interface SecurityRemediationResult {
  timestamp: string
  beforeAudit: VulnerabilityTally
  afterAudit: VulnerabilityTally
  upgradeAttempts: PackageUpgradeAttempt[]
  manualReviewRequired: Array<{
    packageName: string
    severity: string
    reason: string
    recommendation: string
  }>
  summary: {
    totalVulnerabilitiesFixed: number
    totalPackagesUpgraded: number
    remainingCritical: number
    remainingHigh: number
    effectivenessScore: number
  }
}

interface VulnerabilityTally {
  critical: number
  high: number
  moderate: number
  low: number
  total: number
}

class SecurityDeepFixer {
  private reportsPath: string
  private projectRoot: string
  private dryRun: boolean
  private aggressive: boolean

  constructor(options: { dryRun?: boolean; aggressive?: boolean } = {}) {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
    this.dryRun = options.dryRun || false
    this.aggressive = options.aggressive || false
  }

  async execute(): Promise<SecurityRemediationResult> {
    console.log(chalk.blue('🛡️ Security Deep Remediation System'))
    console.log(chalk.blue('=' .repeat(40)))

    if (this.dryRun) {
      console.log(chalk.yellow('🔍 DRY-RUN MODE - No changes will be applied'))
    }

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Step 1: Get initial vulnerability assessment
      console.log(chalk.cyan('\n🔍 Step 1: Initial Vulnerability Assessment...'))
      const beforeAudit = await this.performSecurityAudit()
      
      if (beforeAudit.total === 0) {
        console.log(chalk.green('✅ No vulnerabilities found - no remediation needed'))
        return this.createCleanResult(beforeAudit)
      }

      console.log(chalk.white(`  Found ${beforeAudit.total} vulnerabilities: ${beforeAudit.critical} critical, ${beforeAudit.high} high`))

      // Step 2: Analyze vulnerabilities in detail
      console.log(chalk.cyan('\n🔬 Step 2: Detailed Vulnerability Analysis...'))
      const auditDetails = await this.getDetailedAuditData()

      // Step 3: Attempt automated fixes
      console.log(chalk.cyan('\n🔧 Step 3: Automated Remediation Attempts...'))
      const upgradeAttempts = await this.attemptAutomatedFixes(auditDetails)

      // Step 4: Re-audit after fixes
      console.log(chalk.cyan('\n📊 Step 4: Post-Remediation Assessment...'))
      const afterAudit = await this.performSecurityAudit()

      // Step 5: Identify manual review items
      console.log(chalk.cyan('\n📋 Step 5: Manual Review Analysis...'))
      const manualReviewRequired = await this.identifyManualReviewItems(auditDetails, upgradeAttempts)

      // Step 6: Generate comprehensive report
      const result: SecurityRemediationResult = {
        timestamp: new Date().toISOString(),
        beforeAudit,
        afterAudit,
        upgradeAttempts,
        manualReviewRequired,
        summary: {
          totalVulnerabilitiesFixed: beforeAudit.total - afterAudit.total,
          totalPackagesUpgraded: upgradeAttempts.filter(attempt => attempt.applied).length,
          remainingCritical: afterAudit.critical,
          remainingHigh: afterAudit.high,
          effectivenessScore: this.calculateEffectivenessScore(beforeAudit, afterAudit)
        }
      }

      await this.generateDetailedReport(result)
      await this.generateManualReviewReport(result)

      this.displaySummary(result)

      return result

    } catch (error) {
      console.error(chalk.red('❌ Security deep remediation failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async performSecurityAudit(): Promise<VulnerabilityTally> {
    try {
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      const auditData: AuditResult = JSON.parse(auditOutput)
      return auditData.metadata.vulnerabilities

    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities exist
      if (error.stdout) {
        try {
          const auditData: AuditResult = JSON.parse(error.stdout)
          return auditData.metadata.vulnerabilities
        } catch (parseError) {
          console.error('Failed to parse audit output:', parseError.message)
        }
      }
      
      // Fallback to basic parsing if JSON parsing fails
      return this.parseBasicAuditOutput(error.stdout || error.stderr || '')
    }
  }

  private parseBasicAuditOutput(output: string): VulnerabilityTally {
    const criticalMatch = output.match(/(\d+)\s+critical/i)
    const highMatch = output.match(/(\d+)\s+high/i)
    const moderateMatch = output.match(/(\d+)\s+moderate/i)
    const lowMatch = output.match(/(\d+)\s+low/i)

    const critical = criticalMatch ? parseInt(criticalMatch[1]) : 0
    const high = highMatch ? parseInt(highMatch[1]) : 0
    const moderate = moderateMatch ? parseInt(moderateMatch[1]) : 0
    const low = lowMatch ? parseInt(lowMatch[1]) : 0

    return {
      critical,
      high,
      moderate,
      low,
      total: critical + high + moderate + low
    }
  }

  private async getDetailedAuditData(): Promise<AuditResult | null> {
    try {
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return JSON.parse(auditOutput)

    } catch (error) {
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout)
        } catch (parseError) {
          console.warn(chalk.yellow('⚠️ Could not get detailed audit data, proceeding with basic remediation'))
          return null
        }
      }
      return null
    }
  }

  private async attemptAutomatedFixes(auditDetails: AuditResult | null): Promise<PackageUpgradeAttempt[]> {
    const upgradeAttempts: PackageUpgradeAttempt[] = []

    // First, try npm audit fix
    console.log(chalk.white('  Running npm audit fix...'))
    try {
      if (!this.dryRun) {
        const fixOutput = execSync('npm audit fix --force', {
          cwd: this.projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        })
        console.log(chalk.green('  ✅ npm audit fix completed'))
      } else {
        console.log(chalk.yellow('  🔍 DRY-RUN: Would run npm audit fix --force'))
      }
    } catch (error) {
      console.log(chalk.yellow('  ⚠️ npm audit fix had issues, proceeding with manual analysis'))
    }

    // If we have detailed audit data, attempt targeted fixes
    if (auditDetails && auditDetails.vulnerabilities) {
      const packageVulns = this.groupVulnerabilitiesByPackage(auditDetails.vulnerabilities)
      
      for (const [packageName, vulns] of Object.entries(packageVulns)) {
        const highestSeverity = this.getHighestSeverity(vulns)
        
        // Only attempt upgrades for critical/high severity or if aggressive mode
        if (highestSeverity === 'critical' || highestSeverity === 'high' || this.aggressive) {
          const attempt = await this.attemptPackageUpgrade(packageName, vulns)
          upgradeAttempts.push(attempt)
        }
      }
    }

    return upgradeAttempts
  }

  private groupVulnerabilitiesByPackage(vulnerabilities: Record<string, VulnerabilityDetail>): Record<string, VulnerabilityDetail[]> {
    const grouped: Record<string, VulnerabilityDetail[]> = {}
    
    for (const vuln of Object.values(vulnerabilities)) {
      const packageName = vuln.module_name
      if (!grouped[packageName]) {
        grouped[packageName] = []
      }
      grouped[packageName].push(vuln)
    }
    
    return grouped
  }

  private getHighestSeverity(vulns: VulnerabilityDetail[]): string {
    const severityOrder = ['critical', 'high', 'moderate', 'low']
    
    for (const severity of severityOrder) {
      if (vulns.some(v => v.severity === severity)) {
        return severity
      }
    }
    
    return 'low'
  }

  private async attemptPackageUpgrade(packageName: string, vulns: VulnerabilityDetail[]): Promise<PackageUpgradeAttempt> {
    const attempt: PackageUpgradeAttempt = {
      packageName,
      currentVersion: '',
      targetVersion: '',
      upgradeType: 'patch',
      safe: false,
      applied: false,
      vulnerabilitiesFixed: vulns.map(v => v.id)
    }

    try {
      // Get current version
      const packageInfo = this.getCurrentPackageVersion(packageName)
      attempt.currentVersion = packageInfo.version || 'unknown'

      // Check for available updates
      const updateInfo = await this.checkPackageUpdates(packageName)
      
      if (updateInfo.latestVersion) {
        attempt.targetVersion = updateInfo.latestVersion
        attempt.upgradeType = updateInfo.upgradeType
        attempt.safe = updateInfo.safe

        // Only attempt safe upgrades unless in aggressive mode
        if (attempt.safe || this.aggressive) {
          console.log(chalk.white(`    Attempting upgrade: ${packageName}@${attempt.currentVersion} → ${attempt.targetVersion}`))
          
          if (!this.dryRun) {
            try {
              execSync(`npm install ${packageName}@${attempt.targetVersion} --save-exact`, {
                cwd: this.projectRoot,
                stdio: 'pipe'
              })
              attempt.applied = true
              console.log(chalk.green(`    ✅ Successfully upgraded ${packageName}`))
            } catch (upgradeError) {
              attempt.error = upgradeError.message
              console.log(chalk.red(`    ❌ Failed to upgrade ${packageName}: ${upgradeError.message}`))
            }
          } else {
            console.log(chalk.yellow(`    🔍 DRY-RUN: Would upgrade ${packageName} to ${attempt.targetVersion}`))
            attempt.applied = true // Simulate success in dry-run
          }
        } else {
          console.log(chalk.yellow(`    ⚠️ Skipping risky upgrade for ${packageName} (${attempt.upgradeType} version change)`))
        }
      }

    } catch (error) {
      attempt.error = error.message
    }

    return attempt
  }

  private getCurrentPackageVersion(packageName: string): { version?: string } {
    try {
      const output = execSync(`npm list ${packageName} --depth=0 --json`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      const data = JSON.parse(output)
      return { version: data.dependencies?.[packageName]?.version }
    } catch (error) {
      return {}
    }
  }

  private async checkPackageUpdates(packageName: string): Promise<{
    latestVersion?: string
    upgradeType: 'patch' | 'minor' | 'major' | 'exact'
    safe: boolean
  }> {
    try {
      const output = execSync(`npm view ${packageName} version`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      const latestVersion = output.trim()
      const upgradeType = this.determineUpgradeType(packageName, latestVersion)
      
      return {
        latestVersion,
        upgradeType,
        safe: upgradeType === 'patch' || upgradeType === 'minor'
      }
    } catch (error) {
      return {
        upgradeType: 'exact',
        safe: false
      }
    }
  }

  private determineUpgradeType(packageName: string, targetVersion: string): 'patch' | 'minor' | 'major' | 'exact' {
    try {
      const currentInfo = this.getCurrentPackageVersion(packageName)
      if (!currentInfo.version) return 'exact'

      const current = currentInfo.version.split('.').map(n => parseInt(n))
      const target = targetVersion.split('.').map(n => parseInt(n))

      if (current[0] !== target[0]) return 'major'
      if (current[1] !== target[1]) return 'minor'
      if (current[2] !== target[2]) return 'patch'
      
      return 'exact'
    } catch (error) {
      return 'exact'
    }
  }

  private async identifyManualReviewItems(
    auditDetails: AuditResult | null,
    upgradeAttempts: PackageUpgradeAttempt[]
  ): Promise<Array<{
    packageName: string
    severity: string
    reason: string
    recommendation: string
  }>> {
    const manualReviewItems: Array<{
      packageName: string
      severity: string
      reason: string
      recommendation: string
    }> = []

    // Add failed upgrade attempts
    for (const attempt of upgradeAttempts) {
      if (!attempt.applied && attempt.error && attempt.packageName && attempt.packageName !== 'undefined') {
        manualReviewItems.push({
          packageName: attempt.packageName,
          severity: 'high',
          reason: `Automated upgrade failed: ${attempt.error}`,
          recommendation: `Manually review and upgrade ${attempt.packageName} from ${attempt.currentVersion} to ${attempt.targetVersion} or later`
        })
      }
    }

    // Add packages that weren't attempted due to major version changes
    if (auditDetails && auditDetails.vulnerabilities) {
      const attemptedPackages = new Set(upgradeAttempts.map(a => a.packageName))
      
      for (const vuln of Object.values(auditDetails.vulnerabilities)) {
        const packageName = vuln.module_name
        // Only add if we have valid package names and severity
        if (packageName && 
            packageName !== 'undefined' && 
            packageName.trim() &&
            !attemptedPackages.has(packageName) && 
            (vuln.severity === 'critical' || vuln.severity === 'high')) {
          manualReviewItems.push({
            packageName: packageName,
            severity: vuln.severity,
            reason: 'Major version upgrade required - needs manual review',
            recommendation: `Review breaking changes and manually upgrade ${packageName}. See: ${vuln.url || 'npm audit for details'}`
          })
        }
      }
    }

    return manualReviewItems
  }

  private calculateEffectivenessScore(before: VulnerabilityTally, after: VulnerabilityTally): number {
    if (before.total === 0) return 100
    
    const criticalFixedWeight = (before.critical - after.critical) * 25
    const highFixedWeight = (before.high - after.high) * 15
    const moderateFixedWeight = (before.moderate - after.moderate) * 8
    const lowFixedWeight = (before.low - after.low) * 2
    
    const totalPossibleScore = before.critical * 25 + before.high * 15 + before.moderate * 8 + before.low * 2
    const actualScore = criticalFixedWeight + highFixedWeight + moderateFixedWeight + lowFixedWeight
    
    return Math.round((actualScore / totalPossibleScore) * 100)
  }

  private async generateDetailedReport(result: SecurityRemediationResult): Promise<void> {
    const reportContent = `# 🛡️ Security Deep Remediation Report

**Generated:** ${new Date().toISOString()}  
**Remediation Mode:** ${this.dryRun ? 'DRY-RUN' : 'LIVE'}  
**Aggressive Mode:** ${this.aggressive ? 'ENABLED' : 'DISABLED'}

## 📊 Remediation Summary

| Metric | Before | After | Change |
|--------|---------|-------|--------|
| **Critical Vulnerabilities** | ${result.beforeAudit.critical} | ${result.afterAudit.critical} | ${this.getChangeIndicator(result.beforeAudit.critical, result.afterAudit.critical)} |
| **High-Risk Vulnerabilities** | ${result.beforeAudit.high} | ${result.afterAudit.high} | ${this.getChangeIndicator(result.beforeAudit.high, result.afterAudit.high)} |
| **Moderate Vulnerabilities** | ${result.beforeAudit.moderate} | ${result.afterAudit.moderate} | ${this.getChangeIndicator(result.beforeAudit.moderate, result.afterAudit.moderate)} |
| **Low-Risk Vulnerabilities** | ${result.beforeAudit.low} | ${result.afterAudit.low} | ${this.getChangeIndicator(result.beforeAudit.low, result.afterAudit.low)} |
| **Total Vulnerabilities** | ${result.beforeAudit.total} | ${result.afterAudit.total} | ${this.getChangeIndicator(result.beforeAudit.total, result.afterAudit.total)} |

### 🎯 Effectiveness Metrics
- **Vulnerabilities Fixed:** ${result.summary.totalVulnerabilitiesFixed}
- **Packages Upgraded:** ${result.summary.totalPackagesUpgraded}
- **Effectiveness Score:** ${result.summary.effectivenessScore}/100
- **Remaining Critical Issues:** ${result.summary.remainingCritical}
- **Remaining High-Risk Issues:** ${result.summary.remainingHigh}

## 🔧 Package Upgrade Attempts

| Package | Action | Status | Details |
|---------|--------|--------|---------|
${result.upgradeAttempts.map(attempt => 
  `| **${attempt.packageName}** | ${attempt.currentVersion} → ${attempt.targetVersion} (${attempt.upgradeType}) | ${attempt.applied ? '✅ Applied' : attempt.error ? '❌ Failed' : '⏭️ Skipped'} | ${attempt.error || (attempt.safe ? 'Safe upgrade' : 'Risky upgrade')} |`
).join('\n')}

## ⚠️ Manual Review Required

${result.manualReviewRequired.length > 0 ? `
${result.manualReviewRequired.map(item => `
### ${item.packageName} (${item.severity.toUpperCase()})
- **Issue:** ${item.reason}
- **Recommendation:** ${item.recommendation}
`).join('\n')}
` : '✅ **No manual review items** - All issues were automatically resolved'}

## 🚀 Next Steps

${this.generateNextSteps(result)}

## 📈 Security Posture Assessment

${this.generateSecurityPostureAssessment(result)}

---

**Generated by:** Security Deep Remediation System v1.0  
**Last Updated:** ${result.timestamp}  
**Re-run Recommended:** ${result.summary.remainingCritical > 0 || result.summary.remainingHigh > 2 ? 'Immediately after manual fixes' : 'Weekly or when new vulnerabilities detected'}
`

    const reportPath = join(this.reportsPath, 'security-deep-fix.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Detailed remediation report generated: ${reportPath}`))
  }

  private async generateManualReviewReport(result: SecurityRemediationResult): Promise<void> {
    if (result.manualReviewRequired.length === 0) {
      return // No manual review report needed
    }

    const manualReviewContent = `# 🔍 Security Manual Review Required

**Generated:** ${new Date().toISOString()}  
**Priority:** ${result.summary.remainingCritical > 0 ? 'CRITICAL' : result.summary.remainingHigh > 0 ? 'HIGH' : 'MODERATE'}

## ⚠️ Issues Requiring Manual Intervention

${result.manualReviewRequired.map((item, index) => `
### ${index + 1}. ${item.packageName}

**Severity:** ${item.severity.toUpperCase()}  
**Issue:** ${item.reason}  
**Action Required:** ${item.recommendation}

#### Steps to Resolve:
1. Research the vulnerability and proposed fixes
2. Test the upgrade in a development environment
3. Review breaking changes if it's a major version upgrade
4. Apply the fix and verify functionality
5. Re-run security audit to confirm resolution

`).join('\n')}

## 🛡️ Security Review Checklist

- [ ] Review all packages listed above
- [ ] Test proposed upgrades in development
- [ ] Check for breaking changes in major version upgrades
- [ ] Verify application functionality after upgrades
- [ ] Run full test suite after security fixes
- [ ] Re-run \`npm audit\` to confirm vulnerabilities are resolved
- [ ] Document any compatibility issues or workarounds needed

## 📋 Recommended Timeline

- **Critical Issues:** Address within 24 hours
- **High-Risk Issues:** Address within 1 week
- **Moderate Issues:** Address within 1 month

---

**Next Action:** Address the highest severity issues first, then re-run the security deep fix to reassess remaining vulnerabilities.
`

    try {
      const manualReviewPath = join(this.reportsPath, 'security-manual-review.md')
      await writeFile(manualReviewPath, manualReviewContent, 'utf-8')
      
      console.log(chalk.yellow(`📋 Manual review report generated: ${manualReviewPath}`))
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not generate manual review report: ${error.message}`))
    }
  }

  private getChangeIndicator(before: number, after: number): string {
    const diff = before - after
    if (diff > 0) return `✅ -${diff} (fixed)`
    if (diff < 0) return `⚠️ +${Math.abs(diff)} (new issues)`
    return `➖ 0 (unchanged)`
  }

  private generateNextSteps(result: SecurityRemediationResult): string {
    const steps: string[] = []

    if (result.summary.remainingCritical > 0) {
      steps.push('🚨 **URGENT:** Address remaining critical vulnerabilities immediately')
    }

    if (result.summary.remainingHigh > 2) {
      steps.push('⚠️ **HIGH PRIORITY:** Review and fix high-risk vulnerabilities')
    }

    if (result.manualReviewRequired.length > 0) {
      steps.push(`📋 **MANUAL REVIEW:** Address ${result.manualReviewRequired.length} packages requiring manual intervention`)
    }

    if (result.summary.totalPackagesUpgraded > 0) {
      steps.push('🧪 **TESTING:** Run full test suite to verify upgrades didn\'t break functionality')
    }

    steps.push('🔄 **RE-AUDIT:** Run security audit again after manual fixes')
    steps.push('📈 **MONITOR:** Set up regular security scanning to catch future vulnerabilities')

    return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  }

  private generateSecurityPostureAssessment(result: SecurityRemediationResult): string {
    let assessment = ''

    if (result.summary.effectivenessScore >= 90) {
      assessment = '🟢 **EXCELLENT** - Security posture significantly improved'
    } else if (result.summary.effectivenessScore >= 70) {
      assessment = '🟡 **GOOD** - Most vulnerabilities addressed, some manual work needed'
    } else if (result.summary.effectivenessScore >= 50) {
      assessment = '🟠 **MODERATE** - Partial improvement, significant manual work required'
    } else {
      assessment = '🔴 **POOR** - Limited improvement, extensive manual remediation needed'
    }

    const blockerStatus = result.summary.remainingCritical === 0 && result.summary.remainingHigh <= 2
      ? '✅ **CI/CD Ready** - No blocking security issues'
      : '❌ **CI/CD Blocked** - Critical or excessive high-risk vulnerabilities remain'

    return `${assessment}\n\n${blockerStatus}`
  }

  private createCleanResult(audit: VulnerabilityTally): SecurityRemediationResult {
    return {
      timestamp: new Date().toISOString(),
      beforeAudit: audit,
      afterAudit: audit,
      upgradeAttempts: [],
      manualReviewRequired: [],
      summary: {
        totalVulnerabilitiesFixed: 0,
        totalPackagesUpgraded: 0,
        remainingCritical: audit.critical,
        remainingHigh: audit.high,
        effectivenessScore: 100
      }
    }
  }

  private displaySummary(result: SecurityRemediationResult): void {
    console.log(chalk.blue('\n🛡️ Security Deep Remediation Summary'))
    console.log(chalk.blue('=' .repeat(42)))
    
    const effectivenessColor = result.summary.effectivenessScore >= 80 ? chalk.green : 
                              result.summary.effectivenessScore >= 60 ? chalk.yellow : chalk.red
    
    console.log(effectivenessColor(`🎯 Effectiveness Score: ${result.summary.effectivenessScore}/100`))
    console.log(chalk.white(`📦 Packages Upgraded: ${result.summary.totalPackagesUpgraded}`))
    console.log(chalk.white(`🔧 Vulnerabilities Fixed: ${result.summary.totalVulnerabilitiesFixed}`))
    
    const remainingColor = result.summary.remainingCritical === 0 && result.summary.remainingHigh <= 2 
      ? chalk.green : chalk.red
    
    console.log(remainingColor(`⚠️ Remaining Issues: ${result.summary.remainingCritical} critical, ${result.summary.remainingHigh} high`))
    
    if (result.manualReviewRequired.length > 0) {
      console.log(chalk.yellow(`📋 Manual Review Required: ${result.manualReviewRequired.length} packages`))
    }
    
    console.log(chalk.blue(`\n📄 Full reports: reports/security-deep-fix.md`))
    
    if (result.summary.remainingCritical === 0 && result.summary.remainingHigh <= 2) {
      console.log(chalk.green('\n✅ Security posture acceptable for CI/CD'))
    } else {
      console.log(chalk.red('\n❌ Critical security issues remain - manual intervention required'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options = {
    dryRun: args.includes('--dry-run'),
    aggressive: args.includes('--aggressive')
  }

  try {
    const securityFixer = new SecurityDeepFixer(options)
    const result = await securityFixer.execute()
    
    // Exit with appropriate code based on remaining security issues
    if (result.summary.remainingCritical > 0) {
      console.log(chalk.red('\n❌ Exiting with failure code due to critical vulnerabilities'))
      process.exit(1)
    }
    
    if (result.summary.remainingHigh > 2) {
      console.log(chalk.yellow('\n⚠️ Exiting with warning code due to high-risk vulnerabilities'))
      process.exit(2)
    }
    
    console.log(chalk.green('\n✅ Security deep remediation completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Security deep remediation failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { SecurityDeepFixer }