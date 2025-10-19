/**
 * Time utilities for ET/UTC conversions
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { parseISO, startOfDay, endOfDay, format, addDays } from 'date-fns'

const ET_TIMEZONE = 'America/New_York'

export interface TimeSlot {
  slot: string
  timeET: string
  timeUTC: Date
  isPast: boolean
}

export interface DateWindow {
  startUTC: Date
  endUTC: Date
  dateET: string
}

/**
 * Get today's date in ET timezone
 */
export function getTodayET(): string {
  return formatInTimeZone(new Date(), ET_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Get tomorrow's date in ET timezone
 */
export function getTomorrowET(): string {
  const tomorrow = addDays(new Date(), 1)
  return formatInTimeZone(tomorrow, ET_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Convert ET date to UTC day window
 */
export function getUTCWindow(dateET: string): DateWindow {
  const dateObj = parseISO(dateET)
  const startET = startOfDay(dateObj)
  const endET = endOfDay(dateObj)
  
  // Convert ET bounds to UTC
  const startUTC = fromZonedTime(startET, ET_TIMEZONE)
  const endUTC = fromZonedTime(endET, ET_TIMEZONE)
  
  return {
    startUTC,
    endUTC,
    dateET
  }
}

/**
 * Get posting time slots for a given date
 */
export function getTimeSlots(dateET: string): TimeSlot[] {
  const slots = [
    { slot: 'breakfast', timeET: '08:00' },
    { slot: 'lunch', timeET: '12:00' },
    { slot: 'snack', timeET: '15:00' },
    { slot: 'dinner', timeET: '18:00' },
    { slot: 'evening', timeET: '21:00' },
    { slot: 'late-night', timeET: '23:30' }
  ]
  
  const nowUTC = new Date()
  
  return slots.map(s => {
    const timeStr = `${dateET}T${s.timeET}:00`
    const timeLocal = parseISO(timeStr)
    const timeUTC = fromZonedTime(timeLocal, ET_TIMEZONE)
    
    return {
      slot: s.slot,
      timeET: s.timeET,
      timeUTC,
      isPast: timeUTC < nowUTC
    }
  })
}

/**
 * Format a UTC date for display in ET
 */
export function formatET(date: Date): string {
  return formatInTimeZone(date, ET_TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz')
}

/**
 * Get current time in ET
 */
export function getCurrentET(): string {
  return formatInTimeZone(new Date(), ET_TIMEZONE, 'HH:mm:ss zzz')
}