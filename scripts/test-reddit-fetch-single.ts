#!/usr/bin/env tsx

import { redditHttpService } from '@/lib/services/reddit-http'

async function testSingleFetch() {
  console.log('🧪 Testing single Reddit post fetch\n')

  try {
    // Test with the "Boiled hot dogs beat grilled" post
    const postId = '1otusxd'
    console.log(`Fetching post ID: ${postId}`)
    console.log(`URL: https://reddit.com/r/hotdogs/comments/${postId}/\n`)

    const result = await redditHttpService.fetchPost(postId)

    if (result) {
      console.log('✅ SUCCESS! Post fetched successfully\n')
      console.log('Post details:')
      console.log(`  Title: ${result.title}`)
      console.log(`  Subreddit: r/${result.subreddit}`)
      console.log(`  Author: u/${result.author}`)
      console.log(`  Is Gallery: ${result.is_gallery || false}`)
      console.log(`  Gallery Data: ${result.gallery_data ? 'Present' : 'Missing'}`)
      console.log(`  Media Metadata: ${result.media_metadata ? `Present (${Object.keys(result.media_metadata).length} items)` : 'Missing'}`)

      if (result.is_gallery && result.media_metadata) {
        const galleryImages: string[] = []
        const items = result.gallery_data?.items || []

        for (const item of items) {
          const mediaId = item.media_id
          const media = result.media_metadata[mediaId]

          if (media && media.s && media.s.u) {
            const imageUrl = media.s.u.replace(/&amp;/g, '&')
            galleryImages.push(imageUrl)
          }
        }

        console.log(`\n  Gallery Images extracted: ${galleryImages.length}`)
        galleryImages.forEach((url, i) => {
          console.log(`    ${i + 1}. ${url.substring(0, 70)}...`)
        })
      }
    } else {
      console.log('❌ FAILED: fetchPost returned null')
    }

  } catch (error) {
    console.error('❌ ERROR:', error instanceof Error ? error.message : String(error))
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace')
  }
}

testSingleFetch()
