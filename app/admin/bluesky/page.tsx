'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, PlayCircle, BarChart3, Settings, Zap, Video, Image, MessageSquare } from 'lucide-react'

interface BlueskyStatus {
  platform: string
  isEnabled: boolean
  isAuthenticated: boolean
  connectionStatus: string
  connectionMessage: string
  scanInterval: number
  searchTerms: string[]
  lastScanTime?: string
  nextScanTime?: string
  stats: {
    totalPostsFound: number
    postsProcessed: number
    postsApproved: number
    postsRejected: number
    successRate: number
    healthStatus: string
    errorRate: number
  }
  capabilities: {
    requiresAuthentication: boolean
    supportsSearch: boolean
    supportsImages: boolean
    supportsVideos: boolean
    supportsMixedContent: boolean
    apiEndpoint: string
  }
}

interface BlueskyStats {
  totalPostsFound: number
  postsProcessed: number
  postsApproved: number
  postsRejected: number
  postsPending: number
  contentTypes: {
    text: number
    image: number
    video: number
    mixed: number
  }
  successRate: number
  approvalRate: number
  averageTextLength: number
  healthMetrics: {
    isActive: boolean
    recentActivity: boolean
    contentDiversity: number
  }
}

export default function BlueskyAdminPage() {
  const [status, setStatus] = useState<BlueskyStatus | null>(null)
  const [stats, setStats] = useState<BlueskyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadStatus()
    loadStats()
  }, [])

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/admin/bluesky/status')
      const result = await response.json()
      if (result.success) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('Error loading Bluesky status:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/bluesky/stats')
      const result = await response.json()
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading Bluesky stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const response = await fetch('/api/admin/bluesky/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPosts: 30 })
      })
      
      const result = await response.json()
      if (result.success) {
        await loadStatus()
        await loadStats()
      }
    } catch (error) {
      console.error('Error starting Bluesky scan:', error)
    } finally {
      setScanning(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/admin/bluesky/test')
      await response.json() // Remove unused 'result' variable
      await loadStatus()
    } catch (error) {
      console.error('Error testing Bluesky connection:', error)
    } finally {
      setTesting(false)
    }
  }

  const getHealthBadgeColor = (healthStatus: string) => {
    switch (healthStatus) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bluesky Integration</h1>
          <p className="text-gray-600">Monitor and manage Bluesky content scanning with video support</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Test Connection
          </Button>
          <Button 
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Start Scan
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Badge className={getHealthBadgeColor(status?.stats?.healthStatus || 'unknown')}>
                  {status?.stats?.healthStatus || 'Unknown'}
                </Badge>
                {status?.isEnabled && <Badge variant="secondary">Enabled</Badge>}
              </div>
              <p className="text-sm text-gray-600">{status?.connectionMessage}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((status?.stats?.successRate || 0) * 100)}%</div>
            <p className="text-sm text-gray-600">
              {status?.stats?.postsApproved || 0} of {status?.stats?.postsProcessed || 0} posts approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Types</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center"><MessageSquare className="h-3 w-3 mr-1" />Text</span>
                <span>{stats?.contentTypes?.text || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center"><Image className="h-3 w-3 mr-1" />Image</span>
                <span>{stats?.contentTypes?.image || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center"><Video className="h-3 w-3 mr-1" />Video</span>
                <span>{stats?.contentTypes?.video || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scanning Configuration</CardTitle>
            <CardDescription>Current Bluesky scanning settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Search Terms</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {status?.searchTerms?.map((term, index) => (
                    <Badge key={index} variant="outline">{term}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold">Scan Interval</h4>
                <p className="text-sm text-gray-600">
                  Every {Math.round((status?.scanInterval || 0) / (1000 * 60 * 60))} hours
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Platform Capabilities</h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Badge variant={status?.capabilities?.supportsImages ? "default" : "secondary"}>
                    {status?.capabilities?.supportsImages ? "✓" : "✗"} Images
                  </Badge>
                  <Badge variant={status?.capabilities?.supportsVideos ? "default" : "secondary"}>
                    {status?.capabilities?.supportsVideos ? "✓" : "✗"} Videos
                  </Badge>
                  <Badge variant={status?.capabilities?.supportsSearch ? "default" : "secondary"}>
                    {status?.capabilities?.supportsSearch ? "✓" : "✗"} Search
                  </Badge>
                  <Badge variant={status?.capabilities?.requiresAuthentication ? "destructive" : "default"}>
                    {status?.capabilities?.requiresAuthentication ? "Auth Required" : "Public API"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Content processing statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Posts Found</span>
                <span className="font-semibold">{stats?.totalPostsFound || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Posts Approved</span>
                <span className="font-semibold text-green-600">{stats?.postsApproved || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Posts Rejected</span>
                <span className="font-semibold text-red-600">{stats?.postsRejected || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Review</span>
                <span className="font-semibold text-yellow-600">{stats?.postsPending || 0}</span>
              </div>
              
              <hr />
              
              <div className="flex justify-between">
                <span>Approval Rate</span>
                <span className="font-semibold">
                  {Math.round((stats?.approvalRate || 0) * 100)}%
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Content Diversity</span>
                <span className="font-semibold">
                  {stats?.healthMetrics?.contentDiversity || 0}/4 types
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
          <CardDescription>Recent scanning activity and timestamps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Last Scan</span>
              <span>{status?.lastScanTime ? new Date(status.lastScanTime).toLocaleString() : 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span>Next Scheduled Scan</span>
              <span>{status?.nextScanTime ? new Date(status.nextScanTime).toLocaleString() : 'Not scheduled'}</span>
            </div>
            <div className="flex justify-between">
              <span>API Endpoint</span>
              <span className="text-sm text-blue-600">{status?.capabilities?.apiEndpoint}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}