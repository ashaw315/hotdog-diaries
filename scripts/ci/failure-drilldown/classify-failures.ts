#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

interface FailureSignature {
  workflow: string
  runId: number
  job: string
  signature: string
  evidenceLines: string[]
  firstErrorAt: string | null
}

const SIGNATURE_BUCKETS = {
  MISSING_SECRET: /(Secret|secrets\.)[A-Z0-9_-]* (not set|missing|undefined|empty|not found)/i,
  PERMISSION: /(Resource not accessible by integration|insufficient permissions|requires write permissions|403 Forbidden)/i,
  INVALID_TRIGGER: /(deployment_status|deployment) (payload|event).*(not present|undefined|missing)/i,
  ENV_INCOMPLETE: /(Required (env|input).*(missing|not provided)|process\.env\.[A-Z0-9_]+ is undefined|Environment variable.*not found)/i,
  AUTH_TOKEN_POLICY: /(AUTH_TOKEN|TOKEN|API KEY|JWT).*(weak|invalid|must match policy|does not meet requirements|expired|malformed)/i,
  NETWORK: /(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|429 Too Many Requests|503 Service Unavailable|Connection refused|DNS resolution failed)/i,
  TIMEOUT: /(timed out after|Timeout exceeded|cancelled|Operation timeout|exceeded maximum time)/i,
  ASSERTION: /(AssertionError|Expected .* to be .*|Validation failed|Check failed|Test failed|should be|must be)/i,
  BUILD_ERROR: /(Build failed|Compilation error|TypeScript error|Cannot find module|Module not found|Import error)/i,
  PACKAGE_MANAGER: /(npm ERR!|pnpm ERR!|yarn error|lockfile|Package installation failed|dependencies)/i,
  SYNTAX_ERROR: /(SyntaxError|Unexpected token|Parsing error|Invalid syntax|Unterminated)/i,
  GITHUB_API: /(GitHub API|API rate limit|Bad credentials|Must have push access|Not Found - https:\/\/api\.github)/i,
  DEPLOYMENT_STATUS: /(deployment_status|environment_url|No TARGET_URL available|Missing Target URL)/i,
  HEALTH_CHECK: /(Health check failed|Deep health check failed|health endpoint|\/health\/(deep|auth-token))/i,
  WORKFLOW_DISPATCH: /(workflow_dispatch|workflow_run|workflow_call).*(failed|error|not found)/i
}

function extractEvidenceLines(content: string, matchIndex: number, maxLines = 3): string[] {
  const lines = content.split('\n')
  const evidenceLines: string[] = []
  
  // Find which line contains the match
  let currentIndex = 0
  let matchLineIndex = -1
  
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1 // +1 for newline
    if (currentIndex <= matchIndex && matchIndex < currentIndex + lineLength) {
      matchLineIndex = i
      break
    }
    currentIndex += lineLength
  }
  
  if (matchLineIndex === -1) {
    return []
  }
  
  // Extract context lines
  const start = Math.max(0, matchLineIndex - 1)
  const end = Math.min(lines.length, matchLineIndex + maxLines - 1)
  
  for (let i = start; i <= end && evidenceLines.length < maxLines; i++) {
    const line = lines[i].trim()
    if (line.length > 0 && line.length < 500) { // Skip empty and very long lines
      // Clean up ANSI codes and timestamps
      const cleanLine = line
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
        .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '') // Remove timestamps
        .substring(0, 200) // Truncate long lines
      
      if (cleanLine.length > 10) { // Skip very short lines
        evidenceLines.push(cleanLine)
      }
    }
  }
  
  return evidenceLines
}

function findFirstErrorTimestamp(content: string): string | null {
  // Look for common error timestamp patterns
  const timestampPatterns = [
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(ERROR|Error|error|FAIL|Failed|❌)/,
    /##\[error\].*?(\d{2}:\d{2}:\d{2})/,
    /\[(\d{2}:\d{2}:\d{2})\].*?(ERROR|Error|FAIL|Failed)/
  ]
  
  for (const pattern of timestampPatterns) {
    const match = content.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

async function main() {
  console.log('🔍 Classifying failure signatures...')
  
  // Check for repowide data first, fallback to regular data
  const repowideOutputDir = 'ci_audit/failure_drilldown/repowide'
  const regularOutputDir = 'ci_audit/failure_drilldown'
  
  let outputDir: string
  let runsPath: string
  
  if (existsSync(join(repowideOutputDir, 'runs.json'))) {
    outputDir = repowideOutputDir
    runsPath = join(repowideOutputDir, 'runs.json')
    console.log('📊 Using repowide data for classification')
  } else {
    outputDir = regularOutputDir
    runsPath = join(regularOutputDir, 'runs.json')
    console.log('📊 Using regular workflow data for classification')
  }
  
  if (!existsSync(runsPath)) {
    console.error('❌ runs.json not found. Run harvest-runs-repowide.ts or fetch-runs-and-logs.ts first.')
    process.exit(1)
  }
  
  const runs = JSON.parse(readFileSync(runsPath, 'utf8'))
  const signatures: FailureSignature[] = []
  
  console.log(`📊 Analyzing ${runs.length} runs...`)
  
  for (const run of runs) {
    // For repowide data, use workflow_id instead of workflowName for directory structure
    const workflowDirName = outputDir === repowideOutputDir 
      ? String(run.workflow_id || run.workflowId)
      : (run.workflowName || run.workflow_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    const runLogDir = join(outputDir, 'logs', workflowDirName, String(run.id || run.runId))
    
    if (!existsSync(runLogDir)) {
      continue
    }
    
    // Process each job
    for (const job of run.jobs) {
      const jobDirName = job.name.replace(/[^a-zA-Z0-9]/g, '_')
      const jobLogDir = join(runLogDir, jobDirName)
      
      if (!existsSync(jobLogDir)) {
        continue
      }
      
      // Read all log files for this job
      const logFiles = readdirSync(jobLogDir)
      const allContent = logFiles
        .map(file => {
          try {
            return readFileSync(join(jobLogDir, file), 'utf8')
          } catch {
            return ''
          }
        })
        .join('\n')
      
      if (!allContent) {
        continue
      }
      
      // Find matching signatures
      const jobSignatures: Map<string, { evidenceLines: string[], firstMatch: number }> = new Map()
      
      for (const [signatureName, pattern] of Object.entries(SIGNATURE_BUCKETS)) {
        const matches = [...allContent.matchAll(new RegExp(pattern, 'gi'))]
        
        if (matches.length > 0) {
          // Get evidence from the first match
          const firstMatch = matches[0]
          const matchIndex = firstMatch.index || 0
          const evidenceLines = extractEvidenceLines(allContent, matchIndex)
          
          if (evidenceLines.length > 0) {
            jobSignatures.set(signatureName, {
              evidenceLines,
              firstMatch: matchIndex
            })
          }
        }
      }
      
      // Take top 3 signatures by earliest occurrence
      const sortedSignatures = Array.from(jobSignatures.entries())
        .sort((a, b) => a[1].firstMatch - b[1].firstMatch)
        .slice(0, 3)
      
      // Create signature records
      for (const [signatureName, data] of sortedSignatures) {
        signatures.push({
          workflow: run.workflowName || run.workflow_name || `workflow_${run.workflow_id || run.workflowId}`,
          runId: run.runId || run.id,
          job: job.name,
          signature: signatureName,
          evidenceLines: data.evidenceLines,
          firstErrorAt: findFirstErrorTimestamp(allContent)
        })
      }
      
      if (sortedSignatures.length > 0) {
        console.log(`  ✅ ${run.workflowName || run.workflow_name || run.workflow_id} run ${run.runId || run.id} job "${job.name}": ${sortedSignatures.map(s => s[0]).join(', ')}`)
      }
    }
  }
  
  // Save classified signatures
  writeFileSync(
    join(outputDir, 'failure_signatures.json'),
    JSON.stringify(signatures, null, 2)
  )
  
  // Generate summary statistics
  const signatureCounts: Record<string, number> = {}
  const workflowSignatures: Record<string, Set<string>> = {}
  
  for (const sig of signatures) {
    signatureCounts[sig.signature] = (signatureCounts[sig.signature] || 0) + 1
    
    if (!workflowSignatures[sig.workflow]) {
      workflowSignatures[sig.workflow] = new Set()
    }
    workflowSignatures[sig.workflow].add(sig.signature)
  }
  
  console.log('\n📊 Signature Distribution:')
  for (const [sig, count] of Object.entries(signatureCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sig}: ${count} occurrences`)
  }
  
  console.log('\n📊 Workflows by dominant issues:')
  for (const [workflow, sigs] of Object.entries(workflowSignatures)) {
    console.log(`  ${workflow}: ${Array.from(sigs).join(', ')}`)
  }
  
  console.log('\n✅ Classification complete!')
  console.log(`📁 Output: ${outputDir}/failure_signatures.json`)
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as classifyFailures }