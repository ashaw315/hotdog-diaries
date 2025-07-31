'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  Server, 
  Database, 
  Globe, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Users,
  Zap,
  RefreshCw
} from 'lucide-react'

interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  message: string
  responseTime?: number
  lastChecked: string
  metadata?: Record<string, any>
}

interface SystemHealthReport {
  overallStatus: 'healthy' | 'warning' | 'critical'
  timestamp: string
  uptime: number
  checks: {
    database: HealthCheck & {
      connectionPool: { total: number; idle: number; active: number }
      queryPerformance: { averageResponseTime: number; slowQueries: number }
    }
    apis: {
      reddit: HealthCheck
      instagram: HealthCheck
      tiktok: HealthCheck
    }
    services: {
      contentQueue: HealthCheck
      scheduler: HealthCheck
      logging: HealthCheck
    }
    system: {
      memory: HealthCheck
      disk: HealthCheck
      cpu: HealthCheck
    }
  }
  summary: {
    totalChecks: number
    healthyChecks: number
    warningChecks: number
    criticalChecks: number
    responseTime: number
  }
}

interface MetricsSummary {
  totalMetrics: number
  recentAPIResponseTimes: {
    reddit: number
    instagram: number
    tiktok: number
  }
  systemResources: {
    memoryUsagePercent: number
    cpuUsagePercent: number
    diskUsagePercent: number
  }
  businessKPIs: {
    contentProcessedLast24h: number
    postsCreatedLast24h: number
    errorRateLast1h: number
    queueSize: number
  }
  topSlowOperations: Array<{
    operation: string
    avgResponseTime: number
    count: number
  }>
}

interface AlertHistory {
  alerts: Array<{
    id: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    title: string
    message: string
    createdAt: string
    resolvedAt?: string
    acknowledged: boolean
  }>
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  resolvedCount: number
  unresolvedCount: number
}

export default function MonitoringDashboard() {
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null)
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null)
  const [alertHistory, setAlertHistory] = useState<AlertHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [healthRes, metricsRes, alertsRes] = await Promise.allSettled([
        fetch('/api/admin/health'),
        fetch('/api/admin/metrics/summary'),
        fetch('/api/admin/alerts/history?limit=50')
      ])

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const healthData = await healthRes.value.json()
        setHealthReport(healthData)
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const metricsData = await metricsRes.value.json()
        setMetricsSummary(metricsData)
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const alertsData = await alertsRes.value.json()
        setAlertHistory(alertsData)
      }

      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.unknown}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading && !healthReport) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading monitoring dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
            <p className="text-gray-600">
              Real-time system health, performance metrics, and alerts
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button onClick={fetchData} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Error</AlertTitle>
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* System Overview */}
      {healthReport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthReport.overallStatus)}
                {getStatusBadge(healthReport.overallStatus)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {healthReport.summary.healthyChecks}/{healthReport.summary.totalChecks} checks healthy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUptime(healthReport.uptime)}</div>
              <p className="text-xs text-muted-foreground">
                Since last restart
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthReport.summary.responseTime}ms</div>
              <p className="text-xs text-muted-foreground">
                Health check duration
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {alertHistory?.unresolvedCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Require attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="metrics">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-6">
          {healthReport && (
            <>
              {/* Database Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Database Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        {getStatusBadge(healthReport.checks.database.status)}
                      </div>
                      <p className="text-sm text-gray-600">{healthReport.checks.database.message}</p>
                      <p className="text-xs text-gray-500">
                        Response: {healthReport.checks.database.responseTime}ms
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Connection Pool</span>
                      <div className="text-sm">
                        <div>Total: {healthReport.checks.database.connectionPool.total}</div>
                        <div>Active: {healthReport.checks.database.connectionPool.active}</div>
                        <div>Idle: {healthReport.checks.database.connectionPool.idle}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Query Performance</span>
                      <div className="text-sm">
                        <div>Avg: {healthReport.checks.database.queryPerformance.averageResponseTime}ms</div>
                        <div>Slow queries: {healthReport.checks.database.queryPerformance.slowQueries}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    External APIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(healthReport.checks.apis).map(([platform, check]) => (
                      <div key={platform} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{platform}</span>
                          {getStatusBadge(check.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{check.message}</p>
                        <div className="text-xs text-gray-500">
                          <div>Response: {check.responseTime}ms</div>
                          {check.rateLimits && (
                            <div>Rate limit: {check.rateLimits.remaining} remaining</div>
                          )}
                          {check.quotaUsage && (
                            <div>Quota: {check.quotaUsage.percentage}% used</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    System Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(healthReport.checks.system).map(([resource, check]) => (
                      <div key={resource} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{resource}</span>
                          {getStatusBadge(check.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{check.message}</p>
                        <div className="text-xs text-gray-500">
                          Response: {check.responseTime}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Performance Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          {metricsSummary && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Content Processed</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsSummary.businessKPIs.contentProcessedLast24h}
                    </div>
                    <p className="text-xs text-muted-foreground">Last 24 hours</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Posts Created</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsSummary.businessKPIs.postsCreatedLast24h}
                    </div>
                    <p className="text-xs text-muted-foreground">Last 24 hours</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsSummary.businessKPIs.queueSize}
                    </div>
                    <p className="text-xs text-muted-foreground">Pending items</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {metricsSummary.businessKPIs.errorRateLast1h}%
                    </div>
                    <p className="text-xs text-muted-foreground">Last hour</p>
                  </CardContent>
                </Card>
              </div>

              {/* API Response Times */}
              <Card>
                <CardHeader>
                  <CardTitle>API Response Times</CardTitle>
                  <CardDescription>Average response times for external APIs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(metricsSummary.recentAPIResponseTimes).map(([platform, time]) => (
                      <div key={platform} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{platform}</span>
                          <Badge variant="outline">{time}ms</Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              time < 200 ? 'bg-green-500' :
                              time < 500 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((time / 1000) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Resources */}
              <Card>
                <CardHeader>
                  <CardTitle>System Resources</CardTitle>
                  <CardDescription>Current system resource utilization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Memory</span>
                        <span className="text-sm">{metricsSummary.systemResources.memoryUsagePercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metricsSummary.systemResources.memoryUsagePercent < 70 ? 'bg-green-500' :
                            metricsSummary.systemResources.memoryUsagePercent < 85 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metricsSummary.systemResources.memoryUsagePercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">CPU</span>
                        <span className="text-sm">{metricsSummary.systemResources.cpuUsagePercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metricsSummary.systemResources.cpuUsagePercent < 70 ? 'bg-green-500' :
                            metricsSummary.systemResources.cpuUsagePercent < 85 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metricsSummary.systemResources.cpuUsagePercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Disk</span>
                        <span className="text-sm">{metricsSummary.systemResources.diskUsagePercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metricsSummary.systemResources.diskUsagePercent < 70 ? 'bg-green-500' :
                            metricsSummary.systemResources.diskUsagePercent < 85 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metricsSummary.systemResources.diskUsagePercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Slow Operations */}
              {metricsSummary.topSlowOperations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Slowest Operations</CardTitle>
                    <CardDescription>Operations with highest average response times</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metricsSummary.topSlowOperations.map((op, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{op.operation}</span>
                            <p className="text-sm text-gray-600">{op.count} executions</p>
                          </div>
                          <Badge variant="outline">{op.avgResponseTime}ms</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          {alertHistory && (
            <>
              {/* Alert Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertHistory.total}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical</CardTitle>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {alertHistory.bySeverity.critical || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
                    <Clock className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {alertHistory.unresolvedCount}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {alertHistory.resolvedCount}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Alerts</CardTitle>
                  <CardDescription>Latest system alerts and notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertHistory.alerts.slice(0, 10).map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusBadge(alert.severity)}
                            <span className="font-medium">{alert.title}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Type: {alert.type}</span>
                            <span>Created: {new Date(alert.createdAt).toLocaleString()}</span>
                            {alert.resolvedAt && (
                              <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-xs">
                              Acknowledged
                            </Badge>
                          )}
                          {alert.resolvedAt && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>Recent system activity and error logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>Log viewing functionality will be implemented here.</p>
                <p className="text-sm">This will show recent logs, filtering options, and search capabilities.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}