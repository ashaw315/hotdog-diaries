'use client'

import React, { useState, useEffect } from 'react'
import { Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2, Eye } from 'lucide-react'

interface DailyScheduleItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
  scheduled_time: string
  title?: string
  confidence_score?: number
  status?: 'scheduled' | 'posted' | 'upcoming'
}

interface NextPost {
  time: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
}

interface DailyScheduleData {
  date: string
  scheduled_content: DailyScheduleItem[]
  summary: {
    total_posts: number
    platforms: { [platform: string]: number }
    content_types: { [type: string]: number }
    diversity_score: number
    posted_count: number
    scheduled_count: number
    upcoming_count: number
    total_today: number
    next_post?: NextPost | null
  }
}

interface ProjectedSlot {
  time: string
  iso: string
  status: 'pending'
  hour: number
}

interface ProjectedScheduleData {
  date: string
  projected_schedule: ProjectedSlot[]
  timezone: string
  total_slots: number
}

interface ForecastItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source?: string
  title?: string
  url?: string
  confidence: number
}

interface ForecastSlot {
  slot_index: number
  time_local: string
  iso: string
  status: 'posted' | 'upcoming' | 'missed'
  content: ForecastItem | null
  scheduled_post_time?: string
  actual_posted_at?: string | null
  reasoning: string
}

interface ForecastData {
  date: string
  timezone: 'America/New_York'
  slots: ForecastSlot[]
  summary: {
    total: number
    posted: number
    upcoming: number
    missed: number
    platforms: Record<string, number>
    content_types: Record<string, number>
    diversity_score: number
  }
}

interface DailyScheduleOverviewProps {
  selectedDate?: string
  onRefresh?: () => void
}

const PLATFORM_COLORS: { [key: string]: string } = {
  reddit: 'bg-orange-100 text-orange-800',
  bluesky: 'bg-blue-100 text-blue-800',
  tumblr: 'bg-purple-100 text-purple-800',
  lemmy: 'bg-green-100 text-green-800',
  giphy: 'bg-pink-100 text-pink-800',
  imgur: 'bg-gray-100 text-gray-800',
  unknown: 'bg-gray-100 text-gray-600'
}

function getPlatformColor(platform: string): { bg: string; text: string } {
  const colors: { [key: string]: { bg: string; text: string } } = {
    reddit: { bg: '#fff7ed', text: '#9a3412' },
    bluesky: { bg: '#eff6ff', text: '#1e40af' },
    tumblr: { bg: '#faf5ff', text: '#7c2d12' },
    lemmy: { bg: '#ecfdf5', text: '#065f46' },
    giphy: { bg: '#fdf2f8', text: '#be185d' },
    imgur: { bg: '#f9fafb', text: '#374151' },
    pixabay: { bg: '#f0fdf4', text: '#15803d' },
    youtube: { bg: '#fef2f2', text: '#dc2626' },
    emergency: { bg: '#fffbeb', text: '#92400e' }
  }
  return colors[platform] || colors.imgur
}

const CONTENT_TYPE_ICONS: { [key: string]: string } = {
  image: '🖼️',
  video: '🎥',
  text: '📝',
  link: '🔗'
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return 'Invalid time'
  }
}

function formatDistanceToNow(date: Date): string {
  try {
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    
    if (diffMs <= 0) {
      return 'just passed'
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`
    } else if (diffHours > 0) {
      const remainingMinutes = diffMinutes % 60
      if (remainingMinutes > 0) {
        return `in ${diffHours}h ${remainingMinutes}m`
      }
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
    } else if (diffMinutes > 0) {
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`
    } else {
      return 'in less than a minute'
    }
  } catch {
    return 'unknown'
  }
}

function getDiversityStatus(score: number): { label: string; color: string; icon: React.ReactNode } {
  if (score >= 80) {
    return {
      label: 'Excellent Diversity',
      color: 'text-green-500',
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  } else if (score >= 50) {
    return {
      label: 'Good Diversity',
      color: 'text-yellow-500',
      icon: <TrendingUp className="w-4 h-4" />
    }
  } else {
    return {
      label: 'Low Diversity',
      color: 'text-red-500',
      icon: <AlertCircle className="w-4 h-4" />
    }
  }
}

export default function DailyScheduleOverview({ selectedDate, onRefresh }: DailyScheduleOverviewProps) {
  const [data, setData] = useState<DailyScheduleData | null>(null)
  const [projected, setProjected] = useState<ProjectedScheduleData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectedLoading, setProjectedLoading] = useState(true)
  const [forecastLoading, setForecastLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetDate = selectedDate || new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchDailySchedule()
    fetchProjectedSchedule()
    fetchForecast()
  }, [targetDate])

  const fetchDailySchedule = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Environment-safe base URL for deployment parity
      const baseUrl = 
        process.env.NEXT_PUBLIC_BASE_URL ?? 
        (typeof window === 'undefined' 
          ? 'https://hotdog-diaries.vercel.app' 
          : '')
      
      const apiUrl = `${baseUrl}/api/admin/schedule/daily?date=${targetDate}`
      console.log("🌐 Fetching from:", apiUrl)
      
      const response = await fetch(apiUrl, {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        throw new Error(`Schedule API failed: ${response.status}`)
      }
      
      const dailyData: DailyScheduleData = await response.json()
      console.log("✅ Daily schedule fetched", dailyData)
      setData(dailyData)
    } catch (err) {
      console.error("❌ Schedule fetch failed:", err)
      setError(err instanceof Error ? err.message : 'Failed to fetch daily schedule')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectedSchedule = async () => {
    try {
      setProjectedLoading(true)
      
      // Environment-safe base URL for deployment parity
      const baseUrl = 
        process.env.NEXT_PUBLIC_BASE_URL ?? 
        (typeof window === 'undefined' 
          ? 'https://hotdog-diaries.vercel.app' 
          : '')
      
      const apiUrl = `${baseUrl}/api/admin/schedule/projected?date=${targetDate}`
      console.log("📅 Fetching projected schedule from:", apiUrl)
      
      const response = await fetch(apiUrl, {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        throw new Error(`Projected schedule API failed: ${response.status}`)
      }
      
      const projectedData: ProjectedScheduleData = await response.json()
      console.log("✅ Projected schedule fetched", projectedData)
      setProjected(projectedData)
    } catch (err) {
      console.error("❌ Projected schedule fetch failed:", err)
      // Don't set error for projected schedule, just log it
    } finally {
      setProjectedLoading(false)
    }
  }

  const fetchForecast = async () => {
    try {
      setForecastLoading(true)
      
      // Environment-safe base URL for deployment parity
      const baseUrl = 
        process.env.NEXT_PUBLIC_BASE_URL ?? 
        (typeof window === 'undefined' 
          ? 'https://hotdog-diaries.vercel.app' 
          : '')
      
      const apiUrl = `${baseUrl}/api/admin/schedule/forecast?date=${targetDate}`
      console.log("🔮 Fetching forecast from:", apiUrl)
      
      const response = await fetch(apiUrl, {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        throw new Error(`Forecast API failed: ${response.status}`)
      }
      
      const forecastData: ForecastData = await response.json()
      console.log("✅ Forecast fetched", forecastData)
      setForecast(forecastData)
    } catch (err) {
      console.error("❌ Forecast fetch failed:", err)
      // Don't set error for forecast, just log it
    } finally {
      setForecastLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchDailySchedule()
    fetchProjectedSchedule()
    fetchForecast()
    onRefresh?.()
  }

  if (loading) {
    return (
      <div className="schedule-admin-card">
        <div className="schedule-admin-card-header">
          <h2>📅 Daily Scheduled Content</h2>
        </div>
        <div className="schedule-admin-card-body">
          <div className="schedule-loading">
            <div className="schedule-spinner"></div>
            <span style={{ marginLeft: 'var(--spacing-sm)' }}>Loading daily schedule...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="schedule-admin-card">
        <div className="schedule-admin-card-header">
          <h2>📅 Daily Scheduled Content</h2>
        </div>
        <div className="schedule-admin-card-body">
          <div className="schedule-error">
            <h2>📅 Schedule Error</h2>
            <p>{error}</p>
            <button onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="schedule-admin-card">
        <div className="schedule-admin-card-header">
          <h2>📅 Daily Scheduled Content</h2>
        </div>
        <div className="schedule-admin-card-body">
          <p>Loading daily schedule...</p>
        </div>
      </div>
    )
  }
  
  const displayedContent = data?.scheduled_content ?? []

  const diversityStatus = getDiversityStatus(data.summary.diversity_score)
  
  return (
    <div className="schedule-admin-card">
      {/* Header */}
      <div className="schedule-admin-card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>📅 Daily Scheduled Content</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <span style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--color-text-secondary)' 
            }}>
              {data.date}
            </span>
            <button
              onClick={handleRefresh}
              className="schedule-btn schedule-btn-secondary"
              title="Refresh"
              style={{ padding: 'var(--spacing-xs)' }}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="schedule-admin-card-body">
        {/* Summary Stats */}
        <div className="schedule-queue-summary">
          <div className="schedule-queue-stat">
            <div className="schedule-queue-number">{data.summary.total_today}</div>
            <p className="schedule-queue-label">Total Posts</p>
          </div>
          
          <div className="schedule-queue-stat posted">
            <div className="schedule-queue-number">{data.summary.posted_count}</div>
            <p className="schedule-queue-label">Posted</p>
          </div>
          
          <div className="schedule-queue-stat">
            <div className="schedule-queue-number">{data.summary.upcoming_count}</div>
            <p className="schedule-queue-label">Upcoming</p>
          </div>
          
          <div className="schedule-queue-stat">
            <div className="schedule-queue-number">{Object.keys(data.summary.platforms).length}</div>
            <p className="schedule-queue-label">Platforms</p>
          </div>
        </div>

        {/* Zero Content Alert */}
        {data.summary.total_today === 0 ? (
          <div className="schedule-status-indicator disabled" style={{ 
            width: '100%', 
            justifyContent: 'center',
            marginBottom: 'var(--spacing-lg)' 
          }}>
            <span className="schedule-status-dot"></span>
            <span>No content scheduled or posted for this date</span>
          </div>
        ) : (
          /* Diversity Status */
          <div className={`schedule-status-indicator ${
            data.summary.diversity_score >= 80 ? 'enabled' : 
            data.summary.diversity_score >= 50 ? 'warning' : 'disabled'
          }`} style={{ 
            width: '100%', 
            justifyContent: 'flex-start',
            marginBottom: 'var(--spacing-lg)' 
          }}>
            <span className="schedule-status-dot"></span>
            <span>{diversityStatus.label} ({data.summary.diversity_score}%)</span>
            {data.summary.diversity_score < 50 && (
              <span style={{ 
                fontSize: 'var(--font-size-xs)', 
                marginLeft: 'var(--spacing-sm)',
                opacity: 0.8
              }}>
                - Consider adding more variety in platforms or content types
              </span>
            )}
          </div>
        )}

        {/* Next Scheduled Post Section */}
        {data.summary.next_post && (
          <div className="schedule-admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div className="schedule-admin-card-header">
              <h3 style={{ 
                fontSize: 'var(--font-size-lg)', 
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: 0
              }}>
                ⏰ Next Scheduled Post
              </h3>
            </div>
            <div className="schedule-admin-card-body">
              <p style={{ 
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: '0 0 var(--spacing-sm) 0'
              }}>
                <strong>{formatTime(data.summary.next_post.time)}</strong>{' '}
                <span style={{ 
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 'var(--font-weight-normal)'
                }}>
                  ({formatDistanceToNow(new Date(data.summary.next_post.time))})
                </span>
              </p>
              
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)', 
                marginTop: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-full)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  backgroundColor: getPlatformColor(data.summary.next_post.platform).bg,
                  color: getPlatformColor(data.summary.next_post.platform).text,
                  border: '1px solid var(--color-border)'
                }}>
                  {data.summary.next_post.platform}
                </span>
                
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--border-radius-full)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  backgroundColor: 'var(--color-gray-100, #f3f4f6)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)'
                }}>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>
                    {CONTENT_TYPE_ICONS[data.summary.next_post.content_type] || '📄'}
                  </span>
                  {data.summary.next_post.content_type}
                </span>
              </div>
              
              <p style={{ 
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: 0
              }}>
                Source: {data.summary.next_post.source}
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Posts Today Subsection */}
        {data.summary.upcoming_count > 1 && (
          <div className="schedule-admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div className="schedule-admin-card-header">
              <h4 style={{ 
                fontSize: 'var(--font-size-md)', 
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: 0
              }}>
                📅 Upcoming Posts Today
              </h4>
            </div>
            <div className="schedule-admin-card-body">
              <p style={{ 
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: 0
              }}>
                {data.summary.upcoming_count - (data.summary.next_post ? 1 : 0)} more posts scheduled after the next one
              </p>
            </div>
          </div>
        )}


        {/* Scheduled Content List */}
        {displayedContent.length === 0 ? (
          <div className="schedule-empty-state">
            <h3>📅 No Content Scheduled</h3>
            <p>No content scheduled for {data.date}</p>
            <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
              Content will appear here once scheduling is completed
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h4 style={{ 
              fontSize: 'var(--font-size-lg)', 
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--spacing-md)'
            }}>
              Scheduled Posts ({displayedContent.length})
            </h4>
            
            <div style={{ 
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ 
                  backgroundColor: 'var(--color-card-header)',
                  borderBottom: '1px solid var(--color-border)'
                }}>
                  <tr>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Time
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Platform
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Type
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Source
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Content
                    </th>
                    <th style={{ 
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'white' }}>
                  {displayedContent.map((item, index) => (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: index < displayedContent.length - 1 ? '1px solid var(--color-border)' : 'none',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gray-50, #f9fafb)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        whiteSpace: 'nowrap',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-primary)'
                      }}>
                        {formatTime(item.scheduled_time)}
                      </td>
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--border-radius-full)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 'var(--font-weight-medium)',
                          backgroundColor: getPlatformColor(item.platform).bg,
                          color: getPlatformColor(item.platform).text
                        }}>
                          {item.platform}
                        </span>
                      </td>
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                          <span style={{ fontSize: 'var(--font-size-lg)' }}>
                            {CONTENT_TYPE_ICONS[item.content_type] || '📄'}
                          </span>
                          <span style={{ 
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'capitalize'
                          }}>
                            {item.content_type}
                          </span>
                        </div>
                      </td>
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-primary)',
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.source}
                      </td>
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.title || 'No preview available'}
                      </td>
                      <td style={{ 
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        whiteSpace: 'nowrap'
                      }}>
                        <span className={`schedule-status-indicator ${
                          item.status === 'posted' ? 'enabled' : 
                          item.status === 'upcoming' ? 'warning' : 
                          'disabled'
                        }`} style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
                          <span className="schedule-status-dot"></span>
                          {item.status === 'posted' ? '✅ Posted' : 
                           item.status === 'upcoming' ? '🕒 Upcoming' : 
                           '📅 Scheduled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Platform & Content Type Breakdown */}
        {data.summary.total_today > 0 && (
          <div style={{ 
            marginTop: 'var(--spacing-xl)',
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-xl)'
          }}>
            {/* Platform Distribution */}
            <div>
              <h4 style={{ 
                fontSize: 'var(--font-size-lg)', 
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Platform Distribution
              </h4>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--spacing-sm)' 
              }}>
                {Object.entries(data.summary.platforms).map(([platform, count]) => (
                  <div 
                    key={platform} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                    }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      borderRadius: 'var(--border-radius-full)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      backgroundColor: getPlatformColor(platform).bg,
                      color: getPlatformColor(platform).text
                    }}>
                      {platform}
                    </span>
                    <span style={{ 
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)'
                    }}>
                      {count} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Type Distribution */}
            <div>
              <h4 style={{ 
                fontSize: 'var(--font-size-lg)', 
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                Content Type Distribution
              </h4>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--spacing-sm)' 
              }}>
                {Object.entries(data.summary.content_types).map(([type, count]) => (
                  <div 
                    key={type} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 'var(--spacing-sm)' 
                    }}>
                      <span style={{ fontSize: 'var(--font-size-lg)' }}>
                        {CONTENT_TYPE_ICONS[type] || '📄'}
                      </span>
                      <span style={{ 
                        fontSize: 'var(--font-size-sm)',
                        textTransform: 'capitalize',
                        color: 'var(--color-text-primary)'
                      }}>
                        {type}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)'
                    }}>
                      {count} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Forecast Section (What Will Post) */}
        {forecast && forecast.slots.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-xl)' }}>
            <div className="schedule-admin-card">
              <div className="schedule-admin-card-header">
                <h4 style={{ 
                  fontSize: 'var(--font-size-lg)', 
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  margin: 0
                }}>
                  🔮 Forecast - What Will Post ({forecast.slots.length} slots)
                </h4>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: 'var(--spacing-xs) 0 0 0'
                }}>
                  Deterministic content selection for {forecast.date} • Posted: {forecast.summary.posted}, Upcoming: {forecast.summary.upcoming}, Missed: {forecast.summary.missed} • Diversity Score: {forecast.summary.diversity_score}%
                </p>
              </div>
              <div className="schedule-admin-card-body">
                {forecastLoading ? (
                  <div className="schedule-loading">
                    <div className="schedule-spinner"></div>
                    <span style={{ marginLeft: 'var(--spacing-sm)' }}>Loading forecast...</span>
                  </div>
                ) : (
                  <div style={{ 
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ 
                        backgroundColor: 'var(--color-card-header)',
                        borderBottom: '1px solid var(--color-border)'
                      }}>
                        <tr>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Time
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Status
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Platform/Type
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Content
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Selection Reasoning
                          </th>
                        </tr>
                      </thead>
                      <tbody style={{ backgroundColor: 'white' }}>
                        {forecast.slots.map((slot, index) => (
                          <tr 
                            key={slot.slot_index} 
                            style={{ 
                              borderBottom: index < forecast.slots.length - 1 ? '1px solid var(--color-border)' : 'none',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gray-50, #f9fafb)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              whiteSpace: 'nowrap',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-medium)',
                              color: 'var(--color-text-primary)'
                            }}>
                              {slot.time_local}
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              whiteSpace: 'nowrap'
                            }}>
                              <span className={`schedule-status-indicator ${
                                slot.status === 'posted' ? 'enabled' : 
                                slot.status === 'upcoming' ? 'warning' : 
                                slot.status === 'missed' ? 'disabled' :
                                'disabled'
                              }`} style={{ 
                                padding: 'var(--spacing-xs) var(--spacing-sm)' 
                              }}>
                                <span className="schedule-status-dot"></span>
                                {slot.status === 'posted' ? '✅ Posted' : 
                                 slot.status === 'upcoming' ? '🕒 Upcoming' : 
                                 slot.status === 'missed' ? '⏳ Missed' :
                                 '🔮 Projected'}
                              </span>
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              whiteSpace: 'nowrap'
                            }}>
                              {slot.content ? (
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    borderRadius: 'var(--border-radius-full)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 'var(--font-weight-medium)',
                                    backgroundColor: getPlatformColor(slot.content.platform).bg,
                                    color: getPlatformColor(slot.content.platform).text
                                  }}>
                                    {slot.content.platform}
                                  </span>
                                  <span style={{ 
                                    fontSize: 'var(--font-size-lg)',
                                    marginRight: 'var(--spacing-xs)'
                                  }}>
                                    {CONTENT_TYPE_ICONS[slot.content.content_type] || '📄'}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ 
                                  fontSize: 'var(--font-size-sm)',
                                  color: 'var(--color-text-secondary)',
                                  fontStyle: 'italic'
                                }}>
                                  No content available
                                </span>
                              )}
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--color-text-secondary)',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {slot.content ? (
                                <div>
                                  <div style={{ 
                                    fontWeight: 'var(--font-weight-medium)', 
                                    color: 'var(--color-text-primary)',
                                    marginBottom: 'var(--spacing-xs)'
                                  }}>
                                    {slot.content.title ? 
                                      (slot.content.title.length > 50 ? 
                                        slot.content.title.substring(0, 50) + '...' : 
                                        slot.content.title) : 
                                      'No preview'
                                    }
                                  </div>
                                  {slot.content.source && (
                                    <div style={{ 
                                      fontSize: 'var(--font-size-xs)',
                                      color: 'var(--color-text-secondary)'
                                    }}>
                                      by {slot.content.source}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                'No content scheduled'
                              )}
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--color-text-secondary)',
                              maxWidth: '180px',
                              lineHeight: '1.4'
                            }}>
                              {slot.reasoning}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Projected Schedule Section */}
        {projected && projected.projected_schedule.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-xl)' }}>
            <div className="schedule-admin-card">
              <div className="schedule-admin-card-header">
                <h4 style={{ 
                  fontSize: 'var(--font-size-lg)', 
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  margin: 0
                }}>
                  📅 Projected Posts ({projected.total_slots})
                </h4>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: 'var(--spacing-xs) 0 0 0'
                }}>
                  Expected posting schedule for {projected.date}
                </p>
              </div>
              <div className="schedule-admin-card-body">
                {projectedLoading ? (
                  <div className="schedule-loading">
                    <div className="schedule-spinner"></div>
                    <span style={{ marginLeft: 'var(--spacing-sm)' }}>Loading projected schedule...</span>
                  </div>
                ) : (
                  <div style={{ 
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ 
                        backgroundColor: 'var(--color-card-header)',
                        borderBottom: '1px solid var(--color-border)'
                      }}>
                        <tr>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Time
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Status
                          </th>
                          <th style={{ 
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            textAlign: 'left',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Expected Cron Job
                          </th>
                        </tr>
                      </thead>
                      <tbody style={{ backgroundColor: 'white' }}>
                        {projected.projected_schedule.map((slot, index) => (
                          <tr 
                            key={slot.iso} 
                            style={{ 
                              borderBottom: index < projected.projected_schedule.length - 1 ? '1px solid var(--color-border)' : 'none',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gray-50, #f9fafb)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              whiteSpace: 'nowrap',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-medium)',
                              color: 'var(--color-text-primary)'
                            }}>
                              {slot.time}
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              whiteSpace: 'nowrap'
                            }}>
                              <span className="schedule-status-indicator warning" style={{ 
                                padding: 'var(--spacing-xs) var(--spacing-sm)' 
                              }}>
                                <span className="schedule-status-dot"></span>
                                🕒 Pending
                              </span>
                            </td>
                            <td style={{ 
                              padding: 'var(--spacing-sm) var(--spacing-md)',
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--color-text-secondary)'
                            }}>
                              Automatic posting at {slot.time}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}