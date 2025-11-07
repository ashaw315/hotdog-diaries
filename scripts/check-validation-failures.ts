/**
 * Check why approved content is failing scheduler validation
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ulaadphxfsrihoubjdrb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkValidationFailures() {
  console.log('🔍 Checking why approved content fails validation...\n')

  // Get all approved, not posted content
  const { data: allApproved, error } = await supabase
    .from('content_queue')
    .select('id, content_text, content_image_url, content_video_url, content_type, source_platform')
    .eq('is_approved', true)
    .eq('is_posted', false)
    .order('id', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Total approved & not posted: ${allApproved?.length || 0}\n`)

  const failures: Record<string, any[]> = {
    'no_text': [],
    'no_media': [],
    'video_in_image_field': [],
    'passed': []
  }

  for (const item of allApproved || []) {
    // Check 1: Has text
    if (!item.content_text || item.content_text.trim() === '') {
      failures.no_text.push(item)
      continue
    }

    // Check 2: Has media
    if (!item.content_image_url && !item.content_video_url) {
      failures.no_media.push(item)
      continue
    }

    // Check 3: Video file in image URL
    if (item.content_image_url && /\.(mp4|webm|mov)$/i.test(item.content_image_url)) {
      failures.video_in_image_field.push(item)
      continue
    }

    // Passed all checks
    failures.passed.push(item)
  }

  console.log('📊 Validation Results:\n')
  console.log(`✅ Passed validation: ${failures.passed.length}`)
  console.log(`❌ No text: ${failures.no_text.length}`)
  console.log(`❌ No media: ${failures.no_media.length}`)
  console.log(`❌ Video in image field: ${failures.video_in_image_field.length}`)
  console.log('')

  if (failures.no_text.length > 0) {
    console.log('\n❌ Items with no text:')
    for (const item of failures.no_text.slice(0, 5)) {
      console.log(`   ID ${item.id}: ${item.source_platform} - text="${item.content_text}"`)
    }
  }

  if (failures.no_media.length > 0) {
    console.log('\n❌ Items with no media URLs:')
    for (const item of failures.no_media.slice(0, 5)) {
      console.log(`   ID ${item.id}: ${item.source_platform} - "${item.content_text?.substring(0, 50)}..."`)
      console.log(`      image_url: ${item.content_image_url || 'null'}`)
      console.log(`      video_url: ${item.content_video_url || 'null'}`)
    }
  }

  if (failures.video_in_image_field.length > 0) {
    console.log('\n❌ Items with video file in image_url:')
    for (const item of failures.video_in_image_field.slice(0, 5)) {
      console.log(`   ID ${item.id}: ${item.source_platform} - "${item.content_text?.substring(0, 50)}..."`)
      console.log(`      image_url: ${item.content_image_url}`)
    }
  }

  if (failures.passed.length > 0) {
    console.log('\n✅ Items that passed validation:')
    for (const item of failures.passed.slice(0, 10)) {
      console.log(`   ID ${item.id}: ${item.source_platform} - "${item.content_text?.substring(0, 50)}..."`)
    }
  }
}

checkValidationFailures().catch(console.error)
