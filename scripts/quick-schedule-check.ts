/**
 * Quick check of current schedule using Supabase REST API
 */

import dayjs from 'dayjs'

const SUPABASE_URL = 'https://ulaadphxfsrihoubjdrb.supabase.co'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

async function checkSchedule() {
  const today = dayjs().format('YYYY-MM-DD')
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')

  console.log(`🔍 Checking schedule for ${today} and ${tomorrow}...\n`)

  // Call the admin API to get schedule
  const response = await fetch(
    `https://hotdog-diaries.vercel.app/api/admin/schedule?date=${today}`,
    {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    }
  )

  if (!response.ok) {
    console.error(`❌ API error: ${response.status}`)
    return
  }

  const data = await response.json()

  console.log(`📅 ${today}:`)
  console.log(`   Total slots: ${data.slots?.length || 0}`)
  const todayFilled = data.slots?.filter((s: any) => s.content_id).length || 0
  console.log(`   Filled: ${todayFilled}/6`)

  // Check tomorrow
  const response2 = await fetch(
    `https://hotdog-diaries.vercel.app/api/admin/schedule?date=${tomorrow}`,
    {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    }
  )

  if (response2.ok) {
    const data2 = await response2.json()
    console.log(`\n📅 ${tomorrow}:`)
    console.log(`   Total slots: ${data2.slots?.length || 0}`)
    const tomorrowFilled = data2.slots?.filter((s: any) => s.content_id).length || 0
    console.log(`   Filled: ${tomorrowFilled}/6`)

    console.log(`\n📊 Summary:`)
    console.log(`   Total filled: ${todayFilled + tomorrowFilled}/12`)
    console.log(`   Expected: 12 (6 posts per day x 2 days)`)

    if (todayFilled + tomorrowFilled < 12) {
      console.log(`\n   ⚠️ Missing ${12 - (todayFilled + tomorrowFilled)} posts`)
    } else {
      console.log(`\n   ✅ Schedule is complete!`)
    }
  }
}

checkSchedule().catch(console.error)
