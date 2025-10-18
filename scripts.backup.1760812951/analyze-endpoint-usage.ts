#!/usr/bin/env tsx

/**
 * Endpoint Usage Analysis Script
 * Analyzes database logs to track deprecated vs. consolidated endpoint usage
 */

import { db } from '../lib/db'
import { promises as fs } from 'fs'
import { DEPRECATED_ENDPOINTS } from '../lib/api-deprecation'

interface EndpointUsageStats {
  endpoint: string
  totalCalls: number
  uniqueIPs: number
  firstSeen: string
  lastSeen: string
  userAgents: string[]
  isDeprecated: boolean
  replacementEndpoint?: string
}

interface UsageAnalysis {
  summary: {
    totalRequests: number
    deprecatedRequests: number
    consolidatedRequests: number
    migrationProgress: number // percentage
  }
  deprecatedEndpoints: EndpointUsageStats[]
  consolidatedEndpoints: EndpointUsageStats[]
  recommendations: string[]
}

async function analyzeEndpointUsage(): Promise<UsageAnalysis> {
  try {
    console.log('📊 Analyzing endpoint usage patterns...')
    
    await db.connect()
    
    // Query system logs for API endpoint usage
    const endpointLogsQuery = `
      SELECT 
        log_data->>'endpoint' as endpoint,
        log_data->>'method' as method,
        log_data->>'userAgent' as user_agent,
        log_data->>'clientIP' as client_ip,
        created_at,
        log_message,
        log_level
      FROM system_logs 
      WHERE log_type IN ('API_REQUEST', 'DEPRECATED_ENDPOINT_USAGE')
        AND created_at >= datetime('now', '-7 days')
      ORDER BY created_at DESC
    `
    
    const logs = await db.query(endpointLogsQuery)
    console.log(`📋 Found ${logs.rows.length} API usage logs from last 7 days`)
    
    // Process logs to build usage statistics
    const endpointStats = new Map<string, {
      calls: number
      ips: Set<string>
      firstSeen: Date
      lastSeen: Date
      userAgents: Set<string>
      isDeprecated: boolean
    }>()
    
    for (const log of logs.rows) {
      const endpoint = log.endpoint || extractEndpointFromMessage(log.log_message)
      if (!endpoint) continue
      
      const isDeprecated = log.log_level === 'WARNING' || 
                          log.log_type === 'DEPRECATED_ENDPOINT_USAGE' ||
                          Object.keys(DEPRECATED_ENDPOINTS).includes(endpoint)
      
      if (!endpointStats.has(endpoint)) {
        endpointStats.set(endpoint, {
          calls: 0,
          ips: new Set(),
          firstSeen: new Date(log.created_at),
          lastSeen: new Date(log.created_at),
          userAgents: new Set(),
          isDeprecated
        })
      }
      
      const stats = endpointStats.get(endpoint)!
      stats.calls++
      if (log.client_ip) stats.ips.add(log.client_ip)
      if (log.user_agent) stats.userAgents.add(log.user_agent)
      
      const logDate = new Date(log.created_at)
      if (logDate < stats.firstSeen) stats.firstSeen = logDate
      if (logDate > stats.lastSeen) stats.lastSeen = logDate
    }
    
    // Convert to structured format
    const deprecatedEndpoints: EndpointUsageStats[] = []
    const consolidatedEndpoints: EndpointUsageStats[] = []
    
    for (const [endpoint, stats] of endpointStats.entries()) {
      const usageStats: EndpointUsageStats = {
        endpoint,
        totalCalls: stats.calls,
        uniqueIPs: stats.ips.size,
        firstSeen: stats.firstSeen.toISOString(),
        lastSeen: stats.lastSeen.toISOString(),
        userAgents: Array.from(stats.userAgents),
        isDeprecated: stats.isDeprecated,
        replacementEndpoint: DEPRECATED_ENDPOINTS[endpoint]?.replacementEndpoint
      }
      
      if (stats.isDeprecated) {
        deprecatedEndpoints.push(usageStats)
      } else {
        consolidatedEndpoints.push(usageStats)
      }
    }
    
    // Calculate summary statistics
    const totalRequests = Array.from(endpointStats.values()).reduce((sum, stats) => sum + stats.calls, 0)
    const deprecatedRequests = deprecatedEndpoints.reduce((sum, ep) => sum + ep.totalCalls, 0)
    const consolidatedRequests = consolidatedEndpoints.reduce((sum, ep) => sum + ep.totalCalls, 0)
    const migrationProgress = totalRequests > 0 ? (consolidatedRequests / totalRequests) * 100 : 0
    
    // Generate recommendations
    const recommendations = generateRecommendations(deprecatedEndpoints, consolidatedEndpoints, migrationProgress)
    
    await db.disconnect()
    
    return {
      summary: {
        totalRequests,
        deprecatedRequests,
        consolidatedRequests,
        migrationProgress: Math.round(migrationProgress * 100) / 100
      },
      deprecatedEndpoints: deprecatedEndpoints.sort((a, b) => b.totalCalls - a.totalCalls),
      consolidatedEndpoints: consolidatedEndpoints.sort((a, b) => b.totalCalls - a.totalCalls),
      recommendations
    }
    
  } catch (error) {
    console.error('❌ Error analyzing endpoint usage:', error)
    throw error
  }
}

function extractEndpointFromMessage(message: string): string | null {
  // Try to extract endpoint from log messages
  const patterns = [
    /endpoint ([\/\w\-\[\]]+) was accessed/,
    /API request to ([\/\w\-\[\]]+)/,
    /Deprecated endpoint ([\/\w\-\[\]]+)/
  ]
  
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) return match[1]
  }
  
  return null
}

function generateRecommendations(
  deprecated: EndpointUsageStats[], 
  consolidated: EndpointUsageStats[], 
  migrationProgress: number
): string[] {
  const recommendations: string[] = []
  
  if (migrationProgress < 50) {
    recommendations.push('🔄 Migration is less than 50% complete. Prioritize updating high-traffic deprecated endpoints.')
  } else if (migrationProgress < 80) {
    recommendations.push('⚡ Migration is progressing well. Focus on remaining deprecated endpoints.')
  } else {
    recommendations.push('🎉 Migration is nearly complete! Consider scheduling deprecated endpoint removal.')
  }
  
  // High-traffic deprecated endpoints
  const highTrafficDeprecated = deprecated.filter(ep => ep.totalCalls > 10)
  if (highTrafficDeprecated.length > 0) {
    recommendations.push(`🔥 High-traffic deprecated endpoints need immediate attention: ${highTrafficDeprecated.slice(0, 3).map(ep => ep.endpoint).join(', ')}`)
  }
  
  // Recent deprecated usage
  const recentDeprecated = deprecated.filter(ep => {
    const lastSeen = new Date(ep.lastSeen)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return lastSeen > oneDayAgo
  })
  
  if (recentDeprecated.length > 0) {
    recommendations.push(`⚠️  ${recentDeprecated.length} deprecated endpoints used in last 24 hours - frontend migration may be incomplete`)
  }
  
  if (migrationProgress > 95) {
    recommendations.push('✅ Migration nearly complete! Safe to proceed with deprecated endpoint removal.')
  }
  
  return recommendations
}

async function generateUsageReport(analysis: UsageAnalysis): Promise<void> {
  const report = `# API Endpoint Usage Analysis Report
Generated: ${new Date().toISOString()}

## Summary Statistics

- **Total API Requests (7 days):** ${analysis.summary.totalRequests.toLocaleString()}
- **Deprecated Endpoint Requests:** ${analysis.summary.deprecatedRequests.toLocaleString()} 
- **Consolidated Endpoint Requests:** ${analysis.summary.consolidatedRequests.toLocaleString()}
- **Migration Progress:** ${analysis.summary.migrationProgress}%

## Migration Health Status

${analysis.summary.migrationProgress > 95 ? '🟢 **EXCELLENT**' : 
  analysis.summary.migrationProgress > 80 ? '🟡 **GOOD**' : 
  analysis.summary.migrationProgress > 50 ? '🟠 **NEEDS ATTENTION**' : 
  '🔴 **CRITICAL**'} - ${analysis.summary.migrationProgress}% of requests using consolidated endpoints

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Deprecated Endpoints Still in Use

${analysis.deprecatedEndpoints.length === 0 ? 
  '✅ **No deprecated endpoints detected in recent usage!**' :
  analysis.deprecatedEndpoints.map(ep => `
### ${ep.endpoint}
- **Total Calls:** ${ep.totalCalls}
- **Unique IPs:** ${ep.uniqueIPs}
- **Last Used:** ${new Date(ep.lastSeen).toLocaleDateString()}
- **Replacement:** ${ep.replacementEndpoint || 'Not specified'}
- **User Agents:** ${ep.userAgents.slice(0, 2).join(', ')}${ep.userAgents.length > 2 ? ` (+${ep.userAgents.length - 2} more)` : ''}
`).join('\n')
}

## Consolidated Endpoints Usage

${analysis.consolidatedEndpoints.slice(0, 10).map(ep => `
### ${ep.endpoint}
- **Total Calls:** ${ep.totalCalls}
- **Unique IPs:** ${ep.uniqueIPs}
- **Last Used:** ${new Date(ep.lastSeen).toLocaleDateString()}
`).join('\n')}

## Next Steps

${analysis.summary.migrationProgress > 95 ? 
  '1. ✅ Schedule deprecated endpoint removal\n2. 📋 Create final migration verification\n3. 🗑️ Remove deprecated endpoints' :
  '1. 🔍 Investigate remaining deprecated endpoint usage\n2. 🔄 Update frontend components to use consolidated endpoints\n3. 📊 Re-run analysis after changes'
}

---
*Report generated by endpoint usage analysis script*
`

  await fs.writeFile('docs/endpoint-usage-analysis.md', report)
  console.log('📄 Usage analysis report saved to docs/endpoint-usage-analysis.md')
}

async function main(): Promise<void> {
  try {
    console.log('🔍 Starting endpoint usage analysis...')
    
    const analysis = await analyzeEndpointUsage()
    await generateUsageReport(analysis)
    
    console.log('\n📊 Analysis Summary:')
    console.log(`├─ Total Requests: ${analysis.summary.totalRequests}`)
    console.log(`├─ Migration Progress: ${analysis.summary.migrationProgress}%`)
    console.log(`├─ Deprecated Endpoints Active: ${analysis.deprecatedEndpoints.length}`)
    console.log(`└─ Consolidated Endpoints Active: ${analysis.consolidatedEndpoints.length}`)
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:')
      analysis.recommendations.forEach(rec => console.log(`   ${rec}`))
    }
    
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Analysis failed:', error)
    process.exit(1)
  }
}

// Run the analysis
if (require.main === module) {
  main()
}

export { analyzeEndpointUsage, generateUsageReport }