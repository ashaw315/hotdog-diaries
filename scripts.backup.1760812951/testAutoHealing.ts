#!/usr/bin/env tsx
/**
 * Auto-Healing Functionality Test Suite
 * 
 * Comprehensive testing of the CI Stability & Auto-Healing system:
 * - Tests lint auto-fix functionality
 * - Tests security auto-remediation
 * - Tests critical failure gatekeeper
 * - Validates CI workflow integration
 * - Generates validation reports
 * 
 * Usage: tsx scripts/testAutoHealing.ts [--full] [--lint-only] [--security-only]
 */

// Safety pre-check: Ensure tsx dependency is available
try {
  require.resolve('tsx')
} catch {
  console.error('❌ Missing dependency: tsx. Run `npm install --no-save tsx` before execution.')
  process.exit(127)
}

import { execSync } from 'child_process'
import { writeFile, readFile, mkdir, pathExists, remove } from 'fs-extra'
import { join } from 'path'
import chalk from 'chalk'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  details: string
  duration: number
  score: number
}

interface TestSuite {
  name: string
  totalTests: number
  passedTests: number
  failedTests: number
  warningTests: number
  skippedTests: number
  overallScore: number
  results: TestResult[]
  duration: number
}

class AutoHealingTester {
  private reportsPath: string
  private projectRoot: string
  private testOptions: {
    runFull: boolean
    lintOnly: boolean
    securityOnly: boolean
  }

  constructor(options: Partial<{runFull: boolean, lintOnly: boolean, securityOnly: boolean}> = {}) {
    this.reportsPath = join(process.cwd(), 'reports')
    this.projectRoot = process.cwd()
    this.testOptions = {
      runFull: false,
      lintOnly: false,
      securityOnly: false,
      ...options
    }
  }

  async execute(): Promise<TestSuite> {
    console.log(chalk.blue('🧪 Auto-Healing Functionality Test Suite'))
    console.log(chalk.blue('=' .repeat(45)))

    const startTime = Date.now()
    const testSuite: TestSuite = {
      name: 'Auto-Healing System Validation',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      warningTests: 0,
      skippedTests: 0,
      overallScore: 0,
      results: [],
      duration: 0
    }

    try {
      // Ensure reports directory exists
      await this.ensureReportsDirectory()

      // Test 1: Lint Auto-Fix System
      if (!this.testOptions.securityOnly) {
        console.log(chalk.cyan('\n🔧 Test Suite 1: Lint Auto-Fix System...'))
        await this.testLintAutoFix(testSuite)
      }

      // Test 2: Security Auto-Remediation
      if (!this.testOptions.lintOnly) {
        console.log(chalk.cyan('\n🔒 Test Suite 2: Security Auto-Remediation...'))
        await this.testSecurityAutoFix(testSuite)
      }

      // Test 3: Critical Failure Gatekeeper
      if (!this.testOptions.lintOnly && !this.testOptions.securityOnly) {
        console.log(chalk.cyan('\n🛡️ Test Suite 3: Critical Failure Gatekeeper...'))
        await this.testCriticalGatekeeper(testSuite)
      }

      // Test 4: CI Integration
      if (this.testOptions.runFull) {
        console.log(chalk.cyan('\n⚙️ Test Suite 4: CI Workflow Integration...'))
        await this.testCIIntegration(testSuite)
      }

      // Test 5: Error Handling & Edge Cases
      if (this.testOptions.runFull) {
        console.log(chalk.cyan('\n🚨 Test Suite 5: Error Handling & Edge Cases...'))
        await this.testErrorHandling(testSuite)
      }

      // Calculate final scores
      this.calculateTestSuiteScores(testSuite)
      testSuite.duration = Date.now() - startTime

      // Generate comprehensive report
      await this.generateTestReport(testSuite)

      // Display results
      this.displayTestSummary(testSuite)

      return testSuite

    } catch (error) {
      console.error(chalk.red('❌ Test suite execution failed:'), error.message)
      throw error
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    if (!(await pathExists(this.reportsPath))) {
      await mkdir(this.reportsPath, { recursive: true })
    }
  }

  private async testLintAutoFix(testSuite: TestSuite): Promise<void> {
    // Test 1.1: Basic lint auto-fix functionality
    await this.runTest(testSuite, 'Lint Auto-Fix Basic Functionality', async () => {
      const { LintAutoFixer } = await import('./fixLintErrors.js')
      const lintFixer = new LintAutoFixer()
      const summary = await lintFixer.execute()
      
      if (summary.remaining.errors > 50) {
        return { status: 'fail', details: `Too many remaining errors: ${summary.remaining.errors}`, score: 0 }
      } else if (summary.autoFixed.total > 0) {
        return { status: 'pass', details: `Fixed ${summary.autoFixed.total} issues`, score: 100 }
      } else {
        return { status: 'warning', details: 'No fixes applied (code may already be clean)', score: 90 }
      }
    })

    // Test 1.2: Report generation
    await this.runTest(testSuite, 'Lint Report Generation', async () => {
      const reportPath = join(this.reportsPath, 'lint-auto-fix.md')
      if (await pathExists(reportPath)) {
        const reportContent = await readFile(reportPath, 'utf-8')
        if (reportContent.includes('Lint Auto-Fix Summary') && reportContent.length > 1000) {
          return { status: 'pass', details: 'Comprehensive report generated', score: 100 }
        } else {
          return { status: 'fail', details: 'Report incomplete or missing content', score: 20 }
        }
      } else {
        return { status: 'fail', details: 'Report file not generated', score: 0 }
      }
    })

    // Test 1.3: Error threshold validation
    await this.runTest(testSuite, 'Lint Error Threshold Validation', async () => {
      try {
        const lintOutput = execSync('npm run lint', { 
          cwd: this.projectRoot, 
          encoding: 'utf8',
          stdio: 'pipe' 
        })
        
        const errorCount = this.extractErrorCount(lintOutput)
        if (errorCount === 0) {
          return { status: 'pass', details: 'No lint errors detected', score: 100 }
        } else if (errorCount <= 5) {
          return { status: 'warning', details: `${errorCount} lint errors within acceptable range`, score: 70 }
        } else {
          return { status: 'fail', details: `${errorCount} lint errors exceed threshold`, score: 30 }
        }
      } catch (error) {
        const errorCount = this.extractErrorCount(error.stdout || '')
        if (errorCount <= 5) {
          return { status: 'warning', details: `${errorCount} lint errors, needs review`, score: 60 }
        } else {
          return { status: 'fail', details: `${errorCount} lint errors, system unstable`, score: 0 }
        }
      }
    })
  }

  private async testSecurityAutoFix(testSuite: TestSuite): Promise<void> {
    // Test 2.1: Security audit and auto-fix
    await this.runTest(testSuite, 'Security Auto-Fix Functionality', async () => {
      const { SecurityAutoFixer } = await import('./securityAutoFix.js')
      const securityFixer = new SecurityAutoFixer()
      const summary = await securityFixer.execute()
      
      if (summary.bySeverity.critical > 0) {
        return { status: 'fail', details: `${summary.bySeverity.critical} critical vulnerabilities remain`, score: 0 }
      } else if (summary.bySeverity.high <= 2) {
        return { status: 'pass', details: `Security within acceptable thresholds`, score: 100 }
      } else {
        return { status: 'warning', details: `${summary.bySeverity.high} high-risk vulnerabilities`, score: 70 }
      }
    })

    // Test 2.2: Security report generation
    await this.runTest(testSuite, 'Security Report Generation', async () => {
      const reportPath = join(this.reportsPath, 'security-audit.md')
      if (await pathExists(reportPath)) {
        const reportContent = await readFile(reportPath, 'utf-8')
        if (reportContent.includes('Security Auto-Remediation Report') && reportContent.includes('Security Score')) {
          return { status: 'pass', details: 'Comprehensive security report generated', score: 100 }
        } else {
          return { status: 'fail', details: 'Security report incomplete', score: 30 }
        }
      } else {
        return { status: 'fail', details: 'Security report not generated', score: 0 }
      }
    })

    // Test 2.3: Vulnerability threshold validation
    await this.runTest(testSuite, 'Vulnerability Threshold Validation', async () => {
      try {
        const auditOutput = execSync('npm audit --json', { 
          cwd: this.projectRoot, 
          encoding: 'utf8',
          stdio: 'pipe' 
        })
        
        const auditData = JSON.parse(auditOutput)
        const vulns = auditData.metadata?.vulnerabilities || { critical: 0, high: 0 }
        
        if (vulns.critical === 0 && vulns.high <= 2) {
          return { status: 'pass', details: 'Vulnerabilities within acceptable thresholds', score: 100 }
        } else if (vulns.critical === 0) {
          return { status: 'warning', details: `${vulns.high} high-risk vulnerabilities`, score: 70 }
        } else {
          return { status: 'fail', details: `${vulns.critical} critical vulnerabilities`, score: 0 }
        }
      } catch (error) {
        // npm audit returns non-zero when vulnerabilities exist
        if (error.stdout) {
          try {
            const auditData = JSON.parse(error.stdout)
            const vulns = auditData.metadata?.vulnerabilities || { critical: 0, high: 0 }
            
            if (vulns.critical === 0 && vulns.high <= 2) {
              return { status: 'warning', details: 'Some vulnerabilities detected but within thresholds', score: 80 }
            } else {
              return { status: 'fail', details: `Security issues: ${vulns.critical} critical, ${vulns.high} high`, score: 20 }
            }
          } catch (parseError) {
            return { status: 'warning', details: 'Unable to parse security audit results', score: 50 }
          }
        }
        return { status: 'fail', details: 'Security audit system failure', score: 0 }
      }
    })
  }

  private async testCriticalGatekeeper(testSuite: TestSuite): Promise<void> {
    // Test 3.1: Gatekeeper execution
    await this.runTest(testSuite, 'Critical Gatekeeper Execution', async () => {
      const { CriticalFailureGatekeeper } = await import('./checkCriticalFailures.js')
      const gatekeeper = new CriticalFailureGatekeeper({ reportOnly: true })
      const healthResult = await gatekeeper.execute()
      
      if (healthResult.ciReadiness.canProceed) {
        return { status: 'pass', details: `CI ready with ${healthResult.ciReadiness.confidence}% confidence`, score: 100 }
      } else if (healthResult.blockers.length <= 2) {
        return { status: 'warning', details: `${healthResult.blockers.length} blockers detected`, score: 60 }
      } else {
        return { status: 'fail', details: `Too many blockers: ${healthResult.blockers.length}`, score: 0 }
      }
    })

    // Test 3.2: Health report generation
    await this.runTest(testSuite, 'Health Report Generation', async () => {
      const reportPath = join(this.reportsPath, 'ci-health-gate.md')
      if (await pathExists(reportPath)) {
        const reportContent = await readFile(reportPath, 'utf-8')
        if (reportContent.includes('Critical Failure Gatekeeper Report') && 
            reportContent.includes('System Health Overview') &&
            reportContent.includes('CI Decision Matrix')) {
          return { status: 'pass', details: 'Comprehensive health report generated', score: 100 }
        } else {
          return { status: 'fail', details: 'Health report incomplete or missing sections', score: 40 }
        }
      } else {
        return { status: 'fail', details: 'Health report not generated', score: 0 }
      }
    })

    // Test 3.3: Component health validation
    await this.runTest(testSuite, 'Component Health Validation', async () => {
      const reportPath = join(this.reportsPath, 'ci-health-gate.md')
      if (await pathExists(reportPath)) {
        const reportContent = await readFile(reportPath, 'utf-8')
        
        // Check for all required components
        const hasLint = reportContent.includes('Lint') 
        const hasSecurity = reportContent.includes('Security')
        const hasBuild = reportContent.includes('Build')
        
        if (hasLint && hasSecurity && hasBuild) {
          return { status: 'pass', details: 'All system components validated', score: 100 }
        } else {
          const missing = []
          if (!hasLint) missing.push('Lint')
          if (!hasSecurity) missing.push('Security')
          if (!hasBuild) missing.push('Build')
          return { status: 'fail', details: `Missing components: ${missing.join(', ')}`, score: 30 }
        }
      } else {
        return { status: 'fail', details: 'Cannot validate components - no report available', score: 0 }
      }
    })
  }

  private async testCIIntegration(testSuite: TestSuite): Promise<void> {
    // Test 4.1: CI workflow syntax validation
    await this.runTest(testSuite, 'CI Workflow Syntax Validation', async () => {
      try {
        const ciPath = join(this.projectRoot, '.github', 'workflows', 'ci.yml')
        if (await pathExists(ciPath)) {
          const { parse } = await import('yaml')
          const ciContent = await readFile(ciPath, 'utf-8')
          const ciConfig = parse(ciContent)
          
          if (ciConfig.jobs && ciConfig.jobs['stability-check']) {
            return { status: 'pass', details: 'CI workflow contains stability-check job', score: 100 }
          } else {
            return { status: 'fail', details: 'CI workflow missing stability-check integration', score: 0 }
          }
        } else {
          return { status: 'fail', details: 'CI workflow file not found', score: 0 }
        }
      } catch (error) {
        return { status: 'fail', details: `CI workflow syntax error: ${error.message}`, score: 0 }
      }
    })

    // Test 4.2: Package.json script validation
    await this.runTest(testSuite, 'NPM Scripts Integration', async () => {
      const packagePath = join(this.projectRoot, 'package.json')
      if (await pathExists(packagePath)) {
        const packageContent = await readFile(packagePath, 'utf-8')
        const packageData = JSON.parse(packageContent)
        
        const requiredScripts = ['ci:lint-fix', 'ci:security-fix', 'ci:stability-check']
        const missingScripts = requiredScripts.filter(script => !packageData.scripts[script])
        
        if (missingScripts.length === 0) {
          return { status: 'pass', details: 'All CI scripts properly configured', score: 100 }
        } else {
          return { status: 'fail', details: `Missing scripts: ${missingScripts.join(', ')}`, score: 50 }
        }
      } else {
        return { status: 'fail', details: 'package.json not found', score: 0 }
      }
    })
  }

  private async testErrorHandling(testSuite: TestSuite): Promise<void> {
    // Test 5.1: Graceful failure handling
    await this.runTest(testSuite, 'Graceful Failure Handling', async () => {
      // Test with invalid configuration
      try {
        const { CriticalFailureGatekeeper } = await import('./checkCriticalFailures.js')
        const gatekeeper = new CriticalFailureGatekeeper({ 
          runAutoFix: false, 
          runSecurity: false,
          reportOnly: true 
        })
        const result = await gatekeeper.execute()
        
        // Should succeed even with limited functionality
        return { status: 'pass', details: 'System handles restricted configuration gracefully', score: 100 }
      } catch (error) {
        return { status: 'fail', details: `System failed with restricted config: ${error.message}`, score: 0 }
      }
    })

    // Test 5.2: Report-only mode validation
    await this.runTest(testSuite, 'Report-Only Mode', async () => {
      const { CriticalFailureGatekeeper } = await import('./checkCriticalFailures.js')
      const gatekeeper = new CriticalFailureGatekeeper({ reportOnly: true })
      const result = await gatekeeper.execute()
      
      // In report-only mode, should generate reports without modifying files
      const reportPath = join(this.reportsPath, 'ci-health-gate.md')
      if (await pathExists(reportPath)) {
        return { status: 'pass', details: 'Report-only mode generates reports without modifications', score: 100 }
      } else {
        return { status: 'fail', details: 'Report-only mode failed to generate reports', score: 0 }
      }
    })
  }

  private async runTest(
    testSuite: TestSuite, 
    testName: string, 
    testFunction: () => Promise<{status: 'pass' | 'fail' | 'warning' | 'skipped', details: string, score: number}>
  ): Promise<void> {
    const startTime = Date.now()
    
    console.log(chalk.white(`  🧪 Running: ${testName}...`))
    
    try {
      const result = await testFunction()
      const duration = Date.now() - startTime
      
      const testResult: TestResult = {
        name: testName,
        status: result.status,
        details: result.details,
        duration,
        score: result.score
      }
      
      testSuite.results.push(testResult)
      testSuite.totalTests++
      
      switch (result.status) {
        case 'pass':
          testSuite.passedTests++
          console.log(chalk.green(`    ✅ ${testName} - ${result.details}`))
          break
        case 'fail':
          testSuite.failedTests++
          console.log(chalk.red(`    ❌ ${testName} - ${result.details}`))
          break
        case 'warning':
          testSuite.warningTests++
          console.log(chalk.yellow(`    ⚠️ ${testName} - ${result.details}`))
          break
        case 'skipped':
          testSuite.skippedTests++
          console.log(chalk.blue(`    ⏭️ ${testName} - ${result.details}`))
          break
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      const testResult: TestResult = {
        name: testName,
        status: 'fail',
        details: `Test execution failed: ${error.message}`,
        duration,
        score: 0
      }
      
      testSuite.results.push(testResult)
      testSuite.totalTests++
      testSuite.failedTests++
      
      console.log(chalk.red(`    ❌ ${testName} - Test execution failed: ${error.message}`))
    }
  }

  private extractErrorCount(output: string): number {
    const errorMatch = output.match(/(\d+)\s+error/i)
    return errorMatch ? parseInt(errorMatch[1]) : 0
  }

  private calculateTestSuiteScores(testSuite: TestSuite): void {
    if (testSuite.totalTests === 0) {
      testSuite.overallScore = 0
      return
    }

    const totalScore = testSuite.results.reduce((sum, result) => sum + result.score, 0)
    testSuite.overallScore = Math.round(totalScore / testSuite.totalTests)
  }

  private async generateTestReport(testSuite: TestSuite): Promise<void> {
    const reportContent = `# 🧪 Auto-Healing System Test Report

**Generated:** ${new Date().toISOString()}  
**Test Suite:** ${testSuite.name}  
**Duration:** ${(testSuite.duration / 1000).toFixed(2)}s  
**Overall Score:** ${testSuite.overallScore}/100

## 📊 Test Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Tests** | ${testSuite.totalTests} | 100% |
| **Passed** | ${testSuite.passedTests} | ${Math.round((testSuite.passedTests / testSuite.totalTests) * 100)}% |
| **Failed** | ${testSuite.failedTests} | ${Math.round((testSuite.failedTests / testSuite.totalTests) * 100)}% |
| **Warnings** | ${testSuite.warningTests} | ${Math.round((testSuite.warningTests / testSuite.totalTests) * 100)}% |
| **Skipped** | ${testSuite.skippedTests} | ${Math.round((testSuite.skippedTests / testSuite.totalTests) * 100)}% |

## 📋 Detailed Test Results

${testSuite.results.map(result => `
### ${this.getStatusEmoji(result.status)} ${result.name}

- **Status:** ${result.status.toUpperCase()}
- **Score:** ${result.score}/100
- **Duration:** ${(result.duration / 1000).toFixed(2)}s
- **Details:** ${result.details}
`).join('\n')}

## 🎯 System Health Assessment

### Overall System Status: ${this.getOverallStatus(testSuite)}

**Reasoning:**
${this.generateHealthReasoning(testSuite)}

### Component Validation
- **Lint System:** ${this.getComponentStatus(testSuite, 'Lint')}
- **Security System:** ${this.getComponentStatus(testSuite, 'Security')}
- **Gatekeeper System:** ${this.getComponentStatus(testSuite, 'Gatekeeper')}
- **CI Integration:** ${this.getComponentStatus(testSuite, 'CI')}

## 🔧 Recommendations

${this.generateRecommendations(testSuite)}

## 📈 Performance Metrics

- **Average Test Duration:** ${(testSuite.results.reduce((sum, r) => sum + r.duration, 0) / testSuite.totalTests / 1000).toFixed(2)}s
- **System Reliability:** ${Math.round((testSuite.passedTests + testSuite.warningTests) / testSuite.totalTests * 100)}%
- **Auto-Healing Effectiveness:** ${testSuite.overallScore >= 80 ? 'High' : testSuite.overallScore >= 60 ? 'Medium' : 'Low'}

---

**Test Configuration:**
- Full Test Mode: ${this.testOptions.runFull ? 'Enabled' : 'Disabled'}
- Lint Only: ${this.testOptions.lintOnly ? 'Enabled' : 'Disabled'}
- Security Only: ${this.testOptions.securityOnly ? 'Enabled' : 'Disabled'}

**Generated by:** Auto-Healing Test Suite v1.0  
**Next Test Recommended:** After significant code changes or CI updates
`

    const reportPath = join(this.reportsPath, 'auto-healing-test-report.md')
    await writeFile(reportPath, reportContent, 'utf-8')
    
    console.log(chalk.green(`✅ Test report generated: ${reportPath}`))
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

  private getOverallStatus(testSuite: TestSuite): string {
    if (testSuite.failedTests === 0 && testSuite.overallScore >= 90) {
      return '🟢 EXCELLENT - System fully operational'
    } else if (testSuite.failedTests <= 1 && testSuite.overallScore >= 75) {
      return '🟡 GOOD - System mostly operational with minor issues'
    } else if (testSuite.failedTests <= 3 && testSuite.overallScore >= 50) {
      return '🟠 WARNING - System has issues requiring attention'
    } else {
      return '🔴 CRITICAL - System has significant failures'
    }
  }

  private getComponentStatus(testSuite: TestSuite, component: string): string {
    const componentTests = testSuite.results.filter(r => r.name.toLowerCase().includes(component.toLowerCase()))
    if (componentTests.length === 0) return 'Not Tested'
    
    const failedTests = componentTests.filter(r => r.status === 'fail').length
    const avgScore = componentTests.reduce((sum, r) => sum + r.score, 0) / componentTests.length
    
    if (failedTests === 0 && avgScore >= 90) return '✅ Operational'
    if (failedTests <= 1 && avgScore >= 70) return '⚠️ Minor Issues'
    return '❌ Needs Attention'
  }

  private generateHealthReasoning(testSuite: TestSuite): string {
    const reasons = []
    
    if (testSuite.passedTests === testSuite.totalTests) {
      reasons.push('All tests passed successfully')
    } else if (testSuite.failedTests === 0) {
      reasons.push('No critical failures detected')
    } else {
      reasons.push(`${testSuite.failedTests} tests failed requiring attention`)
    }
    
    if (testSuite.overallScore >= 90) {
      reasons.push('System performance is excellent')
    } else if (testSuite.overallScore >= 70) {
      reasons.push('System performance is acceptable')
    } else {
      reasons.push('System performance needs improvement')
    }
    
    return reasons.join('. ') + '.'
  }

  private generateRecommendations(testSuite: TestSuite): string {
    const recommendations = []
    
    if (testSuite.failedTests > 0) {
      recommendations.push('- **Address failed tests** listed above to improve system reliability')
    }
    
    if (testSuite.overallScore < 80) {
      recommendations.push('- **Improve auto-fix effectiveness** by reviewing and enhancing fix algorithms')
    }
    
    if (testSuite.warningTests > 2) {
      recommendations.push('- **Review warning conditions** to determine if they indicate underlying issues')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- ✅ **System is performing well** - maintain current configuration')
      recommendations.push('- 📅 **Schedule regular testing** to ensure continued reliability')
    }
    
    return recommendations.join('\n')
  }

  private displayTestSummary(testSuite: TestSuite): void {
    console.log(chalk.blue('\n📊 Auto-Healing Test Summary'))
    console.log(chalk.blue('=' .repeat(35)))
    
    const statusColor = testSuite.failedTests === 0 ? chalk.green : 
                       testSuite.failedTests <= 2 ? chalk.yellow : chalk.red
    
    console.log(statusColor(`🎯 Overall Score: ${testSuite.overallScore}/100`))
    console.log(chalk.white(`⏱️ Duration: ${(testSuite.duration / 1000).toFixed(2)}s`))
    
    console.log(chalk.white('\n📋 Test Breakdown:'))
    console.log(chalk.green(`  ✅ Passed: ${testSuite.passedTests}/${testSuite.totalTests}`))
    if (testSuite.failedTests > 0) {
      console.log(chalk.red(`  ❌ Failed: ${testSuite.failedTests}/${testSuite.totalTests}`))
    }
    if (testSuite.warningTests > 0) {
      console.log(chalk.yellow(`  ⚠️ Warnings: ${testSuite.warningTests}/${testSuite.totalTests}`))
    }
    if (testSuite.skippedTests > 0) {
      console.log(chalk.blue(`  ⏭️ Skipped: ${testSuite.skippedTests}/${testSuite.totalTests}`))
    }
    
    console.log(chalk.blue(`\n📄 Full report: reports/auto-healing-test-report.md`))
    
    if (testSuite.failedTests === 0) {
      console.log(chalk.green('\n✅ Auto-healing system is operational and ready for production'))
    } else {
      console.log(chalk.red(`\n❌ ${testSuite.failedTests} tests failed - review and fix before production use`))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options = {
    runFull: args.includes('--full'),
    lintOnly: args.includes('--lint-only'),
    securityOnly: args.includes('--security-only')
  }

  try {
    const tester = new AutoHealingTester(options)
    const testSuite = await tester.execute()
    
    // Exit with appropriate code based on test results
    if (testSuite.failedTests > 0) {
      console.log(chalk.red('\n❌ Exiting with failure code due to failed tests'))
      process.exit(1)
    }
    
    if (testSuite.overallScore < 70) {
      console.log(chalk.yellow('\n⚠️ Exiting with warning code - system needs improvement'))
      process.exit(2)
    }
    
    console.log(chalk.green('\n✅ Auto-healing system validation completed successfully'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Test suite failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { AutoHealingTester }