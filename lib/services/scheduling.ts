import { db } from '@/lib/db'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface ScheduleConfig {
  id: number
  meal_times: string[]
  timezone: string
  is_enabled: boolean
  created_at: Date
  updated_at: Date
}

export interface PostingSchedule {
  nextPostTime: Date
  nextMealTime: string
  timeUntilNext: number
  isPostingTime: boolean
  todaysSchedule: Array<{
    time: string
    posted: boolean
    scheduledDate: Date
  }>
}

export class SchedulingService {
  private static readonly DEFAULT_MEAL_TIMES = ['08:00', '10:00', '12:00', '15:00', '18:00', '20:00']
  private static readonly DEFAULT_TIMEZONE = 'America/New_York'

  async getScheduleConfig(): Promise<ScheduleConfig> {
    try {
      const result = await db.query<ScheduleConfig>(
        'SELECT * FROM schedule_config ORDER BY created_at DESC LIMIT 1'
      )

      if (result.rows.length === 0) {
        return await this.createDefaultScheduleConfig()
      }

      return result.rows[0]
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get schedule config',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async updateScheduleConfig(config: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    try {
      const currentConfig = await this.getScheduleConfig()
      
      const result = await db.query<ScheduleConfig>(
        `UPDATE schedule_config 
         SET meal_times = $1, timezone = $2, is_enabled = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          config.meal_times || currentConfig.meal_times,
          config.timezone || currentConfig.timezone,
          config.is_enabled !== undefined ? config.is_enabled : currentConfig.is_enabled,
          currentConfig.id
        ]
      )

      await logToDatabase(
        LogLevel.INFO,
        'Schedule config updated',
        'SchedulingService',
        { updatedConfig: result.rows[0] }
      )

      return result.rows[0]
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to update schedule config',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async scheduleNextPost(): Promise<Date | null> {
    try {
      const config = await this.getScheduleConfig()
      
      if (!config.is_enabled) {
        await logToDatabase(
          LogLevel.INFO,
          'Scheduling disabled, no next post scheduled',
          'SchedulingService'
        )
        return null
      }

      const nextTime = await this.getNextScheduledTime()
      
      if (!nextTime) {
        await logToDatabase(
          LogLevel.WARN,
          'No next scheduled time available',
          'SchedulingService'
        )
        return null
      }

      await logToDatabase(
        LogLevel.INFO,
        'Next post scheduled',
        'SchedulingService',
        { nextScheduledTime: nextTime }
      )

      return nextTime
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to schedule next post',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async getNextScheduledTime(): Promise<Date | null> {
    try {
      const config = await this.getScheduleConfig()
      const now = new Date()
      
      const timeZone = config.timezone || SchedulingService.DEFAULT_TIMEZONE
      const mealTimes = config.meal_times || SchedulingService.DEFAULT_MEAL_TIMES

      const today = new Date(now.toLocaleString('en-US', { timeZone }))
      const todayStr = today.toISOString().split('T')[0]

      for (const mealTime of mealTimes.sort()) {
        const [hours, minutes] = mealTime.split(':').map(Number)
        const scheduledTime = new Date(`${todayStr}T${mealTime}:00`)
        
        const scheduledTimeInTZ = new Date(scheduledTime.toLocaleString('en-US', { timeZone }))
        
        if (scheduledTimeInTZ > now) {
          const hasPostedToday = await this.hasPostedAtTime(scheduledTime, mealTime)
          if (!hasPostedToday) {
            return scheduledTimeInTZ
          }
        }
      }

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      
      const firstMealTime = mealTimes.sort()[0]
      const tomorrowFirstMeal = new Date(`${tomorrowStr}T${firstMealTime}:00`)
      
      return new Date(tomorrowFirstMeal.toLocaleString('en-US', { timeZone }))
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get next scheduled time',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return null
    }
  }

  async isPostingTime(toleranceMinutes: number = 5): Promise<boolean> {
    try {
      const config = await this.getScheduleConfig()
      
      if (!config.is_enabled) {
        return false
      }

      const now = new Date()
      const timeZone = config.timezone || SchedulingService.DEFAULT_TIMEZONE
      const mealTimes = config.meal_times || SchedulingService.DEFAULT_MEAL_TIMES

      const currentTime = new Date(now.toLocaleString('en-US', { timeZone }))
      const currentHour = currentTime.getHours()
      const currentMinute = currentTime.getMinutes()

      for (const mealTime of mealTimes) {
        const [hours, minutes] = mealTime.split(':').map(Number)
        
        const timeDifference = Math.abs(
          (currentHour * 60 + currentMinute) - (hours * 60 + minutes)
        )
        
        if (timeDifference <= toleranceMinutes) {
          const hasPostedRecently = await this.hasPostedAtTime(currentTime, mealTime)
          return !hasPostedRecently
        }
      }

      return false
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to check if posting time',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return false
    }
  }

  async selectRandomContent(): Promise<any | null> {
    try {
      const result = await db.query(
        `SELECT * FROM content_queue 
         WHERE is_approved = true 
         AND is_posted = false 
         ORDER BY RANDOM() 
         LIMIT 1`
      )

      if (result.rows.length === 0) {
        await logToDatabase(
          LogLevel.WARN,
          'No approved content available for posting',
          'SchedulingService'
        )
        return null
      }

      const selectedContent = result.rows[0]
      
      await logToDatabase(
        LogLevel.INFO,
        'Random content selected for posting',
        'SchedulingService',
        { contentId: selectedContent.id, contentType: selectedContent.content_type }
      )

      return selectedContent
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to select random content',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async getPostingSchedule(): Promise<PostingSchedule> {
    try {
      const config = await this.getScheduleConfig()
      const now = new Date()
      const timeZone = config.timezone || SchedulingService.DEFAULT_TIMEZONE
      const mealTimes = config.meal_times || SchedulingService.DEFAULT_MEAL_TIMES

      const nextPostTime = await this.getNextScheduledTime()
      const isPostingTime = await this.isPostingTime()

      const today = new Date(now.toLocaleString('en-US', { timeZone }))
      const todayStr = today.toISOString().split('T')[0]

      const todaysSchedule = await Promise.all(
        mealTimes.map(async (time) => {
          const scheduledDate = new Date(`${todayStr}T${time}:00`)
          const posted = await this.hasPostedAtTime(scheduledDate, time)
          
          return {
            time,
            posted,
            scheduledDate: new Date(scheduledDate.toLocaleString('en-US', { timeZone }))
          }
        })
      )

      return {
        nextPostTime: nextPostTime || new Date(),
        nextMealTime: nextPostTime ? 
          mealTimes.find(time => {
            const [hours, minutes] = time.split(':').map(Number)
            return nextPostTime.getHours() === hours && nextPostTime.getMinutes() === minutes
          }) || mealTimes[0] : mealTimes[0],
        timeUntilNext: nextPostTime ? nextPostTime.getTime() - now.getTime() : 0,
        isPostingTime,
        todaysSchedule: todaysSchedule.sort((a, b) => a.time.localeCompare(b.time))
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get posting schedule',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async pauseScheduling(): Promise<void> {
    try {
      await this.updateScheduleConfig({ is_enabled: false })
      
      await logToDatabase(
        LogLevel.INFO,
        'Scheduling paused',
        'SchedulingService'
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to pause scheduling',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async resumeScheduling(): Promise<void> {
    try {
      await this.updateScheduleConfig({ is_enabled: true })
      
      await logToDatabase(
        LogLevel.INFO,
        'Scheduling resumed',
        'SchedulingService'
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to resume scheduling',
        'SchedulingService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  private async createDefaultScheduleConfig(): Promise<ScheduleConfig> {
    const result = await db.query<ScheduleConfig>(
      `INSERT INTO schedule_config (meal_times, timezone, is_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [SchedulingService.DEFAULT_MEAL_TIMES, SchedulingService.DEFAULT_TIMEZONE, true]
    )

    await logToDatabase(
      LogLevel.INFO,
      'Default schedule config created',
      'SchedulingService',
      { config: result.rows[0] }
    )

    return result.rows[0]
  }

  private async hasPostedAtTime(targetTime: Date, mealTime: string): Promise<boolean> {
    const startOfDay = new Date(targetTime)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetTime)
    endOfDay.setHours(23, 59, 59, 999)

    const result = await db.query(
      `SELECT COUNT(*) as count FROM posted_content 
       WHERE posted_at >= $1 AND posted_at <= $2
       AND DATE_PART('hour', posted_at) = $3
       AND DATE_PART('minute', posted_at) = $4`,
      [
        startOfDay.toISOString(),
        endOfDay.toISOString(),
        ...mealTime.split(':').map(Number)
      ]
    )

    return parseInt(result.rows[0].count) > 0
  }
}

export const schedulingService = new SchedulingService()