'use client'

import { useState } from 'react'

interface ScheduleConfig {
  id: number
  meal_times: string[]
  timezone: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

interface PostingSchedule {
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

interface ScheduleSettingsProps {
  config: ScheduleConfig
  schedule: PostingSchedule
  onConfigUpdate: (config: Partial<ScheduleConfig>) => Promise<void>
  onManualTrigger: (contentId?: number) => Promise<void>
  onPauseResume: (paused: boolean) => Promise<void>
}

export function ScheduleSettings({
  config,
  schedule,
  onConfigUpdate,
  onManualTrigger,
  onPauseResume
}: ScheduleSettingsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTimes, setEditedTimes] = useState<string[]>(config.meal_times)
  const [editedTimezone, setEditedTimezone] = useState(config.timezone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatTimeUntilNext = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)

      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      for (const time of editedTimes) {
        if (!timeRegex.test(time)) {
          throw new Error(`Invalid time format: ${time}. Use HH:MM format.`)
        }
      }

      if (editedTimes.length === 0) {
        throw new Error('At least one meal time is required')
      }

      if (editedTimes.length > 10) {
        throw new Error('Maximum 10 meal times allowed')
      }

      await onConfigUpdate({
        meal_times: editedTimes.sort(),
        timezone: editedTimezone
      })

      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditedTimes(config.meal_times)
    setEditedTimezone(config.timezone)
    setIsEditing(false)
    setError(null)
  }

  const handleAddTime = () => {
    setEditedTimes([...editedTimes, '12:00'])
  }

  const handleRemoveTime = (index: number) => {
    setEditedTimes(editedTimes.filter((_, i) => i !== index))
  }

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...editedTimes]
    newTimes[index] = value
    setEditedTimes(newTimes)
  }

  const handleManualPost = async () => {
    try {
      setLoading(true)
      setError(null)
      await onManualTrigger()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handlePauseResume = async () => {
    try {
      setLoading(true)
      setError(null)
      await onPauseResume(!config.is_enabled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Schedule Settings</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${config.is_enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`text-sm font-medium ${config.is_enabled ? 'text-green-700' : 'text-red-700'}`}>
            {config.is_enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Next Post Info */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Next Post</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Scheduled Time</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(schedule.nextPostTime).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Time Until Next</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatTimeUntilNext(schedule.timeUntilNext)}
              </p>
            </div>
          </div>
          {schedule.isPostingTime && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 font-medium">🔔 It&apos;s posting time!</p>
            </div>
          )}
        </div>

        {/* Today's Schedule */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Today&apos;s Schedule</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {schedule.todaysSchedule.map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  item.posted
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{item.time}</span>
                  {item.posted && (
                    <span className="text-green-600 text-sm">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meal Times Configuration */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Meal Times</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editedTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleRemoveTime(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTime}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Time
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={editedTimezone}
                  onChange={(e) => setEditedTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="America/New_York"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-gray-800 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {config.meal_times.map((time, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 text-center">
                  <span className="font-medium text-gray-900">{time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleManualPost}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Manual Post'}
          </button>

          <button
            onClick={handlePauseResume}
            disabled={loading}
            className={`px-4 py-2 rounded-md disabled:opacity-50 ${
              config.is_enabled
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Updating...' : (config.is_enabled ? 'Pause' : 'Resume')}
          </button>
        </div>
      </div>
    </div>
  )
}