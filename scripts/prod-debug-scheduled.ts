#!/usr/bin/env tsx
/**
 * Production Debug: Check scheduled_posts for 2025-10-15
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ulaadphxfsrihoubjdrb.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFkcGh4ZnNyaWhvdWJqZHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzI5MDA2OCwiZXhwIjoyMDUyODY2MDY4fQ.d3VZK8g7V2sFtWFXDMsqGYxl3_k-MUo8hcpT-kzV8dQ'

async function debugProductionScheduled() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  console.log('🔍 Production Debug: scheduled_posts for 2025-10-15')
  console.log('=' .repeat(60))
  
  try {
    // Check if table exists and get all rows for 2025-10-15
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('scheduled_day', '2025-10-15')
      .order('scheduled_slot_index', { ascending: true })
    
    if (error) {
      console.error('❌ Error querying scheduled_posts:', error)
      return
    }
    
    console.log(`📊 Found ${data?.length || 0} scheduled posts for 2025-10-15`)
    console.log('')
    
    if (data && data.length > 0) {
      console.log('📋 Scheduled Posts Details:')
      console.log('-'.repeat(40))
      
      data.forEach((row, index) => {
        console.log(`Slot ${row.scheduled_slot_index}: content_id=${row.content_id}, platform=${row.platform}`)
        console.log(`  Type: ${row.content_type}, Time: ${row.scheduled_post_time}`)
        console.log(`  Posted: ${row.actual_posted_at || 'Not posted'}`)
        console.log('')
      })
      
      // Check which slots have null content_id
      const nullContentIds = data.filter(row => row.content_id === null)
      if (nullContentIds.length > 0) {
        console.log('⚠️ Slots with NULL content_id:')
        nullContentIds.forEach(row => {
          console.log(`  Slot ${row.scheduled_slot_index}: ${row.platform} ${row.content_type}`)
        })
        console.log('')
      }
    } else {
      console.log('📭 No scheduled posts found for 2025-10-15')
      console.log('Trying time range query...')
      
      // Try time range query as fallback
      const startUtc = '2025-10-15T12:00:00.000Z' // 08:00 ET = 12:00 UTC
      const endUtc = '2025-10-16T03:30:00.000Z'   // 23:30 ET = 03:30+1 UTC
      
      const { data: timeData, error: timeError } = await supabase
        .from('scheduled_posts')
        .select('*')
        .gte('scheduled_post_time', startUtc)
        .lte('scheduled_post_time', endUtc)
        .order('scheduled_post_time', { ascending: true })
      
      if (timeError) {
        console.error('❌ Error with time range query:', timeError)
        return
      }
      
      console.log(`📊 Time range query found ${timeData?.length || 0} posts`)
      if (timeData && timeData.length > 0) {
        timeData.forEach(row => {
          console.log(`Time: ${row.scheduled_post_time}, content_id=${row.content_id}, platform=${row.platform}`)
        })
      }
    }
    
  } catch (err) {
    console.error('❌ Script failed:', err)
  }
}

debugProductionScheduled()