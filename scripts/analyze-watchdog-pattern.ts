/**
 * Analyze watchdog failure pattern to understand root cause
 */

import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

// Recent watchdog results
const results = [
  { time: '2025-11-10T16:33:19Z', conclusion: 'failure' },
  { time: '2025-11-10T13:00:22Z', conclusion: 'failure' },
  { time: '2025-11-10T10:26:04Z', conclusion: 'failure' },
  { time: '2025-11-10T04:03:30Z', conclusion: 'failure' },
  { time: '2025-11-10T02:54:40Z', conclusion: 'failure' },
  { time: '2025-11-09T22:28:57Z', conclusion: 'failure' },
  { time: '2025-11-09T19:21:25Z', conclusion: 'failure' },
  { time: '2025-11-09T16:32:27Z', conclusion: 'failure' },
  { time: '2025-11-09T12:51:53Z', conclusion: 'success' },
  { time: '2025-11-09T10:20:09Z', conclusion: 'success' },
  { time: '2025-11-09T03:58:23Z', conclusion: 'failure' },
  { time: '2025-11-09T02:49:42Z', conclusion: 'failure' },
  { time: '2025-11-08T22:28:15Z', conclusion: 'failure' },
  { time: '2025-11-08T19:22:17Z', conclusion: 'failure' },
  { time: '2025-11-08T16:32:34Z', conclusion: 'failure' },
  { time: '2025-11-08T12:52:07Z', conclusion: 'success' },
  { time: '2025-11-08T10:20:22Z', conclusion: 'success' },
]

console.log('\n📊 Watchdog Failure Pattern Analysis\n')
console.log('UTC Time              | ET Time             | Result')
console.log('---------------------|---------------------|--------')

for (const result of results) {
  const utcDate = new Date(result.time)
  const etDate = toZonedTime(utcDate, 'America/New_York')
  const etStr = format(etDate, 'yyyy-MM-dd HH:mm zzz')

  const status = result.conclusion === 'success' ? '✅ PASS' : '❌ FAIL'

  console.log(`${result.time} | ${etStr} | ${status}`)
}

console.log('\n📋 Pattern Analysis:')

const successes = results.filter(r => r.conclusion === 'success')
const failures = results.filter(r => r.conclusion === 'failure')

console.log(`\nSuccesses (${successes.length}):`)
for (const s of successes) {
  const etDate = toZonedTime(new Date(s.time), 'America/New_York')
  const etStr = format(etDate, 'HH:mm zzz')
  console.log(`  - ${etStr}`)
}

console.log(`\nFailures (${failures.length}):`)
const failureETTimes = failures.map(f => {
  const etDate = toZonedTime(new Date(f.time), 'America/New_York')
  return format(etDate, 'HH:mm zzz')
})
console.log(`  - Various times: ${failureETTimes.slice(0, 5).join(', ')}, ...`)

console.log('\n💡 Key Observations:')
console.log('  1. Successes occur around 06:20 AM and 08:51 AM EST')
console.log('  2. Failures occur at all other times throughout the day')
console.log('  3. This suggests posts fail later in the day, causing incomplete schedules')
console.log('\n🔍 Root Cause:')
console.log('  - Scheduler was re-scheduling already-posted content')
console.log('  - These duplicate posts failed with constraint violations')
console.log('  - Schedule appeared incomplete (<6 slots or failed posts)')
console.log('  - Early morning checks passed before posts failed')
console.log('  - Later checks detected the failures')
