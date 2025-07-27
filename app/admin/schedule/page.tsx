'use client'

import { useState, useEffect } from 'react'
import { ScheduleSettings } from '@/components/admin/ScheduleSettings'
import { QueueMonitor } from '@/components/admin/QueueMonitor'
import { PostingHistory } from '@/components/admin/PostingHistory'

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

  const handleManualTrigger = async (contentId?: number) => {
    try {
      const response = await fetch('/api/admin/schedule/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger posting')
      }

      await fetchScheduleData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handlePauseResume = async (paused: boolean) => {
    try {
      const response = await fetch('/api/admin/schedule/pause', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paused }),
      })

      if (!response.ok) {
        throw new Error('Failed to pause/resume scheduling')
      }

      await fetchScheduleData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchScheduleData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!scheduleData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">No schedule data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Posting Schedule</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <ScheduleSettings
            config={scheduleData.config}
            schedule={scheduleData.schedule}
            onConfigUpdate={handleConfigUpdate}
            onManualTrigger={handleManualTrigger}
            onPauseResume={handlePauseResume}
          />
          
          <QueueMonitor
            queueStatus={scheduleData.queueStatus}
            stats={scheduleData.stats}
            onRefresh={fetchScheduleData}
          />
        </div>
        
        <div>
          <PostingHistory onManualTrigger={handleManualTrigger} />
        </div>
      </div>
    </div>
  )
}