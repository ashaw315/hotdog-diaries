/**
 * Time Helper Functions for Eastern Time Slot Management
 * Supports 6 daily slots: 08:00, 12:00, 15:00, 18:00, 21:00, 23:30 ET
 */

import { parseISO, setHours, setMinutes, setSeconds, addHours, format } from 'date-fns'

// Standard ET slot times
export const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] as const

/**
 * Check if current time is "today" in Eastern Time
 */
export function isTodayEastern(): boolean {
  const now = new Date()
  const etNow = new Date(now.getTime() - (5 * 60 * 60 * 1000)) // EST offset approximation
  const today = etNow.toISOString().split('T')[0]
  return today === format(etNow, 'yyyy-MM-dd')
}

/**
 * Get current ET date as YYYY-MM-DD string
 */
export function getEasternDateString(): string {
  const now = new Date()
  const etNow = new Date(now.getTime() - (5 * 60 * 60 * 1000)) // EST offset approximation
  return etNow.toISOString().split('T')[0]
}

/**
 * Get current slot index (0-5) based on Eastern Time
 * Returns the slot that should be active now or the next upcoming slot
 */
export function getEasternSlotIndexForNow(): number {
  const now = new Date()
  const etNow = new Date(now.getTime() - (5 * 60 * 60 * 1000)) // EST offset approximation
  const currentHour = etNow.getHours()
  const currentMinute = etNow.getMinutes()
  const currentTime = currentHour * 60 + currentMinute // minutes since midnight

  // Slot time windows (in minutes since midnight ET)
  const slotTimes = [
    8 * 60,      // 08:00 = 480 minutes
    12 * 60,     // 12:00 = 720 minutes  
    15 * 60,     // 15:00 = 900 minutes
    18 * 60,     // 18:00 = 1080 minutes
    21 * 60,     // 21:00 = 1260 minutes
    23 * 60 + 30 // 23:30 = 1410 minutes
  ]

  // Find the current or next slot
  for (let i = 0; i < slotTimes.length; i++) {
    // Allow 30-minute window around each slot time
    if (currentTime >= slotTimes[i] - 30 && currentTime <= slotTimes[i] + 30) {
      return i
    }
  }

  // If we're past the last slot, return the first slot of tomorrow
  if (currentTime > slotTimes[slotTimes.length - 1] + 30) {
    return 0 // Tomorrow's first slot
  }

  // Find next upcoming slot
  for (let i = 0; i < slotTimes.length; i++) {
    if (currentTime < slotTimes[i] - 30) {
      return i
    }
  }

  return 0 // Default to first slot
}

/**
 * Get UTC time window for a specific ET slot
 */
export function getEasternWindowForSlot(slotIndex: number, dateStr?: string): {
  startUtc: string
  endUtc: string
  dayStr: string
  slotTimeUtc: string
} {
  const dayStr = dateStr || getEasternDateString()
  const slotTimeET = SLOT_TIMES_ET[slotIndex]
  
  if (!slotTimeET) {
    throw new Error(`Invalid slot index: ${slotIndex}. Must be 0-5.`)
  }

  // Convert ET slot time to UTC
  const [hh, mm] = slotTimeET.split(':').map(Number)
  const etDate = parseISO(dayStr + 'T00:00:00')
  const etSlot = setSeconds(setMinutes(setHours(etDate, hh), mm), 0)
  const utcSlot = addHours(etSlot, 5) // EST to UTC
  
  // Create 1-hour window around the slot time
  const startUtc = new Date(utcSlot.getTime() - 30 * 60 * 1000).toISOString()
  const endUtc = new Date(utcSlot.getTime() + 30 * 60 * 1000).toISOString()
  
  return {
    startUtc,
    endUtc,
    dayStr,
    slotTimeUtc: utcSlot.toISOString()
  }
}

/**
 * Convert ET time string to UTC ISO for given date
 */
export function etTimeToUTC(dateYYYYMMDD: string, etTimeHHMM: string): string {
  const [hh, mm] = etTimeHHMM.split(':').map(Number)
  const etDate = parseISO(dateYYYYMMDD + 'T00:00:00')
  const etSlot = setSeconds(setMinutes(setHours(etDate, hh), mm), 0)
  const utcSlot = addHours(etSlot, 5) // EST to UTC
  return utcSlot.toISOString()
}

/**
 * Get ET day range as UTC window
 */
export function getUtcWindowForEtDate(dateStrET: string): [string, string] {
  const et = new Date(`${dateStrET}T00:00:00-05:00`) // EST fallback
  const start = new Date(et)
  const end = new Date(et)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

/**
 * Get yesterday's date in ET as YYYY-MM-DD
 */
export function getYesterdayEastern(): string {
  const now = new Date()
  const etNow = new Date(now.getTime() - (5 * 60 * 60 * 1000)) // EST offset approximation
  const yesterday = new Date(etNow)
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

/**
 * Get date range for N days starting from today (ET)
 */
export function getEasternDateRange(days: number, startDate?: string): string[] {
  const start = startDate || getEasternDateString()
  const dates: string[] = []
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
}