'use client'

import { useState, useEffect } from 'react'
import DailyScheduleOverview from '@/components/admin/schedule/DailyScheduleOverview'
import './admin-schedule.css'

interface ScheduleData {
  config: {
    id: number
    meal_times: string[]
    timezone: string
    is_enabled: boolean
    created_at: string
    updated_at: string
  }
  schedule: {
    nextPostTime: string
    nextMealTime: string
    timeUntilNext: number
    isPostingTime: boolean
    todaysSchedule: Array<{
      time: string
      posted: boolean
      scheduledDate: string
    }>
  }
  queueStatus: {
    totalApproved: number
    totalPending: number
    totalPosted: number
    isHealthy: boolean
    alertLevel: 'none' | 'low' | 'critical'
    message: string
  }
  stats: {
    todaysPosts: number
    thisWeeksPosts: number
    thisMonthsPosts: number
    totalPosts: number
    avgPostsPerDay: number
  }
}

export default function SchedulePage() {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])

  const fetchScheduleData = async () => {
    try {
      const response = await fetch('/api/admin/schedule')
      if (!response.ok) {
        throw new Error('Failed to fetch schedule data')
      }
      const data = await response.json()
      setScheduleData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScheduleData()
    const interval = setInterval(fetchScheduleData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const handleConfigUpdate = async (newConfig: Partial<ScheduleData['config']>) => {
    try {
      const response = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      })

      if (!response.ok) {
        throw new Error('Failed to update schedule config')
      }

      await fetchScheduleData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleManualTrigger = async () => {
    try {
      // Mock manual trigger - just refresh data
      console.log('Manual trigger activated (mock)')
      await fetchScheduleData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handlePauseResume = async (paused: boolean) => {
    try {
      const response = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: !paused }),
      })

      if (!response.ok) {
        throw new Error('Failed to pause/resume scheduling')
      }

      await fetchScheduleData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const formatTimeUntilNext = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="schedule-admin-container">
        <div className="schedule-loading">
          <div className="schedule-spinner"></div>
          <span style={{ marginLeft: '0.5rem' }}>Loading schedule data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="schedule-admin-container">
        <div className="schedule-error">
          <h2>📅 Schedule Error</h2>
          <p>{error}</p>
          <button onClick={fetchScheduleData}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!scheduleData) {
    return (
      <div className="schedule-admin-container">
        <div className="schedule-empty-state">
          <h3>📅 No Schedule Data</h3>
          <p>No schedule data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="schedule-admin-container">
      {/* Header */}
      <div className="schedule-admin-header">
        <div className="schedule-header-actions">
          <div>
            <h1>📅 Posting Schedule</h1>
            <p>Manage automated posting times and monitor queue status</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={fetchScheduleData}
              disabled={loading}
              className="schedule-btn schedule-btn-primary"
            >
              {loading && <span className="schedule-spinner"></span>}
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Next Post Info */}
      <div className="schedule-next-post">
        <h3>⏰ Next Scheduled Post</h3>
        <div className="schedule-next-time">
          {new Date(scheduleData.schedule.nextPostTime).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
        <p className="schedule-countdown">
          in {formatTimeUntilNext(scheduleData.schedule.timeUntilNext)}
        </p>
      </div>

      <div className="schedule-main-grid">
        {/* Left Column */}
        <div className="schedule-left-column">
          {/* Schedule Settings */}
          <div className="schedule-admin-card">
            <div className="schedule-admin-card-header">
              <h2>⚙️ Schedule Configuration</h2>
            </div>
            <div className="schedule-admin-card-body">
              <div className="schedule-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                  <span>Automatic Posting</span>
                  <div className="schedule-toggle">
                    <input 
                      type="checkbox" 
                      checked={scheduleData.config.is_enabled}
                      onChange={(e) => handlePauseResume(!e.target.checked)}
                    />
                    <span className="schedule-toggle-slider"></span>
                  </div>
                </div>
                <div className={`schedule-status-indicator ${scheduleData.config.is_enabled ? 'enabled' : 'disabled'}`}>
                  <span className="schedule-status-dot"></span>
                  {scheduleData.config.is_enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              <div className="schedule-form-group">
                <label className="schedule-form-label">Timezone</label>
                <select 
                  className="schedule-form-select"
                  value={scheduleData.config.timezone}
                  onChange={(e) => handleConfigUpdate({ timezone: e.target.value })}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="schedule-form-group">
                <label className="schedule-form-label">Daily Schedule</label>
                <div className="schedule-times-grid">
                  {scheduleData.schedule.todaysSchedule.map((slot, index) => (
                    <div 
                      key={index} 
                      className={`schedule-time-slot ${
                        slot.posted ? 'posted' : 
                        slot.time === scheduleData.schedule.nextMealTime ? 'next' : 'pending'
                      }`}
                    >
                      <div className="schedule-time">{slot.time}</div>
                      <div className={`schedule-time-status ${
                        slot.posted ? 'posted' : 
                        slot.time === scheduleData.schedule.nextMealTime ? 'next' : 'pending'
                      }`}>
                        {slot.posted ? '✅ Posted' : 
                         slot.time === scheduleData.schedule.nextMealTime ? '🎯 Next' : '⏳ Pending'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)' }}>
                <button 
                  onClick={handleManualTrigger}
                  className="schedule-btn schedule-btn-success"
                >
                  🚀 Post Now
                </button>
                <button 
                  onClick={() => handlePauseResume(!scheduleData.config.is_enabled)}
                  className={`schedule-btn ${scheduleData.config.is_enabled ? 'schedule-btn-warning' : 'schedule-btn-success'}`}
                >
                  {scheduleData.config.is_enabled ? '⏸️ Pause' : '▶️ Resume'}
                </button>
              </div>
            </div>
          </div>

          {/* Queue Status */}
          <div className="schedule-admin-card">
            <div className="schedule-admin-card-header">
              <h2>📦 Content Queue Status</h2>
            </div>
            <div className="schedule-admin-card-body">
              <div className="schedule-queue-summary">
                <div className="schedule-queue-stat approved">
                  <div className="schedule-queue-number">{scheduleData.queueStatus.totalApproved}</div>
                  <p className="schedule-queue-label">Approved</p>
                </div>
                <div className="schedule-queue-stat pending">
                  <div className="schedule-queue-number">{scheduleData.queueStatus.totalPending}</div>
                  <p className="schedule-queue-label">Pending</p>
                </div>
                <div className="schedule-queue-stat posted">
                  <div className="schedule-queue-number">{scheduleData.queueStatus.totalPosted.toLocaleString()}</div>
                  <p className="schedule-queue-label">Posted</p>
                </div>
              </div>

              <div className={`schedule-status-indicator ${
                scheduleData.queueStatus.alertLevel === 'none' ? 'enabled' :
                scheduleData.queueStatus.alertLevel === 'low' ? 'warning' : 'disabled'
              }`} style={{ width: '100%', justifyContent: 'center' }}>
                <span className="schedule-status-dot"></span>
                {scheduleData.queueStatus.message}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Posting Stats */}
        <div className="schedule-admin-card">
          <div className="schedule-admin-card-header">
            <h2>📊 Posting Statistics</h2>
          </div>
          <div className="schedule-admin-card-body">
            <div className="schedule-queue-summary">
              <div className="schedule-queue-stat">
                <div className="schedule-queue-number">{scheduleData.stats.todaysPosts}</div>
                <p className="schedule-queue-label">Today</p>
              </div>
              <div className="schedule-queue-stat">
                <div className="schedule-queue-number">{scheduleData.stats.thisWeeksPosts}</div>
                <p className="schedule-queue-label">This Week</p>
              </div>
              <div className="schedule-queue-stat">
                <div className="schedule-queue-number">{scheduleData.stats.thisMonthsPosts}</div>
                <p className="schedule-queue-label">This Month</p>
              </div>
              <div className="schedule-queue-stat">
                <div className="schedule-queue-number">{scheduleData.stats.totalPosts.toLocaleString()}</div>
                <p className="schedule-queue-label">Total Posts</p>
              </div>
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                {scheduleData.stats.avgPostsPerDay.toFixed(1)}
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                Average posts per day
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Schedule Overview */}
      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <DailyScheduleOverview 
          selectedDate={selectedDate}
          onRefresh={fetchScheduleData}
        />
      </div>

      {/* Date Selector */}
      <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
        <label htmlFor="date-selector" style={{ 
          display: 'block', 
          marginBottom: 'var(--spacing-sm)', 
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)'
        }}>
          View scheduled content for:
        </label>
        <input
          id="date-selector"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="schedule-form-input"
          style={{ 
            width: 'auto',
            margin: '0 auto',
            textAlign: 'center'
          }}
        />
      </div>
    </div>
  )
}