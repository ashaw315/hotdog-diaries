#!/usr/bin/env tsx

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Creates demo repowide data for testing the enhanced CI forensics system
 * This generates realistic workflow runs, signatures, and metadata to demonstrate
 * the repowide analysis capabilities without requiring GitHub API access
 */

function generateMockWorkflows() {
  return [
    { id: 101, name: "CI Pipeline", path: ".github/workflows/ci.yml", state: "active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 102, name: "Deploy to Production", path: ".github/workflows/deploy.yml", state: "active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 103, name: "Content Scanner - Reddit", path: ".github/workflows/scan-reddit.yml", state: "active", created_at: "2024-02-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 104, name: "Content Scanner - YouTube", path: ".github/workflows/scan-youtube.yml", state: "active", created_at: "2024-02-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 105, name: "Daily Health Check", path: ".github/workflows/health-check.yml", state: "active", created_at: "2024-03-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 106, name: "Security Validation", path: ".github/workflows/security.yml", state: "active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-10-01T00:00:00Z" },
    { id: 107, name: "Old Content Scanner", path: ".github/workflows/old-scanner.yml", state: "disabled", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-05-01T00:00:00Z" }
  ]
}

function generateMockRuns() {
  const workflows = generateMockWorkflows()
  const runs = []
  const events = ['push', 'pull_request', 'schedule', 'workflow_dispatch', 'deployment_status']
  const conclusions = ['success', 'failure', 'neutral', 'skipped', 'cancelled']
  
  // Generate recent runs for last 7 days
  const now = new Date()
  const runIds = [18619628147, 18619615676, 18619563681, 18619628141, 18619685384] // Specific IDs from request
  
  // Add some runs from deleted/renamed workflows to demonstrate identity drift
  const orphanedWorkflows = [
    { id: 201, name: "Legacy CI Pipeline", path: ".github/workflows/legacy-ci.yml" },
    { id: 202, name: "Old Deploy Script", path: ".github/workflows/old-deploy.yml" }
  ]
  
  for (let i = 0; i < 150; i++) {
    // Mix in some orphaned workflow runs and potential renames
    let workflow
    if (i < 10) {
      // First 10 runs are from orphaned workflows (deleted)
      workflow = orphanedWorkflows[i % orphanedWorkflows.length]
    } else if (i < 15) {
      // Next 5 runs are from a renamed workflow (same name, different ID)
      workflow = { id: 301, name: "CI Pipeline", path: ".github/workflows/ci-old.yml" } // Renamed from "CI Pipeline"
    } else {
      workflow = workflows[i % workflows.length]
    }
    
    const hoursAgo = Math.random() * 168 // 7 days
    const runTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
    
    // Higher failure rate for content scanners and old workflows
    let conclusion = 'success'
    if (workflow.name.includes('Scanner') || workflow.name.includes('Old')) {
      conclusion = Math.random() < 0.4 ? 'failure' : (Math.random() < 0.1 ? 'neutral' : 'success')
    } else if (workflow.name.includes('Security') || workflow.name.includes('Health')) {
      conclusion = Math.random() < 0.2 ? 'failure' : (Math.random() < 0.05 ? 'neutral' : 'success')
    } else {
      conclusion = Math.random() < 0.1 ? 'failure' : 'success'
    }
    
    const run = {
      id: runIds[i % runIds.length] || (19000000 + i),
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_path: workflow.path,
      name: `${workflow.name} #${i + 1}`,
      event: events[i % events.length],
      status: 'completed',
      conclusion,
      head_branch: i % 3 === 0 ? 'main' : (i % 3 === 1 ? 'develop' : null),
      head_sha: `abc${i.toString().padStart(4, '0')}def`,
      html_url: `https://github.com/ashaw315/hotdog-diaries/actions/runs/${runIds[i % runIds.length] || (19000000 + i)}`,
      run_number: i + 1,
      created_at: runTime.toISOString(),
      updated_at: runTime.toISOString(),
      jobs: [
        {
          id: (20000000 + i * 10),
          name: conclusion === 'failure' ? 'build-and-test' : 'setup',
          status: 'completed',
          conclusion,
          started_at: runTime.toISOString(),
          completed_at: new Date(runTime.getTime() + 5 * 60 * 1000).toISOString()
        }
      ],
      primaryNonSuccessJob: conclusion !== 'success' ? 'build-and-test' : null,
      logsAvailable: conclusion !== 'success'
    }
    
    runs.push(run)
  }
  
  return runs
}

function generateMockSignatures() {
  const signatures = [
    { workflow: "Content Scanner - Reddit", runId: 18619628147, job: "scan-content", signature: "MISSING_SECRET", evidenceLines: ["Error: REDDIT_CLIENT_ID not set", "Missing required environment variable", "Authentication failed"], firstErrorAt: "10:30:15" },
    { workflow: "Content Scanner - YouTube", runId: 18619615676, job: "fetch-videos", signature: "AUTH_TOKEN_POLICY", evidenceLines: ["YouTube API key does not meet requirements", "Token validation failed", "API key must be valid"], firstErrorAt: "11:45:22" },
    { workflow: "Daily Health Check", runId: 18619563681, job: "health-endpoints", signature: "HEALTH_CHECK", evidenceLines: ["Health check failed for /health/deep", "Deep health check endpoint returned 500", "Service unavailable"], firstErrorAt: "09:15:30" },
    { workflow: "Security Validation", runId: 18619628141, job: "token-validation", signature: "AUTH_TOKEN_POLICY", evidenceLines: ["AUTH_TOKEN weak or invalid", "Token policy validation failed", "Security requirements not met"], firstErrorAt: "14:20:45" },
    { workflow: "Old Content Scanner", runId: 18619685384, job: "legacy-scan", signature: "PERMISSION", evidenceLines: ["Resource not accessible by integration", "Insufficient permissions for repository", "403 Forbidden"], firstErrorAt: "16:35:10" }
  ]
  
  return signatures
}

function generateMockAssessments() {
  return [
    {
      workflow: "CI Pipeline",
      recentFailRate: 8.5,
      dominantSignatures: ["BUILD_ERROR"],
      triggerSummary: { push: true, pull_request: true, schedule: false, workflow_dispatch: true, deployment_status: false, other: [] },
      assessment: "useful",
      rationale: "quality gate workflow with manageable failure rate (9%)",
      suggestedQuestions: ["Are GitHub API permissions correctly configured?"]
    },
    {
      workflow: "Deploy to Production", 
      recentFailRate: 0,
      dominantSignatures: [],
      triggerSummary: { push: false, pull_request: false, schedule: false, workflow_dispatch: true, deployment_status: true, other: [] },
      assessment: "necessary",
      rationale: "Critical for production safety and security",
      suggestedQuestions: []
    },
    {
      workflow: "Content Scanner - Reddit",
      recentFailRate: 65.2,
      dominantSignatures: ["MISSING_SECRET", "PERMISSION"],
      triggerSummary: { push: false, pull_request: false, schedule: true, workflow_dispatch: false, deployment_status: false, other: [] },
      assessment: "redundant",
      rationale: "Content workflow with permission issues - may be superseded",
      suggestedQuestions: ["Is this content scanner still needed?", "Can it be consolidated with other scanners?"]
    },
    {
      workflow: "Content Scanner - YouTube",
      recentFailRate: 42.1,
      dominantSignatures: ["AUTH_TOKEN_POLICY", "GITHUB_API"],
      triggerSummary: { push: false, pull_request: false, schedule: true, workflow_dispatch: true, deployment_status: false, other: [] },
      assessment: "necessary",
      rationale: "Important content management workflow but needs fixing (42% failure rate)",
      suggestedQuestions: ["Should this workflow be refactored or replaced?", "What are the current token requirements?"]
    },
    {
      workflow: "Daily Health Check",
      recentFailRate: 18.3,
      dominantSignatures: ["HEALTH_CHECK", "TIMEOUT"],
      triggerSummary: { push: false, pull_request: false, schedule: true, workflow_dispatch: false, deployment_status: false, other: [] },
      assessment: "necessary",
      rationale: "Health monitoring workflow - endpoint may need update",
      suggestedQuestions: ["Are the health endpoints correctly configured?", "Should timeout limits be increased?"]
    },
    {
      workflow: "Security Validation",
      recentFailRate: 25.0,
      dominantSignatures: ["AUTH_TOKEN_POLICY", "MISSING_SECRET"],
      triggerSummary: { push: true, pull_request: true, schedule: false, workflow_dispatch: false, deployment_status: false, other: [] },
      assessment: "necessary",
      rationale: "Critical for production safety and security",
      suggestedQuestions: ["What are the current token requirements?", "Are the required secrets still available?"]
    },
    {
      workflow: "Old Content Scanner",
      recentFailRate: 88.9,
      dominantSignatures: ["PERMISSION", "MISSING_SECRET", "OUTDATED"],
      triggerSummary: { push: false, pull_request: false, schedule: true, workflow_dispatch: false, deployment_status: false, other: [] },
      assessment: "outdated", 
      rationale: "Consistently failing (89% failure rate) - likely outdated",
      suggestedQuestions: ["When was this workflow last successfully used?", "What system or process replaced this?"]
    }
  ]
}

async function main() {
  console.log('🎭 Generating demo repowide data for CI forensics testing...')
  
  const outputDir = 'ci_audit/failure_drilldown/repowide'
  mkdirSync(outputDir, { recursive: true })
  
  // Generate mock data
  const workflows = generateMockWorkflows()
  const runs = generateMockRuns()
  const signatures = generateMockSignatures()
  const assessments = generateMockAssessments()
  
  // Create harvest summary
  const summary = {
    generated: new Date().toISOString(),
    timeWindow: {
      sinceHours: 168,
      cutoffTime: new Date(Date.now() - 168 * 60 * 60 * 1000).toISOString()
    },
    totals: {
      workflows: workflows.length,
      runs: runs.length,
      explicitRuns: 5,
      logsDownloaded: runs.filter(r => r.logsAvailable).length
    },
    conclusions: {
      success: runs.filter(r => r.conclusion === 'success').length,
      failure: runs.filter(r => r.conclusion === 'failure').length,
      neutral: runs.filter(r => r.conclusion === 'neutral').length,
      skipped: runs.filter(r => r.conclusion === 'skipped').length,
      cancelled: runs.filter(r => r.conclusion === 'cancelled').length,
      other: runs.filter(r => !['success', 'failure', 'neutral', 'skipped', 'cancelled'].includes(r.conclusion || '')).length
    },
    events: Object.entries(
      runs.reduce((acc: Record<string, number>, run) => {
        acc[run.event] = (acc[run.event] || 0) + 1
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1])
  }
  
  // Save all data files
  writeFileSync(join(outputDir, 'workflows.json'), JSON.stringify(workflows, null, 2))
  writeFileSync(join(outputDir, 'runs.json'), JSON.stringify(runs, null, 2))
  writeFileSync(join(outputDir, 'failure_signatures.json'), JSON.stringify(signatures, null, 2))
  writeFileSync(join(outputDir, 'workflow_assessments.json'), JSON.stringify(assessments, null, 2))
  writeFileSync(join(outputDir, 'harvest_summary.json'), JSON.stringify(summary, null, 2))
  
  console.log('✅ Demo repowide data generated!')
  console.log(`📁 Output directory: ${outputDir}/`)
  console.log(`📊 Summary:`)
  console.log(`  - ${summary.totals.workflows} workflows`)
  console.log(`  - ${summary.totals.runs} runs (${summary.totals.explicitRuns} explicit)`)
  console.log(`  - ${summary.totals.logsDownloaded} logs simulated`)
  console.log(`  - Conclusions: ${summary.conclusions.success}✅ ${summary.conclusions.failure}❌ ${summary.conclusions.neutral}⚠️`)
  console.log(`  - Top events: ${summary.events.slice(0, 3).map(([event, count]) => `${event}(${count})`).join(', ')}`)
  
  console.log('\n🎯 Next: Run the report generator to see repowide analysis!')
  console.log('npx tsx scripts/ci/failure-drilldown/emit-drilldown-report.ts')
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as generateDemoRepowideData }