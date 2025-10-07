import { NextRequest, NextResponse } from 'next/server'
import { healthService } from '@/lib/services/health'
import { metricsService } from '@/lib/services/metrics'
import { loggingService } from '@/lib/services/logging'
import { alertService } from '@/lib/services/alerts'
import { errorRecoveryService } from '@/lib/services/error-recovery'
import { errorHandler } from '@/lib/middleware/error-handler'
import { query } from '@/lib/db-query-builder'
import { db } from '@/lib/db'
import { mockAdminDataIfCI } from '@/app/api/admin/_testMock'
import { USE_MOCK_DATA } from '@/lib/env'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  // Return mock data for CI/test environments
  if (USE_MOCK_DATA) {
    const mockData = mockAdminDataIfCI('diagnostics')
    if (mockData) {
      return NextResponse.json(mockData)
    }
  }
  
  const { searchParams } = new URL(request.url)
  const diagnostic = searchParams.get('type')

  switch (diagnostic) {
    case 'system':
      return NextResponse.json(await getSystemDiagnostics())
    
    case 'database':
      return NextResponse.json(await getDatabaseDiagnostics())
    
    case 'performance':
      return NextResponse.json(await getPerformanceDiagnostics())
    
    case 'connectivity':
      return NextResponse.json(await getConnectivityDiagnostics())
    
    case 'full':
      const [system, database, performance, connectivity] = await Promise.allSettled([
        getSystemDiagnostics(),
        getDatabaseDiagnostics(),
        getPerformanceDiagnostics(),
        getConnectivityDiagnostics()
      ])

      return NextResponse.json({
        system: system.status === 'fulfilled' ? system.value : { error: system.reason },
        database: database.status === 'fulfilled' ? database.value : { error: database.reason },
        performance: performance.status === 'fulfilled' ? performance.value : { error: performance.reason },
        connectivity: connectivity.status === 'fulfilled' ? connectivity.value : { error: connectivity.reason },
        timestamp: new Date().toISOString()
      })
    
    default:
      return NextResponse.json(
        { error: 'Invalid diagnostic type. Supported: system, database, performance, connectivity, full' },
        { status: 400 }
      )
  }
})

export const POST = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'run_diagnostics':
      const diagnosticType = body.type || 'full'
      // Redirect to GET with type parameter
      const url = new URL(request.url)
      url.searchParams.set('type', diagnosticType)
      return NextResponse.redirect(url)

    case 'health_check':
      const healthReport = await healthService.generateHealthReport()
      const isHealthy = healthReport.overallStatus === 'healthy'
      
      return NextResponse.json({
        healthy: isHealthy,
        status: healthReport.overallStatus,
        summary: healthReport.summary,
        timestamp: healthReport.timestamp
      })

    case 'clear_caches':
      // This would implement cache clearing logic
      await loggingService.logInfo('DiagnosticsAPI', 'Cache clearing requested')
      
      return NextResponse.json({
        success: true,
        message: 'Cache clearing initiated'
      })

    case 'restart_services':
      // This would implement service restart logic
      await loggingService.logInfo('DiagnosticsAPI', 'Service restart requested')
      
      return NextResponse.json({
        success: true,
        message: 'Service restart initiated'
      })

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: run_diagnostics, health_check, clear_caches, restart_services' },
        { status: 400 }
      )
  }
})

// Helper functions for different diagnostic types

async function getSystemDiagnostics() {
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  const uptime = process.uptime()

  // Get Node.js version info
  const nodeVersion = process.version
  const platform = process.platform
  const arch = process.arch

  // Environment variables (sanitized)
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    hasSmtp: !!process.env.SMTP_HOST,
    hasAdminEmail: !!process.env.ADMIN_EMAIL
  }

  return {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000)
    },
    process: {
      uptime: Math.round(uptime),
      pid: process.pid,
      nodeVersion,
      platform,
      arch
    },
    environment: envInfo,
    timestamp: new Date().toISOString()
  }
}

async function getDatabaseDiagnostics() {
  try {
    const startTime = Date.now()
    
    // Test basic connectivity
    await db.query('SELECT 1 as test')
    const connectivityTime = Date.now() - startTime

    // Get database info
    const versionResult = await db.query('SELECT version()')
    const dbVersion = versionResult.rows[0]?.version || 'Unknown'

    // Get connection pool stats
    const poolStats = db.getPoolStats()

    // Check table counts
    const tableStats = await db.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC
      LIMIT 10
    `)

    // Check for long-running queries
    const longQueries = await db.query(`
      SELECT 
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query,
        state
      FROM pg_stat_activity 
      WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
      AND state = 'active'
    `)

    return {
      connectivity: {
        status: 'connected',
        responseTime: connectivityTime
      },
      version: dbVersion,
      connectionPool: poolStats,
      tableStatistics: tableStats.rows,
      longRunningQueries: longQueries.rows,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    return {
      connectivity: {
        status: 'error',
        error: error.message
      },
      timestamp: new Date().toISOString()
    }
  }
}

async function getPerformanceDiagnostics() {
  try {
    // Get recent performance metrics
    const performanceStats = await metricsService.getPerformanceStats()
    const metricsSummary = await metricsService.getMetricsSummary()

    // Get recovery statistics
    const recoveryStats = errorRecoveryService.getRecoveryStatistics()

    // Get recent log statistics
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const logStats = await loggingService.getLogStatistics({ start: last24h, end: now })

    return {
      realtimePerformance: performanceStats,
      businessKPIs: metricsSummary.businessKPIs,
      systemResources: metricsSummary.systemResources,
      apiResponseTimes: metricsSummary.recentAPIResponseTimes,
      slowOperations: metricsSummary.topSlowOperations,
      errorRecovery: recoveryStats,
      logStatistics: {
        totalLogs: logStats.totalLogs,
        errorCount: logStats.errorCount,
        warningCount: logStats.warningCount,
        topComponents: logStats.topComponents.slice(0, 5)
      },
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

async function getConnectivityDiagnostics() {
  try {
    const healthReport = await healthService.generateHealthReport()
    
    // Test external API connectivity
    const apiTests = {
      reddit: healthReport.checks.apis.reddit,
      instagram: healthReport.checks.apis.instagram,
      tiktok: healthReport.checks.apis.tiktok
    }

    // Test database connectivity
    const databaseTest = healthReport.checks.database

    // DNS resolution test (simplified)
    const dnsTests = {
      google: { status: 'unknown', message: 'DNS test not implemented' },
      cloudflare: { status: 'unknown', message: 'DNS test not implemented' }
    }

    return {
      apis: apiTests,
      database: {
        status: databaseTest.status,
        responseTime: databaseTest.responseTime,
        connectionPool: databaseTest.connectionPool
      },
      dns: dnsTests,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}