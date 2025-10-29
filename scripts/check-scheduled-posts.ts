#!/usr/bin/env tsx

/**
 * Check what's in the scheduled_posts table for today
 */

import { createSimpleClient } from '../utils/supabase/server'

async function checkScheduledPosts() {
  const supabase = createSimpleClient()

  const today = '2025-10-29'

  console.log(`\n🔍 Checking scheduled_posts table for ${today}\n`)
  console.log('=' .repeat(80))

  try {
    // Try using scheduled_day column first
    let { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('scheduled_day', today)
      .order('scheduled_slot_index', { ascending: true })

    if (error && error.message.includes('scheduled_day')) {
      console.log('⚠️  scheduled_day column not found, trying time range...\n')

      // Fallback to time range
      const startUTC = `${today}T00:00:00.000Z`
      const endUTC = `${today}T23:59:59.999Z`

      const result = await supabase
        .from('scheduled_posts')
        .select('*')
        .gte('scheduled_post_time', startUTC)
        .lt('scheduled_post_time', endUTC)
        .order('scheduled_slot_index', { ascending: true })

      data = result.data
      error = result.error
    }

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    if (!data || data.length === 0) {
      console.log('📭 No scheduled posts found for today')
      console.log('\n✅ This is expected! The refill should create 6 new slots.')
      return
    }

    console.log(`📊 Found ${data.length} scheduled posts for ${today}:\n`)

    data.forEach((slot: any) => {
      const hasContent = slot.content_id ? '✓' : '✗'
      const status = slot.status || 'unknown'

      console.log(`Slot ${slot.scheduled_slot_index}: ${slot.scheduled_post_time}`)
      console.log(`  - ID: ${slot.id}`)
      console.log(`  - Content ID: ${slot.content_id || 'NULL'} ${hasContent}`)
      console.log(`  - Platform: ${slot.platform || 'NULL'}`)
      console.log(`  - Status: ${status}`)
      console.log(`  - Title: ${slot.title?.substring(0, 50) || 'NULL'}`)
      console.log('')
    })

    const slotsWithContent = data.filter(s => s.content_id).length
    const slotsWithoutContent = data.filter(s => !s.content_id).length

    console.log('=' .repeat(80))
    console.log(`\n📈 Summary:`)
    console.log(`  - Total slots: ${data.length}`)
    console.log(`  - Slots with content: ${slotsWithContent}`)
    console.log(`  - Empty slots (no content_id): ${slotsWithoutContent}`)
    console.log('')

    if (slotsWithoutContent > 0) {
      console.log('⚠️  ISSUE: Slots exist but have no content_id!')
      console.log('   The refill logic should fill these empty slots.')
      console.log('   Mode should be "refill-missing" to update existing rows.')
    } else if (data.length === 6 && slotsWithContent === 6) {
      console.log('✅ All 6 slots are filled with content')
    } else if (data.length < 6) {
      console.log(`⚠️  Only ${data.length} slots exist, should be 6`)
      console.log('   Refill should create missing slots.')
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkScheduledPosts().catch(console.error)
