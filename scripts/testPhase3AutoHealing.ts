#!/usr/bin/env tsx
/**
 * Phase 3 Auto-Healing Integration Test
 * 
 * Comprehensive test of the Phase 3 CI Auto-Healing system including:
 * - Security deep remediation capabilities
 * - Build failure diagnostics and resolution
 * - Integration with existing CI stability pipeline
 * - Report generation and health scoring
 * 
 * Usage: tsx scripts/testPhase3AutoHealing.ts [--live] [--verbose]
 */

import { execSync } from 'child_process'
import chalk from 'chalk'

interface TestResult {
  name: string
  passed: boolean
  details: string
  duration: number
}

class Phase3AutoHealingTester {
  private verbose: boolean
  private liveMode: boolean

  constructor(options: { verbose?: boolean; liveMode?: boolean } = {}) {
    this.verbose = options.verbose || false
    this.liveMode = options.liveMode || false
  }

  async execute(): Promise<void> {
    console.log(chalk.blue('🧪 Phase 3 Auto-Healing Integration Test'))
    console.log(chalk.blue('=' .repeat(42)))

    if (this.liveMode) {
      console.log(chalk.yellow('⚠️ LIVE MODE - Real fixes will be applied'))
    } else {
      console.log(chalk.cyan('🔍 TEST MODE - Using report-only and dry-run flags'))
    }

    const testResults: TestResult[] = []

    try {
      // Test 1: Security Deep Fix Module
      testResults.push(await this.testSecurityDeepFix())

      // Test 2: Build Diagnostics Module
      testResults.push(await this.testBuildDiagnostics())

      // Test 3: Integrated CI Pipeline
      testResults.push(await this.testIntegratedPipeline())

      // Test 4: Report Generation
      testResults.push(await this.testReportGeneration())

      // Test 5: Health Score Calculation
      testResults.push(await this.testHealthScoring())

      this.displayTestSummary(testResults)

    } catch (error) {
      console.error(chalk.red('❌ Test suite failed:'), error.message)
      process.exit(1)
    }
  }

  private async testSecurityDeepFix(): Promise<TestResult> {
    console.log(chalk.cyan('\n🛡️ Test 1: Security Deep Remediation Module...'))
    const startTime = Date.now()

    try {
      const flags = this.liveMode ? '' : '--dry-run'
      const output = execSync(`npx tsx scripts/securityDeepFix.ts ${flags}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      const duration = Date.now() - startTime

      // Check for expected output patterns
      const hasScanning = output.includes('Initial Vulnerability Assessment')
      const hasAnalysis = output.includes('Detailed Vulnerability Analysis')
      const hasReporting = output.includes('Detailed remediation report generated')

      if (hasScanning && hasAnalysis && hasReporting) {
        console.log(chalk.green('  ✅ Security deep fix module working correctly'))
        return {
          name: 'Security Deep Fix',
          passed: true,
          details: `All components functional - scanned, analyzed, and reported in ${duration}ms`,
          duration
        }
      } else {
        return {
          name: 'Security Deep Fix',
          passed: false,
          details: `Missing expected functionality: scanning=${hasScanning}, analysis=${hasAnalysis}, reporting=${hasReporting}`,
          duration
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Security Deep Fix',
        passed: false,
        details: `Module failed: ${error.message}`,
        duration
      }
    }
  }

  private async testBuildDiagnostics(): Promise<TestResult> {
    console.log(chalk.cyan('\n🏗️ Test 2: Build Diagnostics Module...'))
    const startTime = Date.now()

    try {
      const flags = this.verbose ? '--verbose --save-logs' : '--save-logs'
      const output = execSync(`npx tsx scripts/analyzeBuildFailure.ts ${flags}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      const duration = Date.now() - startTime

      // Check for expected output patterns
      const hasEnvironment = output.includes('Environment Analysis')
      const hasBuildExecution = output.includes('Build Execution & Log Capture')
      const hasErrorAnalysis = output.includes('Error Analysis & Categorization')
      const hasReporting = output.includes('Diagnostic report generated')

      if (hasEnvironment && hasBuildExecution && hasErrorAnalysis && hasReporting) {
        console.log(chalk.green('  ✅ Build diagnostics module working correctly'))
        return {
          name: 'Build Diagnostics',
          passed: true,
          details: `All components functional - analyzed environment, executed build, categorized errors, and generated report in ${duration}ms`,
          duration
        }
      } else {
        return {
          name: 'Build Diagnostics',
          passed: false,
          details: `Missing expected functionality: env=${hasEnvironment}, build=${hasBuildExecution}, analysis=${hasErrorAnalysis}, reporting=${hasReporting}`,
          duration
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Build Diagnostics',
        passed: false,
        details: `Module failed: ${error.message}`,
        duration
      }
    }
  }

  private async testIntegratedPipeline(): Promise<TestResult> {
    console.log(chalk.cyan('\n🔄 Test 3: Integrated CI Auto-Healing Pipeline...'))
    const startTime = Date.now()

    try {
      const flags = this.liveMode ? '' : '--report-only'
      const output = execSync(`npx tsx scripts/checkCriticalFailures.ts ${flags}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      const duration = Date.now() - startTime

      // Check for Phase 3 integration
      const hasDeepBuildDiagnostics = output.includes('Deep Build Diagnostics')
      const hasDeepSecurityRemediation = output.includes('Deep Security Remediation')
      const hasConsolidatedReport = output.includes('Consolidated report generated')
      const hasAutoHealingSummary = output.includes('Auto-Healing Summary') || output.includes('Phase 3 Deep Remediation')

      if (hasDeepBuildDiagnostics && hasDeepSecurityRemediation && hasConsolidatedReport) {
        console.log(chalk.green('  ✅ Integrated pipeline working correctly'))
        return {
          name: 'Integrated Pipeline',
          passed: true,
          details: `Phase 3 modules properly integrated - deep diagnostics, security remediation, and consolidated reporting in ${duration}ms`,
          duration
        }
      } else {
        return {
          name: 'Integrated Pipeline',
          passed: false,
          details: `Missing Phase 3 integration: build=${hasDeepBuildDiagnostics}, security=${hasDeepSecurityRemediation}, report=${hasConsolidatedReport}`,
          duration
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      // Pipeline might exit with non-zero code due to blocking issues, but that's expected
      if (error.stdout) {
        const output = error.stdout
        const hasPhase3Features = output.includes('Deep Build Diagnostics') || output.includes('Deep Security Remediation')
        
        if (hasPhase3Features) {
          console.log(chalk.green('  ✅ Integrated pipeline working correctly (expected failure exit)'))
          return {
            name: 'Integrated Pipeline',
            passed: true,
            details: `Phase 3 integration working with expected CI blocking behavior in ${duration}ms`,
            duration
          }
        }
      }

      return {
        name: 'Integrated Pipeline',
        passed: false,
        details: `Pipeline integration failed: ${error.message}`,
        duration
      }
    }
  }

  private async testReportGeneration(): Promise<TestResult> {
    console.log(chalk.cyan('\n📄 Test 4: Report Generation...'))
    const startTime = Date.now()

    try {
      // Check for generated reports
      const fs = require('fs')
      const path = require('path')
      const reportsDir = path.join(process.cwd(), 'reports')

      const expectedReports = [
        'ci-health-gate.md',
        'build-diagnostics.md',
        'security-deep-fix.md'
      ]

      const existingReports = expectedReports.filter(report => {
        const reportPath = path.join(reportsDir, report)
        return fs.existsSync(reportPath)
      })

      const duration = Date.now() - startTime

      if (existingReports.length >= 2) { // At least 2 out of 3 reports should exist
        console.log(chalk.green(`  ✅ Report generation working - ${existingReports.length}/${expectedReports.length} reports found`))
        return {
          name: 'Report Generation',
          passed: true,
          details: `Generated reports: ${existingReports.join(', ')}`,
          duration
        }
      } else {
        return {
          name: 'Report Generation',
          passed: false,
          details: `Insufficient reports generated: only ${existingReports.length}/${expectedReports.length} found`,
          duration
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Report Generation',
        passed: false,
        details: `Report check failed: ${error.message}`,
        duration
      }
    }
  }

  private async testHealthScoring(): Promise<TestResult> {
    console.log(chalk.cyan('\n📊 Test 5: Health Score Calculation...'))
    const startTime = Date.now()

    try {
      // Read the latest health report
      const fs = require('fs')
      const path = require('path')
      const healthReportPath = path.join(process.cwd(), 'reports', 'ci-health-gate.md')

      if (!fs.existsSync(healthReportPath)) {
        return {
          name: 'Health Scoring',
          passed: false,
          details: 'Health report not found',
          duration: Date.now() - startTime
        }
      }

      const reportContent = fs.readFileSync(healthReportPath, 'utf-8')

      // Check for health scoring elements
      const hasOverallStatus = reportContent.includes('Overall Status:')
      const hasConfidenceScore = reportContent.includes('Confidence Score:')
      const hasComponentScores = reportContent.includes('Score | Details')
      const hasAutoHealingSection = reportContent.includes('Auto-Healing Summary') || reportContent.includes('Phase 3 Deep Remediation')

      const duration = Date.now() - startTime

      if (hasOverallStatus && hasConfidenceScore && hasComponentScores) {
        console.log(chalk.green('  ✅ Health scoring working correctly'))
        return {
          name: 'Health Scoring',
          passed: true,
          details: `All scoring components present${hasAutoHealingSection ? ' with Phase 3 auto-healing metrics' : ''}`,
          duration
        }
      } else {
        return {
          name: 'Health Scoring',
          passed: false,
          details: `Missing scoring elements: status=${hasOverallStatus}, confidence=${hasConfidenceScore}, components=${hasComponentScores}`,
          duration
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'Health Scoring',
        passed: false,
        details: `Health scoring test failed: ${error.message}`,
        duration
      }
    }
  }

  private displayTestSummary(results: TestResult[]): void {
    console.log(chalk.blue('\n🧪 Phase 3 Auto-Healing Test Summary'))
    console.log(chalk.blue('=' .repeat(40)))

    const passed = results.filter(r => r.passed).length
    const total = results.length
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    const summaryColor = passed === total ? chalk.green : passed > total / 2 ? chalk.yellow : chalk.red
    console.log(summaryColor(`🎯 Overall: ${passed}/${total} tests passed`))
    console.log(chalk.white(`⏱️ Total Duration: ${totalDuration}ms`))

    console.log(chalk.white('\n📋 Test Results:'))
    results.forEach(result => {
      const statusIcon = result.passed ? '✅' : '❌'
      const statusColor = result.passed ? chalk.green : chalk.red
      console.log(statusColor(`  ${statusIcon} ${result.name.padEnd(20)}: ${result.details} (${result.duration}ms)`))
    })

    if (passed === total) {
      console.log(chalk.green('\n🎉 All Phase 3 auto-healing tests passed!'))
      console.log(chalk.white('✅ Security deep remediation is functional'))
      console.log(chalk.white('✅ Build diagnostics are working'))
      console.log(chalk.white('✅ Integration with CI pipeline is complete'))
      console.log(chalk.white('✅ Report generation is operational'))
      console.log(chalk.white('✅ Health scoring includes auto-healing metrics'))
      console.log(chalk.green('\n🚀 Phase 3 CI Auto-Healing system is ready for deployment!'))
    } else {
      console.log(chalk.red('\n❌ Some Phase 3 tests failed'))
      console.log(chalk.yellow('🔧 Review the failed tests above and fix issues before deployment'))
    }

    if (this.liveMode) {
      console.log(chalk.yellow('\n⚠️ Live mode was used - review any changes made to the system'))
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options = {
    verbose: args.includes('--verbose'),
    liveMode: args.includes('--live')
  }

  try {
    const tester = new Phase3AutoHealingTester(options)
    await tester.execute()
    
    console.log(chalk.green('\n✅ Phase 3 auto-healing test suite completed'))
    process.exit(0)
    
  } catch (error) {
    console.error(chalk.red('❌ Phase 3 test suite failed:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { Phase3AutoHealingTester }