#!/usr/bin/env tsx

import { harvestRunsRepowide } from './harvest-runs-repowide'
import { classifyFailures } from './classify-failures'  
import { assessUsefulness } from './assess-usefulness'
import { emitDrilldownReport } from './emit-drilldown-report'

function parseArgs() {
  const args = process.argv.slice(2)
  
  const sinceHoursIdx = args.indexOf('--sinceHours')
  const limitIdx = args.indexOf('--limit')
  const includeLogsIdx = args.indexOf('--includeLogs')
  const includeSuccessIdx = args.indexOf('--includeSuccess')
  const runIdsIdx = args.indexOf('--runIds')
  const helpIdx = args.indexOf('--help')
  
  if (helpIdx !== -1) {
    console.log(`
🔍 Repo-wide CI Failure Analysis Runner

Usage: npm run repowide-analysis [OPTIONS]

Options:
  --sinceHours <hours>     Hours to look back (default: 168 = 7 days)
  --limit <number>         Max runs to fetch (default: 500)
  --includeLogs <boolean>  Download logs (default: true)
  --includeSuccess <boolean> Include success run logs (default: true)
  --runIds <ids>          Comma-separated explicit run IDs to include
  --help                  Show this help

Examples:
  npm run repowide-analysis
  npm run repowide-analysis -- --sinceHours 72 --limit 200
  npm run repowide-analysis -- --runIds "18619628147,18619615676"
  
This script runs the complete repo-wide analysis pipeline:
1. Harvest all runs across repo for specified time window
2. Classify failure signatures from logs
3. Assess workflow usefulness with event tracking  
4. Generate comprehensive drilldown report
`)
    process.exit(0)
  }
  
  return {
    sinceHours: sinceHoursIdx !== -1 ? parseInt(args[sinceHoursIdx + 1]) || 168 : 168,
    limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1]) || 500 : 500,
    includeLogs: includeLogsIdx !== -1 ? args[includeLogsIdx + 1] === 'true' : true,
    includeSuccess: includeSuccessIdx !== -1 ? args[includeSuccessIdx + 1] === 'true' : true,
    runIds: runIdsIdx !== -1 ? args[runIdsIdx + 1] : ''
  }
}

async function main() {
  console.log('🚀 Starting Repo-wide CI Failure Analysis Pipeline')
  console.log('================================================')
  
  const config = parseArgs()
  
  console.log(`📊 Configuration:`)
  console.log(`  - Time window: ${config.sinceHours} hours`)
  console.log(`  - Run limit: ${config.limit}`)
  console.log(`  - Include logs: ${config.includeLogs}`)
  console.log(`  - Include success logs: ${config.includeSuccess}`)
  console.log(`  - Explicit run IDs: ${config.runIds || 'None'}`)
  
  const startTime = Date.now()
  
  try {
    // Step 1: Harvest repo-wide runs
    console.log('\n📥 STEP 1: Harvesting repo-wide runs and logs...')
    console.log('=' .repeat(50))
    
    // Set up args for harvest script
    const harvestArgs = [
      '--sinceHours', String(config.sinceHours),
      '--limit', String(config.limit),
      '--includeLogs', String(config.includeLogs),
      '--includeSuccess', String(config.includeSuccess)
    ]
    
    if (config.runIds) {
      harvestArgs.push('--runIds', config.runIds)
    }
    
    // Temporarily modify process.argv for the harvest script
    const originalArgv = process.argv
    process.argv = ['node', 'harvest-runs-repowide.ts', ...harvestArgs]
    
    await harvestRunsRepowide()
    
    // Restore original argv
    process.argv = originalArgv
    
    // Step 2: Classify failures
    console.log('\n🔍 STEP 2: Classifying failure signatures...')
    console.log('=' .repeat(50))
    
    await classifyFailures()
    
    // Step 3: Assess usefulness
    console.log('\n📊 STEP 3: Assessing workflow usefulness...')
    console.log('=' .repeat(50))
    
    await assessUsefulness()
    
    // Step 4: Generate reports
    console.log('\n📋 STEP 4: Generating drilldown reports...')
    console.log('=' .repeat(50))
    
    await emitDrilldownReport()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('\n✅ REPO-WIDE ANALYSIS COMPLETE!')
    console.log('==============================')
    console.log(`⏱️  Total time: ${duration}s`)
    console.log(`📁 Output: ci_audit/failure_drilldown/repowide/`)
    console.log(`📋 Main report: ci_audit/failure_drilldown/repowide/DRILLDOWN_REPORT.md`)
    console.log(`📊 Executive summary: ci_audit/failure_drilldown/repowide/EXECUTIVE_SUMMARY.md`)
    console.log(`📈 Detailed analysis: ci_audit/failure_drilldown/repowide/DETAILED_ANALYSIS.md`)
    console.log(`🎯 Action plan: ci_audit/failure_drilldown/repowide/ACTION_PLAN.md`)
    
  } catch (error) {
    console.error('\n❌ ANALYSIS PIPELINE FAILED')
    console.error('===========================')
    console.error('Error:', error)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure GITHUB_REPOSITORY env var is set')
    console.error('2. Verify gh CLI is authenticated')
    console.error('3. Check that the repository exists and is accessible')
    console.error('4. For permission issues, ensure the token has repo access')
    
    process.exit(1)
  }
}

// Run if this file is executed directly  
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as runRepowideAnalysis }