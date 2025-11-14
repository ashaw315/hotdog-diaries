#!/usr/bin/env tsx

import { redditHttpService } from '@/lib/services/reddit-http'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { createClient } from '@supabase/supabase-js'

async function testGalleryExtraction() {
  console.log('🧪 Testing Reddit Gallery Extraction\n')
  console.log('='.repeat(60))

  try {
    // Test with the known gallery post: "My Hotdog Vendor Halloween Costume"
    console.log('\n1️⃣ Fetching known gallery post from Reddit...')
    const result = await redditHttpService.searchSubreddit(
      'hotdogs',
      '92 hotdogs',
      5,
      'new'
    )

    if (!result.posts || result.posts.length === 0) {
      console.log('❌ No posts found. The post may have been deleted or search failed.')
      return
    }

    console.log(`✅ Found ${result.posts.length} posts`)

    // Find gallery posts
    const galleryPosts = result.posts.filter(post => post.is_gallery)
    console.log(`\n2️⃣ Gallery posts found: ${galleryPosts.length}`)

    if (galleryPosts.length === 0) {
      console.log('\n⚠️  No gallery posts in results. Checking all posts...\n')
      result.posts.forEach((post, i) => {
        console.log(`Post ${i + 1}:`)
        console.log(`  Title: ${post.title.substring(0, 60)}...`)
        console.log(`  ID: ${post.id}`)
        console.log(`  Is Gallery: ${post.is_gallery || false}`)
        console.log(`  Gallery Data: ${post.gallery_data ? 'Present' : 'Missing'}`)
        console.log(`  Media Metadata: ${post.media_metadata ? 'Present' : 'Missing'}`)
        console.log(`  URL: ${post.url}\n`)
      })
      return
    }

    // Process first gallery post
    const galleryPost = galleryPosts[0]
    console.log(`\n3️⃣ Processing gallery post:`)
    console.log(`  Title: ${galleryPost.title}`)
    console.log(`  ID: ${galleryPost.id}`)
    console.log(`  Gallery Items: ${galleryPost.gallery_data?.items?.length || 0}`)
    console.log(`  Media Metadata Keys: ${Object.keys(galleryPost.media_metadata || {}).length}`)

    // Use reflection to access private method (for testing only)
    const scanningService = redditScanningService as any
    const processedPost = scanningService.convertToProcessedPost(galleryPost)

    console.log(`\n4️⃣ Processed Post Results:`)
    console.log(`  Is Gallery: ${processedPost.isGallery}`)
    console.log(`  Image URLs count: ${processedPost.imageUrls.length}`)
    console.log(`  Gallery Images count: ${processedPost.galleryImages?.length || 0}`)

    if (processedPost.galleryImages && processedPost.galleryImages.length > 0) {
      console.log(`\n  ✅ Gallery images extracted successfully!`)
      console.log(`\n  Gallery Image URLs:`)
      processedPost.galleryImages.forEach((url: string, i: number) => {
        console.log(`    ${i + 1}. ${url.substring(0, 80)}...`)
      })
    } else {
      console.log(`\n  ❌ Gallery images NOT extracted`)
      console.log(`\n  Debug Info:`)
      console.log(`    gallery_data:`, JSON.stringify(galleryPost.gallery_data, null, 2))
      console.log(`    media_metadata keys:`, Object.keys(galleryPost.media_metadata || {}))
    }

    // Test database insertion with content_metadata
    console.log(`\n5️⃣ Testing database insertion with content_metadata...`)

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Prepare content metadata
    let contentMetadata = null
    if (processedPost.galleryImages && processedPost.galleryImages.length > 1) {
      contentMetadata = {
        gallery_images: processedPost.galleryImages,
        image_count: processedPost.galleryImages.length
      }
    }

    const testData = {
      content_text: `TEST: ${processedPost.title}`,
      content_image_url: processedPost.imageUrls[0] || null,
      content_video_url: null,
      content_type: 'image',
      source_platform: 'reddit',
      original_url: processedPost.permalink,
      original_author: `u/${processedPost.author}`,
      scraped_at: new Date().toISOString(),
      content_hash: `test_gallery_${Date.now()}`,
      content_status: 'discovered',
      confidence_score: 0.8,
      is_approved: false,
      is_rejected: false,
      is_posted: false,
      content_metadata: contentMetadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: inserted, error } = await supabase
      .from('content_queue')
      .insert(testData)
      .select('id, content_metadata')
      .single()

    if (error) {
      console.log(`  ❌ Database insertion failed: ${error.message}`)
      console.log(`  Error details:`, error)
      return
    }

    console.log(`  ✅ Successfully inserted test record with ID: ${inserted.id}`)
    console.log(`  Content Metadata:`, JSON.stringify(inserted.content_metadata, null, 2))

    // Verify the data was stored correctly
    console.log(`\n6️⃣ Verifying stored data...`)
    const { data: verified, error: verifyError } = await supabase
      .from('content_queue')
      .select('id, content_metadata, content_image_url')
      .eq('id', inserted.id)
      .single()

    if (verifyError) {
      console.log(`  ❌ Verification failed: ${verifyError.message}`)
      return
    }

    console.log(`  ✅ Data verified successfully!`)
    console.log(`  content_image_url: ${verified.content_image_url}`)
    console.log(`  content_metadata:`, JSON.stringify(verified.content_metadata, null, 2))

    if (verified.content_metadata?.gallery_images) {
      console.log(`  ✅ Gallery metadata stored correctly with ${verified.content_metadata.gallery_images.length} images`)
    } else {
      console.log(`  ⚠️  Gallery metadata not found in stored record`)
    }

    // Clean up test record
    console.log(`\n7️⃣ Cleaning up test record...`)
    const { error: deleteError } = await supabase
      .from('content_queue')
      .delete()
      .eq('id', inserted.id)

    if (deleteError) {
      console.log(`  ⚠️  Failed to delete test record: ${deleteError.message}`)
    } else {
      console.log(`  ✅ Test record cleaned up`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Gallery extraction test completed successfully!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

// Run the test
testGalleryExtraction()
