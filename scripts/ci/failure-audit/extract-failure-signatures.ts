#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs'

interface FailureSignature {
  pattern: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  frequency: number
  affected_workflows: string[]
  recent_occurrences: string[]
  suggested_fixes: string[]
}

interface FailureAnalysis {
  total_failures_analyzed: number
  unique_signatures: number
  signature_categories: Record<string, number>
  severity_distribution: Record<string, number>
  signatures: FailureSignature[]
  analysis_timestamp: string
  most_common_failures: FailureSignature[]
  critical_patterns: FailureSignature[]
}

async function extractFailureSignatures(): Promise<void> {
  console.log('🔍 Extracting failure signatures from logs...')
  
  // Load runs and logs data
  const runsPath = 'ci_audit/failure_forensics/runs_and_logs.json'
  if (!existsSync(runsPath)) {
    console.error('❌ runs_and_logs.json not found. Run fetch-runs-and-logs.ts first.')
    process.exit(1)
  }
  
  const runsData = JSON.parse(readFileSync(runsPath, 'utf8'))
  console.log(`📊 Analyzing failure data from ${Object.keys(runsData).length} workflows`)
  
  const signatureMap = new Map<string, FailureSignature>()
  let totalFailuresAnalyzed = 0
  
  // Process each workflow's failure data
  for (const [workflowFile, workflowData] of Object.entries(runsData)) {
    const data = workflowData as any
    console.log(`\n🔍 Analyzing ${data.workflow_name}...`)
    
    let workflowFailuresCount = 0
    
    // Process logs from each failed run
    for (const [runId, jobs] of Object.entries(data.jobs)) {
      const runLogs = data.logs[runId] || {}
      
      for (const [jobId, logContent] of Object.entries(runLogs)) {
        if (typeof logContent === 'string' && logContent.length > 0) {
          const jobFailures = extractSignaturesFromLog(logContent as string, data.workflow_name)
          
          jobFailures.forEach(signature => {
            const key = `${signature.category}:${signature.pattern}`
            
            if (signatureMap.has(key)) {
              const existing = signatureMap.get(key)!
              existing.frequency++
              existing.recent_occurrences.push(`${data.workflow_name} (Run ${runId})`)
              if (!existing.affected_workflows.includes(data.workflow_name)) {
                existing.affected_workflows.push(data.workflow_name)
              }
            } else {
              signature.affected_workflows = [data.workflow_name]
              signature.recent_occurrences = [`${data.workflow_name} (Run ${runId})`]
              signatureMap.set(key, signature)
            }
            
            workflowFailuresCount++
          })
        }
      }
    }
    
    totalFailuresAnalyzed += workflowFailuresCount
    console.log(`  📈 ${workflowFailuresCount} failure patterns extracted`)
  }
  
  // Convert to array and sort by frequency
  const signatures = Array.from(signatureMap.values())
    .sort((a, b) => b.frequency - a.frequency)
  
  // Generate analysis
  const analysis = generateAnalysis(signatures, totalFailuresAnalyzed)
  
  // Save results
  writeFileSync(
    'ci_audit/failure_forensics/failure_signatures.json',
    JSON.stringify(analysis, null, 2)
  )
  
  // Generate readable report
  const report = generateSignatureReport(analysis)
  writeFileSync(
    'ci_audit/failure_forensics/signature_analysis.md',
    report
  )
  
  console.log('\n✅ Signature extraction completed')
  console.log(`📊 Found ${analysis.unique_signatures} unique failure patterns`)
  console.log(`📈 ${analysis.total_failures_analyzed} total failure instances analyzed`)
  console.log('📄 Output: ci_audit/failure_forensics/failure_signatures.json')
  console.log('📄 Report: ci_audit/failure_forensics/signature_analysis.md')
}

function extractSignaturesFromLog(logContent: string, workflowName: string): FailureSignature[] {
  const signatures: FailureSignature[] = []
  const lines = logContent.split('\n')
  
  // Define failure patterns with categories and severity
  const patterns = [
    // Authentication & Permissions
    {
      regex: /HTTP 401|401 Unauthorized|Authentication failed|Invalid token|Token expired/i,
      category: 'authentication',
      severity: 'critical' as const,
      description: 'Authentication or authorization failure',
      fixes: ['Check token validity', 'Regenerate expired tokens', 'Verify permissions']
    },
    {
      regex: /403 Forbidden|Resource not accessible by integration|Insufficient permissions/i,
      category: 'permissions',
      severity: 'critical' as const,
      description: 'Insufficient permissions for required operation',
      fixes: ['Add required permissions to workflow', 'Check repository settings', 'Verify token scope']
    },
    
    // Network & Connectivity
    {
      regex: /Connection refused|Connection timeout|DNS resolution failed|Network unreachable/i,
      category: 'network',
      severity: 'high' as const,
      description: 'Network connectivity issues',
      fixes: ['Check service availability', 'Verify DNS resolution', 'Add retry logic']
    },
    {
      regex: /HTTP 5\d\d|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout/i,
      category: 'server_error',
      severity: 'high' as const,
      description: 'Server-side errors from external services',
      fixes: ['Check external service status', 'Add retry mechanism', 'Implement fallback']
    },
    {
      regex: /curl.*failed|HTTP request failed|Request timeout/i,
      category: 'http_request',
      severity: 'medium' as const,
      description: 'HTTP request failures',
      fixes: ['Increase timeout values', 'Add error handling', 'Verify endpoint URLs']
    },
    
    // Dependencies & Build
    {
      regex: /npm ERR!|pnpm ERR!|yarn error|Package installation failed/i,
      category: 'package_manager',
      severity: 'high' as const,
      description: 'Package manager installation failures',
      fixes: ['Clear package cache', 'Update lockfile', 'Check dependency compatibility']
    },
    {
      regex: /Module not found|Cannot resolve module|Import error|Export.*not found/i,
      category: 'module_resolution',
      severity: 'high' as const,
      description: 'Module import/export resolution failures',
      fixes: ['Check import paths', 'Verify module exists', 'Update module references']
    },
    {
      regex: /Build failed|Compilation error|TypeScript error|Syntax error/i,
      category: 'build_error',
      severity: 'high' as const,
      description: 'Build or compilation failures',
      fixes: ['Fix syntax errors', 'Resolve type issues', 'Check build configuration']
    },
    
    // Environment & Configuration
    {
      regex: /Environment variable.*not found|Missing required environment variable|Undefined environment variable/i,
      category: 'environment',
      severity: 'medium' as const,
      description: 'Missing or undefined environment variables',
      fixes: ['Define missing environment variables', 'Check .env files', 'Update workflow secrets']
    },
    {
      regex: /Configuration error|Invalid configuration|Config file not found/i,
      category: 'configuration',
      severity: 'medium' as const,
      description: 'Configuration file or setting issues',
      fixes: ['Validate configuration files', 'Check file paths', 'Update configuration']
    },
    
    // Database & Services
    {
      regex: /Database connection failed|Connection to database.*failed|ECONNREFUSED.*postgres|ECONNREFUSED.*mysql/i,
      category: 'database',
      severity: 'critical' as const,
      description: 'Database connectivity issues',
      fixes: ['Check database service status', 'Verify connection strings', 'Update credentials']
    },
    {
      regex: /Migration failed|Schema error|Table.*does not exist|Column.*does not exist/i,
      category: 'database_schema',
      severity: 'high' as const,
      description: 'Database schema or migration issues',
      fixes: ['Run pending migrations', 'Check schema definitions', 'Verify database state']
    },
    
    // File System & Resources
    {
      regex: /ENOENT.*no such file or directory|File not found|Path does not exist/i,
      category: 'file_system',
      severity: 'medium' as const,
      description: 'Missing files or directories',
      fixes: ['Check file paths', 'Ensure files exist', 'Update file references']
    },
    {
      regex: /ENOSPC.*no space left|Disk full|Out of disk space/i,
      category: 'disk_space',
      severity: 'critical' as const,
      description: 'Insufficient disk space',
      fixes: ['Clean up temporary files', 'Increase disk space', 'Optimize storage usage']
    },
    
    // Test Failures
    {
      regex: /Test failed|Tests? failing|Test suite failed|Assertion error/i,
      category: 'test_failure',
      severity: 'medium' as const,
      description: 'Unit or integration test failures',
      fixes: ['Fix failing tests', 'Update test expectations', 'Check test environment']
    },
    
    // Linting & Code Quality
    {
      regex: /ESLint.*error|Linting error|Code style violation/i,
      category: 'linting',
      severity: 'low' as const,
      description: 'Code linting or style violations',
      fixes: ['Fix linting errors', 'Update linting rules', 'Run auto-fix commands']
    },
    
    // Generic Process Failures
    {
      regex: /Process exited with code [1-9]|Command failed|Exit code [1-9]/i,
      category: 'process_exit',
      severity: 'medium' as const,
      description: 'Process or command execution failure',
      fixes: ['Check command syntax', 'Review process logs', 'Verify dependencies']
    },
    
    // Timeout Issues
    {
      regex: /Timeout|Timed out|Operation timeout|Exceeded maximum time/i,
      category: 'timeout',
      severity: 'medium' as const,
      description: 'Operation timeout failures',
      fixes: ['Increase timeout values', 'Optimize operation performance', 'Check system load']
    }
  ]
  
  // Extract matching patterns from log content
  for (const pattern of patterns) {
    const matches = lines.filter(line => pattern.regex.test(line))
    
    if (matches.length > 0) {
      // Use the most specific/detailed match as the pattern
      const representativeMatch = matches[0].trim().substring(0, 200) // Limit length
      
      signatures.push({
        pattern: representativeMatch,
        category: pattern.category,
        severity: pattern.severity,
        description: pattern.description,
        frequency: 1, // Will be aggregated later
        affected_workflows: [],
        recent_occurrences: [],
        suggested_fixes: pattern.fixes
      })
    }
  }
  
  return signatures
}

function generateAnalysis(signatures: FailureSignature[], totalFailures: number): FailureAnalysis {
  // Count categories
  const signatureCategories: Record<string, number> = {}
  const severityDistribution: Record<string, number> = {}
  
  signatures.forEach(sig => {
    signatureCategories[sig.category] = (signatureCategories[sig.category] || 0) + 1
    severityDistribution[sig.severity] = (severityDistribution[sig.severity] || 0) + 1
  })
  
  // Find most common and critical patterns
  const mostCommon = signatures
    .filter(sig => sig.frequency >= 2)
    .slice(0, 10)
  
  const critical = signatures
    .filter(sig => sig.severity === 'critical' || sig.severity === 'high')
    .slice(0, 10)
  
  return {
    total_failures_analyzed: totalFailures,
    unique_signatures: signatures.length,
    signature_categories: signatureCategories,
    severity_distribution: severityDistribution,
    signatures,
    analysis_timestamp: new Date().toISOString(),
    most_common_failures: mostCommon,
    critical_patterns: critical
  }
}

function generateSignatureReport(analysis: FailureAnalysis): string {
  const sections = [
    '# Failure Signature Analysis',
    '',
    `Generated: ${analysis.analysis_timestamp}`,
    `Total failures analyzed: ${analysis.total_failures_analyzed}`,
    `Unique failure patterns: ${analysis.unique_signatures}`,
    '',
    '## Executive Summary',
    ''
  ]
  
  // Executive summary
  const criticalCount = analysis.severity_distribution.critical || 0
  const highCount = analysis.severity_distribution.high || 0
  
  if (criticalCount > 0) {
    sections.push(`🚨 **${criticalCount} critical failure patterns** require immediate attention`)
  }
  if (highCount > 0) {
    sections.push(`⚠️ **${highCount} high-severity patterns** need resolution`)
  }
  
  sections.push('')
  sections.push('## Failure Categories')
  sections.push('')
  sections.push('| Category | Count | Percentage |')
  sections.push('|----------|-------|------------|')
  
  Object.entries(analysis.signature_categories)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      const percentage = ((count / analysis.unique_signatures) * 100).toFixed(1)
      sections.push(`| ${category} | ${count} | ${percentage}% |`)
    })
  
  sections.push('')
  sections.push('## Severity Distribution')
  sections.push('')
  sections.push('| Severity | Count | Percentage |')
  sections.push('|----------|-------|------------|')
  
  Object.entries(analysis.severity_distribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([severity, count]) => {
      const percentage = ((count / analysis.unique_signatures) * 100).toFixed(1)
      const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : severity === 'medium' ? '🟡' : '🔵'
      sections.push(`| ${emoji} ${severity} | ${count} | ${percentage}% |`)
    })
  
  // Most frequent failures
  if (analysis.most_common_failures.length > 0) {
    sections.push('')
    sections.push('## Most Frequent Failures')
    sections.push('')
    
    analysis.most_common_failures.forEach((sig, index) => {
      sections.push(`### ${index + 1}. ${sig.category} (${sig.frequency} occurrences)`)
      sections.push('')
      sections.push(`**Severity**: ${sig.severity}`)
      sections.push(`**Description**: ${sig.description}`)
      sections.push(`**Affected workflows**: ${sig.affected_workflows.join(', ')}`)
      sections.push('')
      sections.push('**Pattern**:')
      sections.push('```')
      sections.push(sig.pattern)
      sections.push('```')
      sections.push('')
      sections.push('**Suggested fixes**:')
      sig.suggested_fixes.forEach(fix => {
        sections.push(`- ${fix}`)
      })
      sections.push('')
    })
  }
  
  // Critical patterns
  if (analysis.critical_patterns.length > 0) {
    sections.push('')
    sections.push('## Critical Patterns Requiring Immediate Attention')
    sections.push('')
    
    analysis.critical_patterns
      .filter(sig => sig.severity === 'critical')
      .forEach((sig, index) => {
        sections.push(`### 🚨 Critical Issue ${index + 1}: ${sig.category}`)
        sections.push('')
        sections.push(`**Description**: ${sig.description}`)
        sections.push(`**Frequency**: ${sig.frequency} occurrences`)
        sections.push(`**Affected workflows**: ${sig.affected_workflows.join(', ')}`)
        sections.push('')
        sections.push('**Immediate actions**:')
        sig.suggested_fixes.forEach(fix => {
          sections.push(`- ${fix}`)
        })
        sections.push('')
      })
  }
  
  return sections.join('\n')
}

// Run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  extractFailureSignatures().catch(error => {
    console.error('❌ Signature extraction failed:', error)
    process.exit(1)
  })
}

export { extractFailureSignatures, FailureSignature, FailureAnalysis }