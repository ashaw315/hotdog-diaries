'use client'

import { useState, useEffect } from 'react'

interface PostingStats {
  todayPosts: number
  weekPosts: number
  successRate: number
  nextPostTime: Date
  queueHealth: {
    scheduled: number
    approved: number
    total: number
  }
}

interface RecentPost {
  id: number
  title: string
  content_type: string
  source_platform: string
  original_author: string
  posted_at: string
  view_count: number
  like_count: number
  is_featured: boolean
}

interface AvailableContent {
  id: number
  content_text: string | null
  content_type: string
  source_platform: string
  original_author: string | null
  confidence_score: number | null
  created_at: string
}

interface MealTime {
  hour: number
  minute: number
  name: string
}

interface PostingData {
  stats: PostingStats
  currentMealTime: MealTime | null
  nextMealTime: Date
  recentPosts: RecentPost[]
  availableContent: AvailableContent[]
  mealTimes: MealTime[]
}

interface PostingManagementProps {
  onRefresh?: () => void
}

export function PostingManagement({ onRefresh }: PostingManagementProps) {
  const [data, setData] = useState<PostingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [selectedContent, setSelectedContent] = useState<Set<number>>(new Set())
  const [postingMode, setPostingMode] = useState<'auto' | 'manual'>('auto')
  const [postingSettings, setPostingSettings] = useState({
    maxItems: 1,
    platformBalance: true,
    qualityThreshold: 0.6
  })

  useEffect(() => {
    fetchPostingData()
    const interval = setInterval(fetchPostingData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchPostingData = async () => {
    try {
      const response = await fetch('/api/admin/posting/manual')
      if (response.ok) {
        const postingData = await response.json()
        setData({
          ...postingData,
          nextMealTime: new Date(postingData.nextMealTime),
          stats: {
            ...postingData.stats,
            nextPostTime: new Date(postingData.stats.nextPostTime)
          }
        })
      }
    } catch (error) {
      console.error('Error fetching posting data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualPost = async () => {
    if (isPosting) return

    setIsPosting(true)
    try {
      const payload = postingMode === 'manual' && selectedContent.size > 0
        ? { contentIds: Array.from(selectedContent) }
        : {
            mode: 'auto',
            maxItems: postingSettings.maxItems,
            platformBalance: postingSettings.platformBalance,
            qualityThreshold: postingSettings.qualityThreshold
          }

      const response = await fetch('/api/admin/posting/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Posting result:', result)
        await fetchPostingData()
        setSelectedContent(new Set())
        onRefresh?.()
      } else {
        const error = await response.json()
        console.error('Posting failed:', error)
      }
    } catch (error) {
      console.error('Error posting content:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleContentSelect = (contentId: number) => {
    const newSelected = new Set(selectedContent)
    if (newSelected.has(contentId)) {
      newSelected.delete(contentId)
    } else {
      newSelected.add(contentId)
    }
    setSelectedContent(newSelected)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getHealthColor = (value: number, good: number, warning: number) => {
    if (value >= good) return 'text-success'
    if (value >= warning) return 'text-warning'
    return 'text-danger'
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'reddit': return '🤖'
      case 'unsplash': return '🖼️'
      case 'flickr': return '📷'
      case 'flickr': return '📷'
      case 'youtube': return '📺'
      default: return '🌐'
    }
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️'
      case 'video': return '🎥'
      case 'text': return '📝'
      case 'mixed': return '🎭'
      default: return '📄'
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner mb-sm"></div>
          <p>Loading posting management...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <p className="text-danger">Failed to load posting data</p>
          <button onClick={fetchPostingData} className="btn btn-primary">
            🔄 Retry
          </button>
        </div>
      </div>
    )
  }

  const isCurrentMealTime = data.currentMealTime !== null

  return (
    <div className="grid gap-lg">
      {/* Header & Stats */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between align-center">
            <div>
              <h2 className="flex align-center gap-sm">
                <span>🚀</span>
                Automated Posting Management
              </h2>
              <p className="text-muted">
                Monitor and control the automated hotdog posting system
              </p>
            </div>
            <button
              onClick={fetchPostingData}
              className="btn btn-sm"
              disabled={isLoading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="text-center p-md bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{data.stats.todayPosts}</div>
              <div className="text-sm text-muted">Posts Today</div>
            </div>
            <div className="text-center p-md bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{data.stats.weekPosts}</div>
              <div className="text-sm text-muted">Posts This Week</div>
            </div>
            <div className="text-center p-md bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">{data.stats.successRate}%</div>
              <div className="text-sm text-muted">Success Rate</div>
            </div>
            <div className="text-center p-md bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">
                {formatTime(data.stats.nextPostTime)}
              </div>
              <div className="text-sm text-muted">Next Auto Post</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-lg" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Manual Posting Controls */}
        <div className="card">
          <div className="card-header">
            <h3>Manual Posting Controls</h3>
            {isCurrentMealTime && (
              <div className="text-success text-sm">
                🎯 Current meal time: {data.currentMealTime.name}
              </div>
            )}
          </div>
          <div className="card-body">
            {/* Posting Mode */}
            <div className="mb-lg">
              <label className="block text-sm font-medium mb-sm">Posting Mode</label>
              <div className="flex gap-md">
                <label className="flex align-center gap-xs">
                  <input
                    type="radio"
                    name="postingMode"
                    value="auto"
                    checked={postingMode === 'auto'}
                    onChange={(e) => setPostingMode(e.target.value as 'auto')}
                  />
                  <span>🤖 Auto-select Content</span>
                </label>
                <label className="flex align-center gap-xs">
                  <input
                    type="radio"
                    name="postingMode"
                    value="manual"
                    checked={postingMode === 'manual'}
                    onChange={(e) => setPostingMode(e.target.value as 'manual')}
                  />
                  <span>🎯 Select Specific Content</span>
                </label>
              </div>
            </div>

            {/* Auto-select Settings */}
            {postingMode === 'auto' && (
              <div className="grid gap-md mb-lg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div>
                  <label className="block text-sm font-medium mb-xs">Max Items</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={postingSettings.maxItems}
                    onChange={(e) => setPostingSettings(prev => ({
                      ...prev,
                      maxItems: parseInt(e.target.value)
                    }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-xs">Quality Threshold</label>
                  <select
                    value={postingSettings.qualityThreshold}
                    onChange={(e) => setPostingSettings(prev => ({
                      ...prev,
                      qualityThreshold: parseFloat(e.target.value)
                    }))}
                    className="form-select"
                  >
                    <option value={0.8}>High (80%)</option>
                    <option value={0.6}>Medium (60%)</option>
                    <option value={0.4}>Low (40%)</option>
                    <option value={0}>Any Quality</option>
                  </select>
                </div>
                <div>
                  <label className="flex align-center gap-xs">
                    <input
                      type="checkbox"
                      checked={postingSettings.platformBalance}
                      onChange={(e) => setPostingSettings(prev => ({
                        ...prev,
                        platformBalance: e.target.checked
                      }))}
                    />
                    <span className="text-sm">Platform Balance</span>
                  </label>
                </div>
              </div>
            )}

            {/* Manual Selection */}
            {postingMode === 'manual' && (
              <div className="mb-lg">
                <div className="flex justify-between align-center mb-sm">
                  <h4>Select Content to Post</h4>
                  <span className="text-sm text-muted">
                    {selectedContent.size} selected
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded">
                  {data.availableContent.length === 0 ? (
                    <div className="p-md text-center text-muted">
                      No approved content available
                    </div>
                  ) : (
                    data.availableContent.map((content) => (
                      <label
                        key={content.id}
                        className="flex align-center gap-sm p-sm border-b hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedContent.has(content.id)}
                          onChange={() => handleContentSelect(content.id)}
                        />
                        <div className="flex align-center gap-xs">
                          <span>{getContentTypeIcon(content.content_type)}</span>
                          <span>{getPlatformIcon(content.source_platform)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm">
                            {content.content_text?.substring(0, 100) || 'No text content'}...
                          </div>
                          <div className="text-xs text-muted">
                            {content.original_author} • {content.source_platform}
                            {content.confidence_score && (
                              <span> • {Math.round(content.confidence_score * 100)}% confidence</span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Post Button */}
            <button
              onClick={handleManualPost}
              disabled={isPosting || (postingMode === 'manual' && selectedContent.size === 0)}
              className="btn btn-primary btn-lg w-full"
            >
              {isPosting ? '⏳ Posting...' : '🚀 Post Now'}
            </button>
          </div>
        </div>

        {/* Queue Health & Meal Times */}
        <div className="grid gap-md">
          {/* Queue Health */}
          <div className="card">
            <div className="card-header">
              <h3>Queue Health</h3>
            </div>
            <div className="card-body">
              <div className="space-y-sm">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className={`font-bold ${getHealthColor(data.stats.queueHealth.scheduled, 10, 5)}`}>
                    {data.stats.queueHealth.scheduled}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Approved</span>
                  <span className={`font-bold ${getHealthColor(data.stats.queueHealth.approved, 20, 10)}`}>
                    {data.stats.queueHealth.approved}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Ready</span>
                  <span className="font-bold">
                    {data.stats.queueHealth.total}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Meal Times */}
          <div className="card">
            <div className="card-header">
              <h3>Posting Schedule</h3>
            </div>
            <div className="card-body">
              <div className="space-y-xs">
                {data.mealTimes.map((mealTime) => {
                  const isNext = data.currentMealTime?.name === mealTime.name ||
                    (!isCurrentMealTime && formatTime(data.nextMealTime) === formatTime(new Date().setHours(mealTime.hour, mealTime.minute)))
                  
                  return (
                    <div
                      key={mealTime.name}
                      className={`flex justify-between p-xs rounded ${
                        isNext ? 'bg-blue-100 text-blue-800' : ''
                      }`}
                    >
                      <span className="capitalize">{mealTime.name}</span>
                      <span className="font-mono">
                        {String(mealTime.hour).padStart(2, '0')}:{String(mealTime.minute).padStart(2, '0')}
                        {isNext && ' 🎯'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="card">
        <div className="card-header">
          <h3>Recent Posts</h3>
        </div>
        <div className="card-body">
          {data.recentPosts.length === 0 ? (
            <div className="text-center text-muted py-md">
              No posts yet
            </div>
          ) : (
            <div className="grid gap-sm">
              {data.recentPosts.slice(0, 5).map((post) => (
                <div key={post.id} className="flex justify-between align-center p-sm bg-gray-50 rounded">
                  <div className="flex align-center gap-sm">
                    <span>{getContentTypeIcon(post.content_type)}</span>
                    <span>{getPlatformIcon(post.source_platform)}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {post.title}
                        {post.is_featured && <span className="ml-xs text-yellow-500">⭐</span>}
                      </div>
                      <div className="text-xs text-muted">
                        {post.original_author} • {formatDate(post.posted_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted">
                    👁️ {post.view_count} • ❤️ {post.like_count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}