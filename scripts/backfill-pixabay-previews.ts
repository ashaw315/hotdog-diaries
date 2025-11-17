#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function backfillPixabayPreviews() {
  console.log('🔄 Backfilling Pixabay Preview URLs\n')
  console.log('='.repeat(60))

  try {
    const apiKey = process.env.PIXABAY_API_KEY
    if (!apiKey) {
      console.error('❌ PIXABAY_API_KEY environment variable not set')
      return
    }

    // Find all Pixabay posts with hotlink-protected URLs
    console.log('\n1️⃣ Finding Pixabay posts with hotlink-protected URLs...')
    const { data: pixabayPosts, error } = await supabase
      .from('content_queue')
      .select('id, content_image_url, original_url, content_text')
      .eq('source_platform', 'pixabay')
      .like('content_image_url', '%pixabay.com/get/%')
      .order('scraped_at', { ascending: false })

    if (error) {
      console.error('❌ Database query error:', error.message)
      return
    }

    if (!pixabayPosts || pixabayPosts.length === 0) {
      console.log('✅ No Pixabay posts need backfilling!')
      return
    }

    console.log(`📊 Found ${pixabayPosts.length} Pixabay posts to update\n`)

    let processedCount = 0
    let updatedCount = 0
    let errors = 0

    // Process each post
    for (const post of pixabayPosts) {
      processedCount++
      console.log(`\n[${processedCount}/${pixabayPosts.length}] Processing: ${post.original_url?.substring(0, 60)}...`)

      try {
        // Extract Pixabay photo ID from URL
        // Format: https://pixabay.com/photos/hot-dog-food-1234567/ or https://pixabay.com/en/hot-dog-food-1234567/
        const photoIdMatch = post.original_url?.match(/\/(\d+)\/?$/)
        if (!photoIdMatch) {
          console.log('  ⚠️  Could not extract photo ID from URL')
          continue
        }

        const photoId = photoIdMatch[1]
        console.log(`  Pixabay ID: ${photoId}`)

        // Fetch photo details from Pixabay API
        const apiUrl = `https://pixabay.com/api/?key=${apiKey}&id=${photoId}`
        const response = await fetch(apiUrl)

        if (!response.ok) {
          console.log(`  ⚠️  API request failed with status ${response.status}`)
          continue
        }

        const data = await response.json()

        if (!data.hits || data.hits.length === 0) {
          console.log('  ⚠️  Photo not found in Pixabay API')
          continue
        }

        const photo = data.hits[0]

        if (!photo.previewURL) {
          console.log('  ⚠️  No previewURL available for this photo')
          continue
        }

        console.log(`  ✅ Found previewURL: ${photo.previewURL.substring(0, 60)}...`)

        // Update database with preview URL
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({
            content_image_url: photo.previewURL,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

        if (updateError) {
          console.log(`  ❌ Database update failed: ${updateError.message}`)
          errors++
        } else {
          console.log(`  💾 Database updated successfully`)
          updatedCount++
        }

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500))

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
    console.log(`  Posts updated: ${updatedCount}`)
    console.log(`  Errors: ${errors}`)
    console.log('='.repeat(60))

    if (updatedCount > 0) {
      console.log('\n✨ Success! Pixabay images now use preview URLs.')
      console.log('Images should now display correctly in the archive.')
    }

  } catch (error) {
    console.error('\n❌ Backfill failed with error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

// Run the backfill
backfillPixabayPreviews()
