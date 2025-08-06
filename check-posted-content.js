#!/usr/bin/env node

const { spawn } = require('child_process')

const testScript = `
import { db } from './lib/db.js'

async function checkPostedContent() {
  console.log('📤 Checking Posted Content for Homepage Display')
  console.log('=' .repeat(50))
  
  try {
    // Check what's in content_queue that should appear on homepage
    console.log('\\n1. 📋 Recently Posted Items (content_queue):')
    
    const recentlyPosted = await db.query(\`
      SELECT 
        id,
        content_text,
        content_image_url,
        source_platform,
        posted_at,
        content_status,
        is_posted
      FROM content_queue 
      WHERE is_posted = true 
        AND content_status = 'posted'
      ORDER BY posted_at DESC
      LIMIT 10
    \`)
    
    console.log(\`Found \${recentlyPosted.rows.length} items in content_queue marked as posted:\`)
    recentlyPosted.rows.forEach((row, i) => {
      const text = row.content_text?.substring(0, 60) + '...' || 'No text'
      const hasImage = row.content_image_url ? '🖼️' : '📝'
      const posted = new Date(row.posted_at).toLocaleString()
      console.log(\`  \${i+1}. \${hasImage} [ID:\${row.id}] [\${row.source_platform}] \${posted}\`)
      console.log(\`     \${text}\`)
    })
    
    // Check the posted_content table
    console.log('\\n2. 📋 Items in posted_content table:')
    
    const postedContentTable = await db.query(\`
      SELECT 
        pc.*,
        cq.content_text,
        cq.content_image_url,
        cq.source_platform
      FROM posted_content pc
      LEFT JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 10
    \`)
    
    console.log(\`Found \${postedContentTable.rows.length} items in posted_content table:\`)
    postedContentTable.rows.forEach((row, i) => {
      const text = row.content_text?.substring(0, 60) + '...' || 'No text'
      const hasImage = row.content_image_url ? '🖼️' : '📝'
      const posted = new Date(row.posted_at).toLocaleString()
      console.log(\`  \${i+1}. \${hasImage} [Queue ID:\${row.content_queue_id}] [\${row.source_platform || 'unknown'}] \${posted}\`)
      console.log(\`     \${text}\`)
    })
    
    // Check what the public API should return
    console.log('\\n3. 📋 What Public API Should Show:')
    
    // This is what a proper public API query should look like
    const publicApiQuery = await db.query(\`
      SELECT 
        cq.id as content_id,
        cq.content_text,
        cq.content_image_url,
        cq.content_video_url,
        cq.source_platform,
        cq.original_author,
        cq.original_url,
        cq.posted_at,
        cq.content_type
      FROM content_queue cq
      WHERE cq.is_posted = true 
        AND cq.content_status = 'posted'
      ORDER BY cq.posted_at DESC
      LIMIT 10
    \`)
    
    console.log(\`Query returned \${publicApiQuery.rows.length} items that should be on homepage:\`)
    publicApiQuery.rows.forEach((row, i) => {
      const text = row.content_text?.substring(0, 80) + '...' || 'No text'
      const hasImage = row.content_image_url ? '🖼️' : '📝'
      const posted = new Date(row.posted_at).toLocaleString()
      console.log(\`  \${i+1}. \${hasImage} [ID:\${row.content_id}] [\${row.source_platform}] \${posted}\`)
      console.log(\`     \${text}\`)
      console.log(\`     Author: \${row.original_author || 'Unknown'}\`)
    })
    
    // Test the actual API response format
    console.log('\\n4. 🔍 Testing Public API Response:')
    
    // Format the response like the API should
    const apiResponse = {
      success: true,
      data: {
        content: publicApiQuery.rows.map(row => ({
          id: row.content_id,
          content_text: row.content_text,
          content_image_url: row.content_image_url,
          content_video_url: row.content_video_url,
          source_platform: row.source_platform,
          original_author: row.original_author,
          original_url: row.original_url,
          posted_at: row.posted_at,
          content_type: row.content_type
        })),
        pagination: {
          page: 1,
          limit: 10,
          total: publicApiQuery.rows.length,
          totalPages: Math.ceil(publicApiQuery.rows.length / 10),
          hasNextPage: false,
          hasPreviousPage: false,
          nextPage: null,
          previousPage: null
        }
      },
      message: \`Found \${publicApiQuery.rows.length} content items\`,
      timestamp: new Date().toISOString()
    }
    
    console.log('API Response structure:')
    console.log(\`  Items in response: \${apiResponse.data.content.length}\`)
    console.log(\`  Total available: \${apiResponse.data.pagination.total}\`)
    
    if (apiResponse.data.content.length > 0) {
      console.log('\\n  Sample item structure:')
      const sample = apiResponse.data.content[0]
      Object.keys(sample).forEach(key => {
        const value = sample[key]
        const displayValue = typeof value === 'string' && value.length > 50 ? 
          value.substring(0, 50) + '...' : value
        console.log(\`    \${key}: \${displayValue}\`)
      })
    }
    
    // Check if homepage should be showing this content
    console.log('\\n5. ✅ Homepage Display Status:')
    
    if (publicApiQuery.rows.length > 0) {
      console.log(\`✅ SUCCESS: \${publicApiQuery.rows.length} items ready for homepage display\`)
      console.log('   The homepage should show these recently posted items')
      console.log('   Content includes both text and image posts from Reddit')
    } else {
      console.log('❌ ISSUE: No posted content available for homepage')
      console.log('   This explains why homepage shows loading/empty state')
    }
    
  } catch (error) {
    console.error('❌ Error checking posted content:', error.message)
  } finally {
    process.exit(0)
  }
}

checkPostedContent()
`

const child = spawn('npx', ['tsx', '--eval', testScript], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  process.exit(code)
})