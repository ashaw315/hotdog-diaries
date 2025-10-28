/**
 * Time Helper Functions for Eastern Time Slot Management
 * Supports 6 daily slots: 08:00, 12:00, 15:00, 18:00, 21:00, 23:30 ET
 * Updated with DST-aware timezone conversion
 */

import { parseISO, setHours, setMinutes, setSeconds, addHours, format } from 'date-fns'

// Helper function to determine DST status for a given date
function isDaylightSavingTime(date: Date): boolean {
  const month = date.getMonth() + 1 // getMonth() is 0-based
  const day = date.getDate()
  
  // Quick DST check: DST is active from mid-March through early November
  if (month > 3 && month < 11) {
    return true
  } else if (month === 3) {
    // In March, DST starts on the second Sunday (roughly day 8-14)
    return day >= 8
  } else if (month === 11) {
    // In November, DST ends on the first Sunday (roughly day 1-7)
    return day <= 7
  }
  return false
}

// Helper function to get ET offset in milliseconds for a given date
function getETOffsetMs(date: Date): number {
  // EDT = UTC-4 (4 hours), EST = UTC-5 (5 hours)
  const offsetHours = isDaylightSavingTime(date) ? 4 : 5
  return offsetHours * 60 * 60 * 1000
}

// Standard ET slot times
export const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] as const

/**
 * Check if current time is "today" in Eastern Time
 */
export function isTodayEastern(): boolean {
  const now = new Date()
  // Convert UTC to ET: subtract offset hours (EDT = UTC-4, EST = UTC-5)
  const offsetHours = isDaylightSavingTime(now) ? 4 : 5
  const etNow = new Date(now.getTime() - (offsetHours * 60 * 60 * 1000))
  const today = etNow.toISOString().split('T')[0]
  return today === format(etNow, 'yyyy-MM-dd')
}

/**
 * Get current ET date as YYYY-MM-DD string
 */
export function getEasternDateString(): string {
  const now = new Date()
  // Convert UTC to ET: subtract offset hours (EDT = UTC-4, EST = UTC-5)
  const offsetHours = isDaylightSavingTime(now) ? 4 : 5
  const etNow = new Date(now.getTime() - (offsetHours * 60 * 60 * 1000))
  return etNow.toISOString().split('T')[0]
}

/**
 * Get current slot index (0-5) based on Eastern Time
 * Returns the slot that should be active now or the next upcoming slot
 */
export function getEasternSlotIndexForNow(): number {
  const now = new Date()
  // Convert UTC to ET: subtract offset hours (EDT = UTC-4, EST = UTC-5)
  const offsetHours = isDaylightSavingTime(now) ? 4 : 5
  const etNow = new Date(now.getTime() - (offsetHours * 60 * 60 * 1000))
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

  // Convert ET slot time to UTC using DST-aware offset
  const [hh, mm] = slotTimeET.split(':').map(Number)
  
  // Create the ET time as if it were UTC first (prevents double timezone conversion)
  const etAsUTC = parseISO(dayStr + `T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`)
  
  // Apply the correct UTC offset to convert FROM ET TO UTC
  const offsetHours = isDaylightSavingTime(etAsUTC) ? 4 : 5
  const utcSlot = addHours(etAsUTC, offsetHours)
  
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
  
  // Create the ET time as if it were UTC first (prevents double timezone conversion)
  const etAsUTC = parseISO(dateYYYYMMDD + `T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`)
  
  // Apply the correct UTC offset to convert FROM ET TO UTC
  // EDT (DST active): ET + 4 hours = UTC
  // EST (standard time): ET + 5 hours = UTC
  const offsetHours = isDaylightSavingTime(etAsUTC) ? 4 : 5
  const utcTime = addHours(etAsUTC, offsetHours)
  return utcTime.toISOString()
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
  // Convert UTC to ET: subtract offset hours (EDT = UTC-4, EST = UTC-5)
  const offsetHours = isDaylightSavingTime(now) ? 4 : 5
  const etNow = new Date(now.getTime() - (offsetHours * 60 * 60 * 1000))
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