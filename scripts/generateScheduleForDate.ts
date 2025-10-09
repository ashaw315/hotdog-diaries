// scripts/generateScheduleForDate.ts
import 'dotenv/config'
import { generateDailySchedule } from '../lib/jobs/schedule-content-production'

async function main() {
  const dateArg = process.argv[2]
  if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error('Usage: tsx scripts/generateScheduleForDate.ts YYYY-MM-DD')
    process.exit(1)
  }
  console.log(`🗓️ Generating schedule for ${dateArg}...`)
  const res = await generateDailySchedule(dateArg)
  console.log('✅ Done:', res)
}

main().catch((e) => {
  console.error('❌ Failed:', e)
  process.exit(1)
})