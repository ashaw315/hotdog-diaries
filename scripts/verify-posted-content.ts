#!/usr/bin/env tsx

/**
 * Verify that the Posted Content page fixes are working correctly in production
 *
 * This script checks:
 * 1. Invalid Date display is fixed (posted_at values are valid ISO strings)
 * 2. Pagination is working (API returns hasMore flag)
 */

async function verifyPostedContent() {
  const BASE_URL = 'https://hotdog-diaries.vercel.app'

  console.log('🔍 Verifying Posted Content fixes in production...\n')

  try {
    // Test 1: Check that API returns valid posted_at timestamps
    console.log('Test 1: Checking posted_at timestamps...')
    const response = await fetch(`${BASE_URL}/api/admin/content?status=posted&limit=5&offset=0&sortOrder=desc`)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.data?.content || []
    const pagination = data.data?.pagination || {}

    console.log(`✅ Received ${content.length} posted items`)

    // Check that posted_at values are valid
    let invalidDates = 0
    let validDates = 0

    for (const item of content) {
      if (!item.posted_at) {
        console.log(`❌ Item ${item.id} has NULL posted_at`)
        invalidDates++
      } else {
        const date = new Date(item.posted_at)
        if (isNaN(date.getTime())) {
          console.log(`❌ Item ${item.id} has invalid posted_at: ${item.posted_at}`)
          invalidDates++
        } else {
          validDates++
        }
      }
    }

    console.log(`✅ Valid dates: ${validDates}/${content.length}`)
    if (invalidDates > 0) {
      console.log(`❌ Invalid dates: ${invalidDates}/${content.length}`)
    }

    // Test 2: Check that pagination data is included
    console.log('\nTest 2: Checking pagination data...')
    console.log(`Total: ${pagination.total}`)
    console.log(`Offset: ${pagination.offset}`)
    console.log(`Limit: ${pagination.limit}`)
    console.log(`Has More: ${pagination.hasMore}`)

    if (pagination.hasMore !== undefined) {
      console.log('✅ Pagination hasMore flag is present')
    } else {
      console.log('❌ Pagination hasMore flag is missing')
    }

    // Test 3: Show sample dates
    console.log('\nTest 3: Sample posted_at values:')
    content.slice(0, 3).forEach((item: any) => {
      const date = new Date(item.posted_at)
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      console.log(`  Post #${item.post_order}: ${formatted} (${item.posted_at})`)
    })

    // Test 4: Check sorting
    console.log('\nTest 4: Checking if posts are sorted by posted_at DESC...')
    let sorted = true
    for (let i = 0; i < content.length - 1; i++) {
      const current = new Date(content[i].posted_at).getTime()
      const next = new Date(content[i + 1].posted_at).getTime()
      if (current < next) {
        console.log(`❌ Post #${content[i].post_order} (${content[i].posted_at}) comes before Post #${content[i+1].post_order} (${content[i+1].posted_at})`)
        sorted = false
      }
    }

    if (sorted) {
      console.log('✅ Posts are correctly sorted by posted_at DESC')
    } else {
      console.log('❌ Posts are NOT sorted correctly')
    }

    // Summary
    console.log('\n📊 Summary:')
    console.log(`  ✅ API responding: YES`)
    console.log(`  ✅ Valid dates: ${validDates}/${content.length}`)
    console.log(`  ✅ Pagination data: ${pagination.hasMore !== undefined ? 'YES' : 'NO'}`)
    console.log(`  ✅ Sorted correctly: ${sorted ? 'YES' : 'NO'}`)

    if (invalidDates === 0 && pagination.hasMore !== undefined && sorted) {
      console.log('\n🎉 All fixes are working correctly!')
      process.exit(0)
    } else {
      console.log('\n⚠️ Some issues detected')
      process.exit(1)
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

verifyPostedContent()
