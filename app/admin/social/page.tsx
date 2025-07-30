'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Play, Pause, Settings, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

interface PlatformStatus {
  platform: 'reddit' | 'instagram' | 'tiktok'
  isEnabled: boolean
  isAuthenticated: boolean
  lastScanTime?: string
  nextScanTime?: string
  rateLimitStatus: 'healthy' | 'warning' | 'critical'
  errorCount: number
  contentType: 'posts' | 'images' | 'videos'
  quotaStatus?: {
    hourlyUsed: number
    hourlyLimit: number
    dailyUsed: number
    dailyLimit: number
  }
}

interface UnifiedStats {
  totalScans: number
  totalPostsFound: number
  totalPostsApproved: number
  platformBreakdown: Array<{
    platform: string
    scans: number
    postsFound: number
    postsApproved: number
    successRate: number
    contentType: string
  }>
  contentDistribution: {
    posts: number
    images: number
    videos: number
  }
  averageSuccessRate: number
  lastScanTime?: string
}

interface ScanResult {
  scanId: string
  startTime: string
  endTime: string
  platforms: Array<{
    platform: string
    success: boolean
    postsFound: number
    postsApproved: number
    errors: string[]
    duration: number
    contentType: string
  }>
  totalPostsFound: number
  totalPostsApproved: number
  successfulPlatforms: number
  failedPlatforms: number
}

export default function SocialMediaDashboard() {
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([])
  const [unifiedStats, setUnifiedStats] = useState<UnifiedStats | null>(null)
  const [isCoordinatedScanRunning, setIsCoordinatedScanRunning] = useState(false)
  const [isScanInProgress, setIsScanInProgress] = useState(false)
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlatformStatuses = async () => {
    try {
      const response = await fetch('/api/admin/social/status')
      if (!response.ok) throw new Error('Failed to fetch platform statuses')
      const data = await response.json()
      setPlatformStatuses(data.data || [])
    } catch (err) {
      setError('Failed to load platform statuses')
    }
  }

  const fetchUnifiedStats = async () => {
    try {
      const response = await fetch('/api/admin/social/distribution')
      if (!response.ok) throw new Error('Failed to fetch unified stats')
      const data = await response.json()
      setUnifiedStats(data.data || null)
    } catch (err) {
      setError('Failed to load unified statistics')
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    await Promise.all([fetchPlatformStatuses(), fetchUnifiedStats()])
    setIsLoading(false)
  }

  const triggerUnifiedScan = async () => {
    setIsScanInProgress(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/social/scan-all', {
        method: 'POST'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger scan')
      }
      
      const data = await response.json()
      setLastScanResult(data.data)
      
      // Refresh data after scan
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to trigger unified scan')
    } finally {
      setIsScanInProgress(false)
    }
  }

  const toggleCoordinatedScanning = async () => {
    setError(null)
    
    try {
      const endpoint = isCoordinatedScanRunning 
        ? '/api/admin/social/coordination/stop' 
        : '/api/admin/social/coordination/start'
      
      const response = await fetch(endpoint, { method: 'POST' })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to toggle coordination')
      }
      
      setIsCoordinatedScanRunning(!isCoordinatedScanRunning)
    } catch (err) {
      setError(err.message || 'Failed to toggle coordinated scanning')
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'reddit': return '🔴'
      case 'instagram': return '📸'
      case 'tiktok': return '🎵'
      default: return '📱'
    }
  }

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'posts': return '📝'
      case 'images': return '🖼️'
      case 'videos': return '🎥'
      default: return '📄'
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading social media dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media Dashboard</h1>
          <p className="text-muted-foreground">
            Unified management for Reddit, Instagram, and TikTok content scanning
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={toggleCoordinatedScanning}
            variant={isCoordinatedScanRunning ? "destructive" : "default"}
          >
            {isCoordinatedScanRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Coordination
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Coordination
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platform Status</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="controls">Scan Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Platform Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {platformStatuses.map((status) => (
              <Card key={status.platform} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      {getPlatformIcon(status.platform)} {status.platform.charAt(0).toUpperCase() + status.platform.slice(1)}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(status.rateLimitStatus)}>
                        {status.rateLimitStatus}
                      </Badge>
                      {status.isAuthenticated ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={status.isEnabled ? "default" : "secondary"}>
                      {status.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">
                      {getContentTypeIcon(status.contentType)} {status.contentType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <div>Auth: {status.isAuthenticated ? "Connected" : "Not connected"}</div>
                    <div>Errors: {status.errorCount}</div>
                    {status.lastScanTime && (
                      <div>Last scan: {new Date(status.lastScanTime).toLocaleString()}</div>
                    )}
                    {status.quotaStatus && (
                      <div className="mt-2 p-2 bg-gray-50 rounded">
                        <div className="text-xs">
                          <div>Hourly: {status.quotaStatus.hourlyUsed}/{status.quotaStatus.hourlyLimit}</div>
                          <div>Daily: {status.quotaStatus.dailyUsed}/{status.quotaStatus.dailyLimit}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Stats */}
          {unifiedStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unifiedStats.totalScans}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Content Found</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unifiedStats.totalPostsFound}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Content Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unifiedStats.totalPostsApproved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unifiedStats.averageSuccessRate.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Details</CardTitle>
              <CardDescription>
                Detailed status and performance metrics for each platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {platformStatuses.map((status, index) => (
                  <div key={status.platform}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">{getPlatformIcon(status.platform)}</div>
                        <div>
                          <h3 className="text-lg font-semibold">
                            {status.platform.charAt(0).toUpperCase() + status.platform.slice(1)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {status.contentType} content • {status.isEnabled ? "Active" : "Inactive"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(status.rateLimitStatus)}>
                          {status.rateLimitStatus}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/admin/${status.platform}`}>
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                          </a>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Authentication</div>
                        <div className={status.isAuthenticated ? "text-green-600" : "text-red-600"}>
                          {status.isAuthenticated ? "Connected" : "Not connected"}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Error Count</div>
                        <div>{status.errorCount}</div>
                      </div>
                      <div>
                        <div className="font-medium">Last Scan</div>
                        <div>{status.lastScanTime ? new Date(status.lastScanTime).toLocaleString() : "Never"}</div>
                      </div>
                      <div>
                        <div className="font-medium">Next Scan</div>
                        <div>{status.nextScanTime ? new Date(status.nextScanTime).toLocaleString() : "Not scheduled"}</div>
                      </div>
                    </div>

                    {status.quotaStatus && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-2">API Quota Usage</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Hourly Usage</div>
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${(status.quotaStatus.hourlyUsed / status.quotaStatus.hourlyLimit) * 100}%` }}
                                ></div>
                              </div>
                              <span>{status.quotaStatus.hourlyUsed}/{status.quotaStatus.hourlyLimit}</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Daily Usage</div>
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${(status.quotaStatus.dailyUsed / status.quotaStatus.dailyLimit) * 100}%` }}
                                ></div>
                              </div>
                              <span>{status.quotaStatus.dailyUsed}/{status.quotaStatus.dailyLimit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {index < platformStatuses.length - 1 && <Separator className="mt-6" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {unifiedStats && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Content Distribution</CardTitle>
                  <CardDescription>
                    Distribution of content types across platforms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        📝 Text Posts
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${unifiedStats.contentDistribution.posts}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{unifiedStats.contentDistribution.posts}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        🖼️ Images
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ width: `${unifiedStats.contentDistribution.images}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{unifiedStats.contentDistribution.images}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        🎥 Videos
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-600 h-2 rounded-full" 
                            style={{ width: `${unifiedStats.contentDistribution.videos}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{unifiedStats.contentDistribution.videos}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Performance</CardTitle>
                  <CardDescription>
                    Success rates and content volume by platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {unifiedStats.platformBreakdown.map((platform) => (
                      <div key={platform.platform} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium flex items-center">
                            {getPlatformIcon(platform.platform)} {platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1)}
                          </h4>
                          <Badge variant="outline">{platform.successRate.toFixed(1)}% success</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <div className="font-medium text-foreground">{platform.scans}</div>
                            <div>Scans</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{platform.postsFound}</div>
                            <div>Found</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{platform.postsApproved}</div>
                            <div>Approved</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unified Scan Controls</CardTitle>
              <CardDescription>
                Manage coordinated scanning across all platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Coordinated Scanning</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically manage scanning across all platforms with intelligent scheduling
                  </p>
                </div>
                <Button 
                  onClick={toggleCoordinatedScanning}
                  variant={isCoordinatedScanRunning ? "destructive" : "default"}
                >
                  {isCoordinatedScanRunning ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Manual Unified Scan</h4>
                  <p className="text-sm text-muted-foreground">
                    Trigger an immediate scan across all enabled and authenticated platforms
                  </p>
                </div>
                <Button 
                  onClick={triggerUnifiedScan} 
                  disabled={isScanInProgress}
                  variant="outline"
                >
                  {isScanInProgress ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Scan All Platforms
                    </>
                  )}
                </Button>
              </div>

              {lastScanResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Last Scan Result</CardTitle>
                    <CardDescription>
                      Completed: {new Date(lastScanResult.endTime).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{lastScanResult.successfulPlatforms}</div>
                        <div className="text-sm text-muted-foreground">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{lastScanResult.failedPlatforms}</div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{lastScanResult.totalPostsFound}</div>
                        <div className="text-sm text-muted-foreground">Found</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{lastScanResult.totalPostsApproved}</div>
                        <div className="text-sm text-muted-foreground">Approved</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {lastScanResult.platforms.map((platform) => (
                        <div key={platform.platform} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center space-x-2">
                            {getPlatformIcon(platform.platform)}
                            <span className="font-medium">{platform.platform}</span>
                            {platform.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {platform.postsApproved}/{platform.postsFound} • {(platform.duration / 1000).toFixed(1)}s
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}