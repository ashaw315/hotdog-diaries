#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { redditHttpService } from '@/lib/services/reddit-http'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function backfillRedditGalleries() {
  console.log('🔄 Backfilling Reddit Gallery Metadata\n')
  console.log('='.repeat(60))

  try {
    // Find all Reddit posts that might be galleries but don't have metadata
    console.log('\n1️⃣ Finding Reddit posts without gallery metadata...')
    const { data: redditPosts, error } = await supabase
      .from('content_queue')
      .select('id, original_url, content_text, scraped_at')
      .eq('source_platform', 'reddit')
      .eq('content_type', 'image')
      .is('content_metadata', null)
      .order('scraped_at', { ascending: false })
      .limit(50) // Process in batches

    if (error) {
      console.error('❌ Database query error:', error.message)
      return
    }

    if (!redditPosts || redditPosts.length === 0) {
      console.log('✅ No Reddit posts need backfilling!')
      return
    }

    console.log(`📊 Found ${redditPosts.length} Reddit posts to check\n`)

    let processedCount = 0
    let galleriesFound = 0
    let galleriesUpdated = 0
    let errors = 0

    // Process each post
    for (const post of redditPosts) {
      processedCount++
      console.log(`\n[${processedCount}/${redditPosts.length}] Checking: ${post.original_url?.substring(0, 60)}...`)

      try {
        // Extract Reddit post ID from URL
        // Format: https://reddit.com/r/subreddit/comments/POSTID/title/
        const postIdMatch = post.original_url?.match(/\/comments\/([a-z0-9]+)\//i)
        if (!postIdMatch) {
          console.log('  ⚠️  Could not extract post ID from URL')
          continue
        }

        const postId = postIdMatch[1]
        console.log(`  Reddit ID: ${postId}`)

        // Fetch post details from Reddit
        const redditData = await redditHttpService.fetchPost(postId)

        if (!redditData) {
          console.log('  ⚠️  Could not fetch post from Reddit')
          continue
        }

        // Check if it's a gallery
        if (redditData.is_gallery && redditData.media_metadata) {
          galleriesFound++
          console.log(`  🎠 Gallery detected! Extracting images...`)

          // Extract gallery images
          const galleryImages: string[] = []
          const items = redditData.gallery_data?.items || []

          for (const item of items) {
            const mediaId = item.media_id
            const media = redditData.media_metadata[mediaId]

            if (media && media.s && media.s.u) {
              // Decode HTML entities in URL
              const imageUrl = media.s.u.replace(/&amp;/g, '&')
              galleryImages.push(imageUrl)
            }
          }

          if (galleryImages.length > 0) {
            console.log(`  ✅ Found ${galleryImages.length} images`)

            // Update database with gallery metadata
            const contentMetadata = {
              gallery_images: galleryImages,
              image_count: galleryImages.length
            }

            const { error: updateError } = await supabase
              .from('content_queue')
              .update({
                content_metadata: contentMetadata,
                content_image_url: galleryImages[0], // Set first image as primary
                updated_at: new Date().toISOString()
              })
              .eq('id', post.id)

            if (updateError) {
              console.log(`  ❌ Database update failed: ${updateError.message}`)
              errors++
            } else {
              console.log(`  💾 Database updated successfully`)
              galleriesUpdated++
            }
          } else {
            console.log(`  ⚠️  Gallery detected but no images extracted`)
          }
        } else {
          console.log(`  ℹ️  Not a gallery post`)
        }

        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.log(`  ❌ Error processing post: ${error instanceof Error ? error.message : String(error)}`)
        errors++
        continue
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Backfill Summary:')
    console.log(`  Posts processed: ${processedCount}`)
    console.log(`  Galleries found: ${galleriesFound}`)
    console.log(`  Galleries updated: ${galleriesUpdated}`)
    console.log(`  Errors: ${errors}`)
    console.log('='.repeat(60))

    if (galleriesUpdated > 0) {
      console.log('\n✨ Success! Gallery metadata has been backfilled.')
      console.log('The carousel should now work for these posts.')
    }

  } catch (error) {
    console.error('\n❌ Backfill failed with error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

// Run the backfill
backfillRedditGalleries()
