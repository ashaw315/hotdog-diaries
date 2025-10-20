#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const DEFAULT_TARGETS = [
  ".github/workflows/auto-pr-ci-shepherd.yml",
  ".github/workflows/deploy-gate.yml", 
  ".github/workflows/post-deploy-check.yml",
  ".github/workflows/secret-validation.yml",
  ".github/workflows/deployment-gate.yml"
].join(',')

function execStep(command: string, description: string): void {
  console.log(`🔄 ${description}...`)
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    console.log(`✅ ${description} completed`)
    
    // Show important output lines
    const lines = output.split('\n').filter(line => 
      line.includes('✅') || 
      line.includes('❌') || 
      line.includes('📊') || 
      line.includes('📋') ||
      line.includes('⚠️')
    )
    
    if (lines.length > 0) {
      console.log('  Key outputs:')
      lines.slice(0, 5).forEach(line => console.log(`    ${line}`))
      if (lines.length > 5) console.log(`    ... and ${lines.length - 5} more`)
    }
  } catch (error) {
    console.error(`❌ ${description} failed:`)
    console.error(error)
    process.exit(1)
  }
}

async function main() {
  console.log('🚀 Starting Live CI Failure Analysis')
  console.log('====================================')
  
  // Parse arguments
  const args = process.argv.slice(2)
  const targetsIdx = args.indexOf('--targets')
  const windowHoursIdx = args.indexOf('--windowHours')
  const lookbackIdx = args.indexOf('--lookback')
  
  const targets = targetsIdx !== -1 ? args[targetsIdx + 1] : DEFAULT_TARGETS
  const windowHours = windowHoursIdx !== -1 ? args[windowHoursIdx + 1] : '24'
  const lookback = lookbackIdx !== -1 ? args[lookbackIdx + 1] : '20'
  
  console.log(`📊 Configuration:`)
  console.log(`  - Target workflows: ${targets.split(',').length} paths`)
  console.log(`  - Time window: ${windowHours} hours`)
  console.log(`  - Lookback limit: ${lookback} runs`)
  console.log(`  - Analysis includes: neutral, skipped, and failed runs`)
  
  // Ensure we have the required tools
  try {
    execSync('which pnpm', { stdio: 'ignore' })
  } catch {
    console.error('❌ pnpm not found. Please install pnpm first.')
    process.exit(1)
  }
  
  try {
    execSync('which gh', { stdio: 'ignore' })
  } catch {
    console.error('❌ GitHub CLI not found. Please install gh CLI first.')
    process.exit(1)
  }
  
  // Create output directory
  const outputDir = 'ci_audit/failure_drilldown'
  
  console.log('\n📸 Step 1: Live 24h Snapshot')
  console.log('=============================')
  execStep(
    `pnpm tsx scripts/ci/failure-drilldown/live-snapshot.ts --paths "${targets}" --windowHours ${windowHours}`,
    'Capturing live workflow snapshot'
  )
  
  console.log('\n📥 Step 2: Enhanced Run & Log Fetching')
  console.log('=====================================')
  execStep(
    `pnpm tsx scripts/ci/failure-drilldown/fetch-runs-and-logs.ts --paths "${targets}" --lookback ${lookback} --onlyFailed false --includeNeutral true --includeSkipped true`,
    'Fetching workflow runs and logs'
  )
  
  console.log('\n🔍 Step 3: Failure Classification')
  console.log('=================================')
  execStep(
    'pnpm tsx scripts/ci/failure-drilldown/classify-failures.ts',
    'Classifying failure signatures'
  )
  
  console.log('\n📋 Step 4: Usefulness Assessment')
  console.log('=================================')
  execStep(
    'pnpm tsx scripts/ci/failure-drilldown/assess-usefulness.ts',
    'Assessing workflow usefulness'
  )
  
  console.log('\n📝 Step 5: Report Generation')
  console.log('============================')
  execStep(
    'pnpm tsx scripts/ci/failure-drilldown/emit-drilldown-report.ts',
    'Generating comprehensive reports'
  )
  
  console.log('\n🎉 Live Analysis Complete!')
  console.log('==========================')
  console.log(`📁 All reports available in: ${outputDir}/`)
  console.log('')
  console.log('📋 Key Reports:')
  
  const reports = [
    { file: 'SNAPSHOT_MATRIX.md', desc: 'Live 24h workflow status matrix' },
    { file: 'DRILLDOWN_REPORT.md', desc: 'Main analysis report with findings' },
    { file: 'EXECUTIVE_SUMMARY.md', desc: 'High-level metrics and priorities' },
    { file: 'DETAILED_ANALYSIS.md', desc: 'In-depth workflow examination' },
    { file: 'ACTION_PLAN.md', desc: 'Prioritized remediation steps' }
  ]
  
  for (const report of reports) {
    const filePath = join(outputDir, report.file)
    if (existsSync(filePath)) {
      console.log(`  ✅ ${report.file} - ${report.desc}`)
    } else {
      console.log(`  ❌ ${report.file} - Missing`)
    }
  }
  
  console.log('')
  console.log('🔗 Quick Access:')
  console.log(`  - Matrix: ${outputDir}/SNAPSHOT_MATRIX.md`)
  console.log(`  - Report: ${outputDir}/DRILLDOWN_REPORT.md`)
  
  // Show brief summary
  try {
    const summaryPath = join(outputDir, 'summary.json')
    if (existsSync(summaryPath)) {
      const summary = JSON.parse(require('fs').readFileSync(summaryPath, 'utf8'))
      console.log('')
      console.log('📊 Quick Summary:')
      console.log(`  - Health Score: ${summary.summary?.overallHealthScore || 'N/A'}/100`)
      console.log(`  - Critical Issues: ${summary.summary?.highFailureCount || 0}`)
      console.log(`  - Workflows Analyzed: ${summary.metadata?.totalWorkflows || 0}`)
      console.log(`  - Total Runs: ${summary.metadata?.totalRuns || 0}`)
    }
  } catch {
    // Summary file might not exist, that's ok
  }
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as runLiveAnalysis }