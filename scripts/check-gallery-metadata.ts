#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkGalleryMetadata() {
  console.log('🔍 Checking gallery metadata for Reddit posts...\n')

  // Check the specific "Boiled hot dogs" post
  console.log('1️⃣ Checking the "Boiled hot dogs beat grilled" post...')
  const { data: specificPost, error: specificError } = await supabase
    .from('content_queue')
    .select('id, content_text, content_type, content_metadata, original_url, source_platform, scraped_at')
    .ilike('original_url', '%1otusxd%')
    .single()

  if (specificError) {
    console.log('❌ Error finding specific post:', specificError.message)
  } else if (specificPost) {
    console.log('✅ Found the post!')
    console.log('  ID:', specificPost.id)
    console.log('  Scraped at:', specificPost.scraped_at)
    console.log('  URL:', specificPost.original_url)
    console.log('  Text:', specificPost.content_text?.substring(0, 80))
    console.log('  content_metadata:', JSON.stringify(specificPost.content_metadata, null, 2))
    console.log('')
  }

  // Check all recent Reddit posts for gallery metadata
  console.log('2️⃣ Checking recent Reddit image posts...')
  const { data: redditPosts, error } = await supabase
    .from('content_queue')
    .select('id, content_metadata, original_url, scraped_at')
    .eq('source_platform', 'reddit')
    .eq('content_type', 'image')
    .order('scraped_at', { ascending: false })
    .limit(20)

  if (error) {
    console.log('❌ Error:', error.message)
    return
  }

  console.log(`Found ${redditPosts?.length || 0} recent Reddit image posts\n`)

  let withGallery = 0
  let withoutGallery = 0

  redditPosts?.forEach(post => {
    const hasGallery = post.content_metadata?.gallery_images?.length > 0
    if (hasGallery) {
      withGallery++
      console.log(`✅ HAS gallery (${post.content_metadata.gallery_images.length} images):`)
      console.log(`   ${post.original_url?.substring(0, 70)}`)
      console.log(`   Scraped: ${post.scraped_at}`)
    } else {
      withoutGallery++
    }
  })

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`  Posts WITH gallery metadata: ${withGallery}`)
  console.log(`  Posts WITHOUT gallery metadata: ${withoutGallery}`)
  console.log('='.repeat(60))
}

checkGalleryMetadata()
