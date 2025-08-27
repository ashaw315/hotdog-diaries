#!/usr/bin/env tsx

/**
 * Hotdog Diaries System Health Monitor
 * 
 * This script monitors the automation system health including:
 * - Content queue status (>3 days required)
 * - Posting schedule adherence (6x daily at specific times)
 * - Platform diversity (<30% threshold)
 * - GitHub Actions workflow status
 * - Database and API health
 * 
 * Usage:
 *   JWT_SECRET=<secret> npx tsx scripts/monitor-system-health.ts
 *   
 *   # With auth token:
 *   AUTH_TOKEN=<token> npx tsx scripts/monitor-system-health.ts
 *   
 *   # For production monitoring:
 *   SITE_URL=https://hotdog-diaries.vercel.app AUTH_TOKEN=<token> npx tsx scripts/monitor-system-health.ts
 * 
 * Options:
 *   --json           Output results as JSON
 *   --alert-only     Only show alerts/warnings 
 *   --verbose        Show detailed information
 *   --help          Show this help message
 */

import { db } from '../lib/db'
import { AuthService } from '../lib/services/auth'

interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  message: string
  details?: any
  timestamp: string
}

interface HealthReport {
  overall: 'healthy' | 'warning' | 'critical'
  timestamp: string
  checks: HealthCheck[]
  summary: {
    contentDays: number
    lastPostHours: number
    platformDiversity: boolean
    workflowsHealthy: boolean
  }
  alerts: string[]
}

// Posting schedule (UTC times)
const POSTING_SCHEDULE = [
  { hour: 7, minute: 0, name: 'breakfast' },
  { hour: 10, minute: 0, name: 'mid-morning' },  
  { hour: 13, minute: 0, name: 'lunch' },
  { hour: 16, minute: 0, name: 'afternoon-snack' },
  { hour: 19, minute: 0, name: 'dinner' },
  { hour: 22, minute: 0, name: 'late-night' }
]

class SystemHealthMonitor {
  private siteUrl: string
  private authToken: string | null
  private verbose: boolean
  private report: HealthReport

  constructor(options: { siteUrl?: string; authToken?: string; verbose?: boolean } = {}) {
    this.siteUrl = options.siteUrl || process.env.SITE_URL || 'http://localhost:3000'
    this.authToken = options.authToken || process.env.AUTH_TOKEN || null
    this.verbose = options.verbose || false
    
    this.report = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        contentDays: 0,
        lastPostHours: 0,
        platformDiversity: false,
        workflowsHealthy: false
      },
      alerts: []
    }
  }

  private addCheck(check: HealthCheck) {
    this.report.checks.push(check)
    
    // Update overall status
    if (check.status === 'critical' && this.report.overall !== 'critical') {
      this.report.overall = 'critical'
    } else if (check.status === 'warning' && this.report.overall === 'healthy') {
      this.report.overall = 'warning'
    }
  }

  private addAlert(message: string) {
    this.report.alerts.push(message)
  }

  private async makeApiCall(endpoint: string): Promise<any> {
    try {
      const url = `${this.siteUrl}${endpoint}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`
      }

      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      throw new Error(`API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async checkContentQueue(): Promise<void> {
    try {
      await db.connect()
      
      // Get content queue statistics
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_content,
          SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_content,
          SUM(CASE WHEN is_approved = 1 AND is_posted = 0 THEN 1 ELSE 0 END) as ready_to_post,
          SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted_content
        FROM content_queue
      `)
      
      const stats = result.rows[0]
      const daysOfContent = stats.ready_to_post / 6
      
      this.report.summary.contentDays = Math.round(daysOfContent * 10) / 10
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = `Content queue healthy: ${daysOfContent.toFixed(1)} days remaining`
      
      if (daysOfContent < 1) {
        status = 'critical'
        message = `CRITICAL: Only ${daysOfContent.toFixed(1)} days of content remaining`
        this.addAlert(`Content starvation risk: ${daysOfContent.toFixed(1)} days remaining`)
      } else if (daysOfContent < 3) {
        status = 'warning'  
        message = `WARNING: Low content buffer: ${daysOfContent.toFixed(1)} days remaining`
        this.addAlert(`Content buffer low: ${daysOfContent.toFixed(1)} days remaining`)
      }
      
      this.addCheck({
        name: 'Content Queue',
        status,
        message,
        details: {
          totalContent: stats.total_content,
          approvedContent: stats.approved_content,
          readyToPost: stats.ready_to_post,
          postedContent: stats.posted_content,
          daysRemaining: daysOfContent
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      this.addCheck({
        name: 'Content Queue',
        status: 'critical',
        message: `Failed to check content queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      })
    }
  }

  private async checkPostingSchedule(): Promise<void> {
    try {
      await db.connect()
      
      // Get most recent post
      const result = await db.query(`
        SELECT pc.posted_at, cq.source_platform, cq.content_text
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        ORDER BY pc.posted_at DESC
        LIMIT 1
      `)
      
      if (result.rows.length === 0) {
        this.addCheck({
          name: 'Posting Schedule',
          status: 'critical',
          message: 'No posts found in database',
          timestamp: new Date().toISOString()
        })
        this.addAlert('No posts found in database')
        return
      }
      
      const lastPost = result.rows[0]
      const lastPostTime = new Date(lastPost.posted_at)
      const now = new Date()
      const hoursSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (1000 * 60 * 60)
      
      this.report.summary.lastPostHours = Math.round(hoursSinceLastPost * 10) / 10
      
      // Check if we're within the expected posting window
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = `Last post ${hoursSinceLastPost.toFixed(1)} hours ago`
      
      if (hoursSinceLastPost > 8) {
        status = 'critical'
        message = `CRITICAL: No post for ${hoursSinceLastPost.toFixed(1)} hours (expected every 6 hours max)`
        this.addAlert(`Posting automation may be broken: ${hoursSinceLastPost.toFixed(1)} hours since last post`)
      } else if (hoursSinceLastPost > 6) {
        status = 'warning'
        message = `WARNING: ${hoursSinceLastPost.toFixed(1)} hours since last post (expected every ~4 hours)`
        this.addAlert(`Posting delay detected: ${hoursSinceLastPost.toFixed(1)} hours since last post`)
      }
      
      this.addCheck({
        name: 'Posting Schedule',
        status,
        message,
        details: {
          lastPostTime: lastPost.posted_at,
          hoursSinceLastPost: hoursSinceLastPost,
          lastPostContent: lastPost.content_text.substring(0, 50) + '...',
          expectedMaxHours: 6
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      this.addCheck({
        name: 'Posting Schedule',
        status: 'critical', 
        message: `Failed to check posting schedule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      })
    }
  }

  private async checkPlatformDiversity(): Promise<void> {
    try {
      await db.connect()
      
      // Get platform distribution for recent posts (last 20 posts)
      const result = await db.query(`
        SELECT 
          cq.source_platform,
          COUNT(*) as post_count,
          ROUND(COUNT(*) * 100.0 / (
            SELECT COUNT(*) 
            FROM posted_content pc2 
            ORDER BY pc2.posted_at DESC 
            LIMIT 20
          ), 1) as percentage
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        WHERE pc.id IN (
          SELECT id FROM posted_content ORDER BY posted_at DESC LIMIT 20
        )
        GROUP BY cq.source_platform
        ORDER BY post_count DESC
      `)
      
      if (result.rows.length === 0) {
        this.addCheck({
          name: 'Platform Diversity',
          status: 'warning',
          message: 'No recent posts found for diversity analysis',
          timestamp: new Date().toISOString()
        })
        return
      }
      
      const platforms = result.rows
      const topPlatform = platforms[0]
      const dominantPercentage = topPlatform.percentage
      
      this.report.summary.platformDiversity = dominantPercentage <= 30
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = `Platform diversity healthy: Top platform ${topPlatform.source_platform} (${dominantPercentage}%)`
      
      if (dominantPercentage > 50) {
        status = 'critical'
        message = `CRITICAL: Platform ${topPlatform.source_platform} dominates with ${dominantPercentage}% of recent posts`
        this.addAlert(`Platform diversity issue: ${topPlatform.source_platform} represents ${dominantPercentage}% of recent posts`)
      } else if (dominantPercentage > 30) {
        status = 'warning'
        message = `WARNING: Platform ${topPlatform.source_platform} over-represented at ${dominantPercentage}%`
        this.addAlert(`Platform imbalance: ${topPlatform.source_platform} represents ${dominantPercentage}% of recent posts`)
      }
      
      this.addCheck({
        name: 'Platform Diversity',
        status,
        message,
        details: {
          recentPosts: platforms.reduce((sum, p) => sum + p.post_count, 0),
          topPlatform: topPlatform.source_platform,
          topPercentage: dominantPercentage,
          distribution: platforms,
          threshold: 30
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      this.addCheck({
        name: 'Platform Diversity',
        status: 'critical',
        message: `Failed to check platform diversity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      })
    }
  }

  private async checkGitHubWorkflows(): Promise<void> {
    try {
      // Use GitHub CLI to check workflow status
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      // Get recent workflow runs with timeout
      const { stdout } = await Promise.race([
        execAsync('gh run list --limit 10 --json status,name,conclusion,createdAt'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('GitHub CLI timeout')), 15000)
        )
      ]) as { stdout: string }
      const runs = JSON.parse(stdout)
      
      const recentRuns = runs.filter((run: any) => {
        const runTime = new Date(run.createdAt)
        const hoursAgo = (new Date().getTime() - runTime.getTime()) / (1000 * 60 * 60)
        return hoursAgo <= 24 // Last 24 hours
      })
      
      const failedRuns = recentRuns.filter((run: any) => 
        run.status === 'completed' && run.conclusion === 'failure'
      )
      
      const criticalWorkflows = [
        'Post Breakfast Content',
        'Post Lunch Content', 
        'Post Dinner Content',
        'Auto-Approve Content'
      ]
      
      const failedCritical = failedRuns.filter((run: any) => 
        criticalWorkflows.some(critical => run.name.includes(critical))
      )
      
      this.report.summary.workflowsHealthy = failedCritical.length === 0
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = `GitHub Actions healthy: ${recentRuns.length - failedRuns.length}/${recentRuns.length} workflows successful`
      
      if (failedCritical.length > 0) {
        status = 'critical'
        message = `CRITICAL: ${failedCritical.length} critical workflows failing`
        this.addAlert(`Critical GitHub workflows failing: ${failedCritical.map(r => r.name).join(', ')}`)
      } else if (failedRuns.length > 2) {
        status = 'warning'
        message = `WARNING: ${failedRuns.length} workflows failed recently`
        this.addAlert(`Multiple workflow failures: ${failedRuns.length} failed in last 24h`)
      }
      
      this.addCheck({
        name: 'GitHub Workflows',
        status,
        message,
        details: {
          totalRuns: recentRuns.length,
          failedRuns: failedRuns.length,
          failedCritical: failedCritical.length,
          failedWorkflows: failedRuns.map((r: any) => r.name),
          timeWindow: '24 hours'
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      // Skip GitHub workflow checks if CLI is unavailable
      if (this.verbose) {
        console.log('⚠️  Skipping GitHub workflow checks (CLI unavailable)')
      }
      // Don't add this as a health check failure since it's optional
    }
  }

  private async checkApiHealth(): Promise<void> {
    // Skip API health check for localhost unless explicitly requested
    if (this.siteUrl.includes('localhost') && !process.env.FORCE_API_CHECK) {
      if (this.verbose) {
        console.log('⚠️  Skipping API health check for localhost')
      }
      return
    }
    
    try {
      // Try to hit the health endpoint
      const health = await this.makeApiCall('/api/admin/health')
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      let message = 'API endpoints accessible'
      
      if (health.overallStatus === 'critical') {
        status = 'critical'
        message = 'CRITICAL: API health check shows critical issues'
        this.addAlert('API health check reports critical system issues')
      } else if (health.overallStatus === 'warning') {
        status = 'warning'
        message = 'WARNING: API health check shows warnings'
      }
      
      this.addCheck({
        name: 'API Health',
        status,
        message,
        details: {
          overallStatus: health.overallStatus,
          checks: health.checks || {},
          responseTime: health.uptime || 0
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      this.addCheck({
        name: 'API Health',
        status: 'critical',
        message: `API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      })
      this.addAlert('API endpoints are not accessible')
    }
  }

  private generateAuthToken(): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable required for token generation')
    }
    
    return AuthService.generateJWT({ id: 1, username: 'admin' })
  }

  public async runHealthChecks(): Promise<HealthReport> {
    console.log('🏥 Hotdog Diaries System Health Monitor')
    console.log('=' .repeat(50))
    console.log(`Checking system at: ${this.siteUrl}`)
    console.log(`Timestamp: ${this.report.timestamp}`)
    console.log('')
    
    // Generate auth token if JWT_SECRET is available but no AUTH_TOKEN provided
    if (!this.authToken && process.env.JWT_SECRET) {
      try {
        this.authToken = this.generateAuthToken()
        if (this.verbose) {
          console.log('Generated auth token from JWT_SECRET')
        }
      } catch (error) {
        console.log('⚠️  Could not generate auth token - some checks may be limited')
      }
    }
    
    // Run all health checks
    console.log('🔍 Running health checks...')
    
    await this.checkContentQueue()
    await this.checkPostingSchedule()
    await this.checkPlatformDiversity()
    await this.checkGitHubWorkflows()
    await this.checkApiHealth()
    
    await db.disconnect()
    
    return this.report
  }

  public printReport(jsonOutput: boolean = false, alertOnly: boolean = false): void {
    if (jsonOutput) {
      console.log(JSON.stringify(this.report, null, 2))
      return
    }
    
    if (alertOnly && this.report.alerts.length === 0) {
      console.log('✅ No alerts - system is healthy')
      return
    }
    
    console.log('')
    console.log('📊 HEALTH REPORT SUMMARY')
    console.log('=' .repeat(30))
    console.log(`Overall Status: ${this.getStatusIcon(this.report.overall)} ${this.report.overall.toUpperCase()}`)
    console.log(`Content Days: ${this.report.summary.contentDays}`)
    console.log(`Last Post: ${this.report.summary.lastPostHours}h ago`)
    console.log(`Platform Diversity: ${this.report.summary.platformDiversity ? '✅' : '❌'}`)
    console.log(`Workflows: ${this.report.summary.workflowsHealthy ? '✅' : '❌'}`)
    console.log('')
    
    if (this.report.alerts.length > 0) {
      console.log('🚨 ALERTS')
      console.log('-' .repeat(20))
      this.report.alerts.forEach(alert => console.log(`⚠️  ${alert}`))
      console.log('')
    }
    
    if (!alertOnly) {
      console.log('📋 DETAILED CHECKS')
      console.log('-' .repeat(25))
      this.report.checks.forEach(check => {
        console.log(`${this.getStatusIcon(check.status)} ${check.name}: ${check.message}`)
        if (this.verbose && check.details) {
          console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`)
        }
      })
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️ '
      case 'critical': return '🚨'
      default: return '❓'
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Hotdog Diaries System Health Monitor')
    console.log('')
    console.log('Usage:')
    console.log('  JWT_SECRET=<secret> npx tsx scripts/monitor-system-health.ts')
    console.log('  AUTH_TOKEN=<token> npx tsx scripts/monitor-system-health.ts')
    console.log('  SITE_URL=<url> AUTH_TOKEN=<token> npx tsx scripts/monitor-system-health.ts')
    console.log('')
    console.log('Options:')
    console.log('  --json         Output as JSON')
    console.log('  --alert-only   Only show alerts')
    console.log('  --verbose      Show detailed information')
    console.log('  --help, -h     Show this help')
    console.log('')
    console.log('Environment Variables:')
    console.log('  SITE_URL       API base URL (default: http://localhost:3000)')
    console.log('  AUTH_TOKEN     Bearer token for API calls')
    console.log('  JWT_SECRET     Secret to generate auth token (alternative to AUTH_TOKEN)')
    process.exit(0)
  }
  
  const jsonOutput = args.includes('--json')
  const alertOnly = args.includes('--alert-only')
  const verbose = args.includes('--verbose')
  
  const monitor = new SystemHealthMonitor({
    siteUrl: process.env.SITE_URL,
    authToken: process.env.AUTH_TOKEN,
    verbose
  })
  
  try {
    const report = await monitor.runHealthChecks()
    monitor.printReport(jsonOutput, alertOnly)
    
    // Exit with error code if critical issues found
    if (report.overall === 'critical') {
      process.exit(1)
    } else if (report.overall === 'warning') {
      process.exit(2)
    }
    
  } catch (error) {
    console.error('❌ Health monitoring failed:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(3)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { SystemHealthMonitor, type HealthReport, type HealthCheck }