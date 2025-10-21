#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ulaadphxfsrihoubjdrb.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFkcGh4ZnNyaWhvdWJqZHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNjI1NiwiZXhwIjoyMDcxMTkyMjU2fQ.8u_cd_4_apKd_1baqPq82k3YuWUmmnM51lvZE7muLE4"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function queryScheduleData(dateStr: string) {
  const results: any = {
    query_timestamp: new Date().toISOString(),
    target_date: dateStr,
    queries: {}
  }

  console.log(`🔍 Querying schedule data for ${dateStr}...`)

  // Get date bounds for the target date in ET
  const startOfDay = `${dateStr}T04:00:00.000Z` // Midnight ET = 4AM UTC during EDT
  const endOfDay = `${dateStr}T03:59:59.999Z` // 11:59:59 PM ET = 3:59:59 AM UTC next day during EDT
  
  console.log(`Date bounds: ${startOfDay} to ${endOfDay}`)

  try {
    // Query scheduled_posts for today/tomorrow
    console.log('📅 Querying scheduled_posts...')
    const { data: scheduledPosts, error: scheduledError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .gte('scheduled_post_time', startOfDay)
      .lte('scheduled_post_time', endOfDay)
      .order('scheduled_post_time', { ascending: true })

    if (scheduledError) {
      console.error('❌ Error querying scheduled_posts:', scheduledError)
      results.queries.scheduled_posts = { error: scheduledError.message }
    } else {
      console.log(`✅ Found ${scheduledPosts?.length || 0} scheduled posts`)
      results.queries.scheduled_posts = {
        count: scheduledPosts?.length || 0,
        data: scheduledPosts?.slice(0, 50) || [] // Limit to first 50 rows
      }
    }

    // Query posted_content for today/tomorrow
    console.log('📋 Querying posted_content...')
    const { data: postedContent, error: postedError } = await supabase
      .from('posted_content')
      .select('*')
      .gte('posted_at', startOfDay)
      .lte('posted_at', endOfDay)
      .order('posted_at', { ascending: true })

    if (postedError) {
      console.error('❌ Error querying posted_content:', postedError)
      results.queries.posted_content = { error: postedError.message }
    } else {
      console.log(`✅ Found ${postedContent?.length || 0} posted content items`)
      results.queries.posted_content = {
        count: postedContent?.length || 0,
        data: postedContent?.slice(0, 50) || []
      }
    }

    // Query content_queue counts by platform
    console.log('📊 Querying content_queue platform counts...')
    const { data: queueCounts, error: queueError } = await supabase
      .from('content_queue')
      .select('source_platform, is_approved')
      .eq('is_posted', false)
      .limit(1000)

    if (queueError) {
      console.error('❌ Error querying content_queue:', queueError)
      results.queries.content_queue_counts = { error: queueError.message }
    } else {
      console.log(`✅ Found ${queueCounts?.length || 0} content queue items`)
      
      // Manually group the data
      const platformCounts: { [key: string]: { approved: number, pending: number } } = {}
      queueCounts?.forEach(item => {
        const platform = item.source_platform || 'unknown'
        if (!platformCounts[platform]) {
          platformCounts[platform] = { approved: 0, pending: 0 }
        }
        if (item.is_approved) {
          platformCounts[platform].approved++
        } else {
          platformCounts[platform].pending++
        }
      })
      
      results.queries.content_queue_counts = {
        total_items: queueCounts?.length || 0,
        platform_breakdown: platformCounts,
        raw_sample: queueCounts?.slice(0, 20) || []
      }
    }

    // Query last 7 days of scheduled_posts for trend analysis
    console.log('📈 Querying last 7 days of scheduled posts...')
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: weeklyScheduled, error: weeklyError } = await supabase
      .from('scheduled_posts')
      .select('scheduled_post_time, content_id, created_at')
      .gte('scheduled_post_time', sevenDaysAgo.toISOString())
      .order('scheduled_post_time', { ascending: true })

    if (weeklyError) {
      console.error('❌ Error querying weekly scheduled posts:', weeklyError)
      results.queries.weekly_scheduled = { error: weeklyError.message }
    } else {
      console.log(`✅ Found ${weeklyScheduled?.length || 0} scheduled posts in last 7 days`)
      
      // Group by date for daily analysis
      const dailyCounts: { [date: string]: { total: number, with_content: number } } = {}
      
      weeklyScheduled?.forEach(post => {
        const date = post.scheduled_post_time.split('T')[0]
        if (!dailyCounts[date]) {
          dailyCounts[date] = { total: 0, with_content: 0 }
        }
        dailyCounts[date].total++
        if (post.content_id) {
          dailyCounts[date].with_content++
        }
      })

      results.queries.weekly_scheduled = {
        total_count: weeklyScheduled?.length || 0,
        daily_breakdown: dailyCounts,
        sample_data: weeklyScheduled?.slice(0, 20) || []
      }
    }

  } catch (error) {
    console.error('💥 Fatal error during database queries:', error)
    results.fatal_error = error instanceof Error ? error.message : 'Unknown error'
  }

  return results
}

async function main() {
  const args = process.argv.slice(2)
  const dateFlag = args.find(arg => arg.startsWith('--date='))
  const outFlag = args.find(arg => arg.startsWith('--out='))
  
  let targetDate = 'today'
  if (dateFlag) {
    targetDate = dateFlag.split('=')[1]
  }
  
  // Convert 'today' and 'tomorrow' to actual dates
  let actualDate: string
  if (targetDate === 'today') {
    actualDate = new Date().toISOString().split('T')[0]
  } else if (targetDate === 'tomorrow') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    actualDate = tomorrow.toISOString().split('T')[0]
  } else {
    actualDate = targetDate
  }

  console.log(`🎯 Target date: ${targetDate} (${actualDate})`)

  const results = await queryScheduleData(actualDate)
  
  const outputPath = outFlag ? 
    outFlag.split('=')[1] : 
    join(process.cwd(), `ci_audit/triage/${actualDate}/evidence/db_${targetDate}.json`)
  
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`📁 Results written to: ${outputPath}`)
  
  return results
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { queryScheduleData }