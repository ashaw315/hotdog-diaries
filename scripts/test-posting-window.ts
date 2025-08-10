#!/usr/bin/env tsx

import { PostingScheduler } from '../lib/services/posting-scheduler'

console.log('🧪 Testing Posting Window Logic...\n')

// Test different times to verify posting window logic
const testTimes = [
  new Date('2025-08-09T00:00:00.000Z'), // Exact posting time
  new Date('2025-08-09T00:02:00.000Z'), // 2 minutes after (should be valid)
  new Date('2025-08-09T00:06:00.000Z'), // 6 minutes after (should be invalid)
  new Date('2025-08-09T23:58:00.000Z'), // 2 minutes before midnight (should be valid)
  new Date('2025-08-09T04:00:00.000Z'), // 4 AM posting time
  new Date('2025-08-09T04:05:00.000Z'), // 5 minutes after 4 AM (should be valid)
  new Date('2025-08-09T12:30:00.000Z'), // Middle of non-posting window
  new Date('2025-08-09T16:00:00.000Z'), // 4 PM posting time
  new Date('2025-08-09T20:00:00.000Z'), // 8 PM posting time
]

console.log('Testing posting windows (should be within ±5 minutes of: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC):\n')

testTimes.forEach(time => {
  const isWithinWindow = PostingScheduler.isWithinPostingWindow(time)
  const nextScheduled = PostingScheduler.getNextScheduledTime(time)
  
  console.log(`${time.toISOString()}:`)
  console.log(`  Hour: ${time.getUTCHours()}, Minutes: ${time.getUTCMinutes()}`)
  console.log(`  Within window: ${isWithinWindow ? '✅ YES' : '❌ NO'}`)
  console.log(`  Next scheduled: ${nextScheduled.toISOString()}`)
  console.log('')
})

console.log('🎉 Posting window logic test completed!')
process.exit(0)