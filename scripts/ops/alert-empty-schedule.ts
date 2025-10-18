#!/usr/bin/env tsx

/**
 * Alert Empty Schedule
 * 
 * Sends alerts when schedule is empty by 06:15 ET with actionable remediation steps.
 */

import { parseArgs } from 'node:util'
import { formatInTimeZone } from 'date-fns-tz'
import { db } from '../../lib/db'

interface Args {
  webhook?: string
  tz: string
  min: number
}

async function main() {
  const { values } = parseArgs({
    options: {
      webhook: { type: 'string' },
      tz: { type: 'string', default: 'America/New_York' },
      min: { type: 'string', default: '6' }
    }
  })

  const args: Args = {
    webhook: values.webhook || process.env.ALERT_WEBHOOK_URL,
    tz: values.tz!,
    min: parseInt(values.min!, 10)
  }

  const now = new Date()
  const currentTimeET = formatInTimeZone(now, args.tz, 'HH:mm')
  
  console.log(`🚨 Empty Schedule Alert Check at ${formatInTimeZone(now, args.tz, 'yyyy-MM-dd HH:mm zzz')}`)

  try {
    await db.connect()

    // Check current schedule status
    const todayLocal = formatInTimeZone(now, args.tz, 'yyyy-MM-dd')
    const scheduleCount = await getScheduleCount(todayLocal, args.tz)
    
    console.log(`📊 Today's schedule: ${scheduleCount}/${args.min} slots filled`)

    if (scheduleCount >= args.min) {
      console.log(`✅ Schedule OK - no alert needed`)
      await db.disconnect()
      process.exit(0)
    }

    // Generate alert
    const alertMessage = generateAlertMessage(scheduleCount, args.min, todayLocal, currentTimeET)
    
    console.log(`🚨 ALERT: Schedule critically low (${scheduleCount}/${args.min})`)
    
    if (args.webhook) {
      await sendWebhookAlert(args.webhook, alertMessage)
      console.log(`📨 Alert sent to webhook`)
    } else {
      console.log(`⚠️ No webhook configured - alert message:`)
      console.log(alertMessage)
    }

    await db.disconnect()
    process.exit(1) // Exit with error to signal alert condition
    
  } catch (error) {
    console.error('❌ Alert check failed:', error)
    await db.disconnect()
    process.exit(1)
  }
}

async function getScheduleCount(dateLocal: string, tz: string): Promise<number> {
  const query = `
    SELECT COUNT(*) as count 
    FROM scheduled_posts 
    WHERE DATE(scheduled_post_time AT TIME ZONE ?) = ?
      AND content_id IS NOT NULL
  `
  
  const result = await db.query(query, [tz, dateLocal])
  return result.rows[0]?.count || 0
}

function generateAlertMessage(current: number, required: number, date: string, timeET: string): string {
  const shortfall = required - current
  
  return `🚨 **URGENT: Posting Schedule Crisis**

**Date**: ${date}
**Time**: ${timeET} ET
**Status**: ${current}/${required} slots filled (${shortfall} missing)

**Immediate Actions** (run these now):

1. **Emergency Schedule**:
   \`\`\`
   gh workflow run content-scheduler.yml --ref main
   pnpm tsx scripts/ops/materialize-schedule.ts --dates ${date} --force
   \`\`\`

2. **Trigger Content Scanners**:
   \`\`\`
   gh workflow run scan-reddit.yml --ref main
   gh workflow run scan-youtube.yml --ref main
   gh workflow run scan-giphy.yml --ref main
   \`\`\`

3. **Check Queue Status**:
   \`\`\`
   pnpm tsx scripts/ops/check-queue-readiness.ts
   \`\`\`

4. **Manual Posting** (if critical):
   \`\`\`
   gh workflow run post-breakfast.yml --ref main
   gh workflow run post-lunch.yml --ref main
   \`\`\`

**Dashboard**: <https://hotdog-diaries.vercel.app/admin/schedule>
**Logs**: <https://github.com/ashaw315/hotdog-diaries/actions>

*Time-sensitive: First posting slot at 08:00 ET*`
}

async function sendWebhookAlert(webhookUrl: string, message: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: message,
        username: 'Hotdog Diaries Alert',
        icon_emoji: ':rotating_light:'
      })
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error('❌ Webhook send failed:', error)
    throw error
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('alert-empty-schedule')
if (isMainModule) {
  main().catch(console.error)
}

export { main as alertEmptySchedule }