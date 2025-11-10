import { createSimpleClient } from '@/utils/supabase/server'

async function checkQueueHealth() {
  const supabase = createSimpleClient()

  const { data: queue, error } = await supabase
    .from('content_queue')
    .select('id, is_approved, is_posted, content_status, ingest_priority')
    .eq('is_approved', true)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log('\n📊 Queue Health:\n')
  console.log('Total approved:', queue.length)
  console.log('  Posted:', queue.filter(q => q.is_posted).length)
  console.log('  Not posted:', queue.filter(q => !q.is_posted).length)
  console.log('  Scheduled:', queue.filter(q => q.content_status === 'scheduled').length)
  console.log('  Available:', queue.filter(q => !q.is_posted && q.content_status !== 'scheduled').length)

  console.log('\nPriority breakdown:')
  const byPriority = queue.reduce((acc, q) => {
    const key = q.ingest_priority || 0
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  for (const [priority, count] of Object.entries(byPriority).sort(([a], [b]) => Number(b) - Number(a))) {
    console.log(`  Priority ${priority}: ${count}`)
  }

  // Check what content is available (not posted, not scheduled)
  const { data: available, error: availError } = await supabase
    .from('content_queue')
    .select('id, source_platform, confidence_score, ingest_priority')
    .eq('is_approved', true)
    .or('is_posted.is.null,is_posted.eq.false')
    .or('content_status.is.null,content_status.neq.scheduled')
    .order('confidence_score', { ascending: false })
    .limit(20)

  if (availError) {
    console.error('Error getting available:', availError)
    return
  }

  console.log(`\n📋 Top ${available.length} available items:`)
  for (const item of available) {
    console.log(`  ${item.id}: ${item.source_platform} (score: ${item.confidence_score}, priority: ${item.ingest_priority})`)
  }
}

checkQueueHealth().catch(console.error)
