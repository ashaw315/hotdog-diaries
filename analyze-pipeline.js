#!/usr/bin/env node

const { spawn } = require('child_process')

const testScript = `
import { db } from './lib/db.js'

async function analyzePipeline() {
  console.log('🔍 Content Processing Pipeline Analysis')
  console.log('=' .repeat(60))
  
  try {
    // Get examples of approved content
    console.log('\\n✅ APPROVED CONTENT EXAMPLES:')
    const approved = await db.query(\`
      SELECT 
        id,
        source_platform,
        content_text,
        content_image_url,
        content_video_url,
        original_author,
        content_hash,
        created_at
      FROM content_queue 
      WHERE content_status = 'approved'
      ORDER BY created_at DESC
      LIMIT 5
    \`)
    
    approved.rows.forEach((row, i) => {
      console.log(\`\\n\${i+1}. [\${row.source_platform.toUpperCase()}] ID: \${row.id}\`)
      console.log(\`   📝 Title: \${row.content_text?.substring(0, 100)}...\`)
      console.log(\`   👤 Author: \${row.original_author || 'Unknown'}\`)
      console.log(\`   🖼️  Image: \${row.content_image_url ? 'Yes' : 'No'}\`)
      console.log(\`   🎬 Video: \${row.content_video_url ? 'Yes' : 'No'}\`)
      console.log(\`   🔒 Hash: \${row.content_hash}\`)
      console.log(\`   📅 Added: \${new Date(row.created_at).toLocaleString()}\`)
      
      // Platform is indicated by source_platform
      console.log(\`   🌐 Platform: \${row.source_platform}\`)
    })
    
    // Get examples of rejected content
    console.log('\\n\\n❌ REJECTED CONTENT EXAMPLES:')
    const rejected = await db.query(\`
      SELECT 
        id,
        source_platform,
        content_text,
        rejection_reason,
        content_hash,
        created_at
      FROM content_queue 
      WHERE content_status = 'rejected'
      ORDER BY created_at DESC
      LIMIT 5
    \`)
    
    rejected.rows.forEach((row, i) => {
      console.log(\`\\n\${i+1}. [\${row.source_platform.toUpperCase()}] ID: \${row.id}\`)
      console.log(\`   📝 Content: \${row.content_text?.substring(0, 100)}...\`)
      console.log(\`   ❌ Reason: \${row.rejection_reason || 'Not specified'}\`)
      console.log(\`   📅 Added: \${new Date(row.created_at).toLocaleString()}\`)
    })
    
    // Analyze required fields
    console.log('\\n\\n🔍 CONTENT FIELD ANALYSIS:')
    const fieldAnalysis = await db.query(\`
      SELECT 
        COUNT(*) as total,
        COUNT(content_text) as has_text,
        COUNT(content_image_url) as has_image,
        COUNT(content_video_url) as has_video,
        COUNT(original_author) as has_author,
        COUNT(content_hash) as has_hash,
        AVG(LENGTH(content_text)) as avg_text_length
      FROM content_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
    \`)
    
    const fields = fieldAnalysis.rows[0]
    console.log(\`📊 Field Completeness (last 24h, \${fields.total} items):\`)
    console.log(\`   📝 Text: \${fields.has_text}/\${fields.total} (\${Math.round(fields.has_text/fields.total*100)}%)\`)
    console.log(\`   🖼️  Images: \${fields.has_image}/\${fields.total} (\${Math.round(fields.has_image/fields.total*100)}%)\`)
    console.log(\`   🎬 Videos: \${fields.has_video}/\${fields.total} (\${Math.round(fields.has_video/fields.total*100)}%)\`)
    console.log(\`   👤 Authors: \${fields.has_author}/\${fields.total} (\${Math.round(fields.has_author/fields.total*100)}%)\`)
    console.log(\`   🔒 Hashes: \${fields.has_hash}/\${fields.total} (\${Math.round(fields.has_hash/fields.total*100)}%)\`)
    console.log(\`   📏 Avg text length: \${Math.round(fields.avg_text_length)} characters\`)
    
    // Check duplicate detection effectiveness
    console.log('\\n\\n🔄 DUPLICATE DETECTION ANALYSIS:')
    const duplicateAnalysis = await db.query(\`
      SELECT 
        content_hash,
        COUNT(*) as count,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen,
        ARRAY_AGG(DISTINCT source_platform) as platforms
      FROM content_queue
      GROUP BY content_hash
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    \`)
    
    if (duplicateAnalysis.rows.length > 0) {
      console.log(\`🔍 Found \${duplicateAnalysis.rows.length} duplicate hash groups:\`)
      duplicateAnalysis.rows.forEach((row, i) => {
        const timeDiff = Math.round((new Date(row.last_seen) - new Date(row.first_seen)) / (1000 * 60))
        console.log(\`  \${i+1}. Hash \${row.content_hash}: \${row.count} items\`)
        console.log(\`     Platforms: \${row.platforms.join(', ')}\`)
        console.log(\`     Time span: \${timeDiff} minutes\`)
      })
    } else {
      console.log('✅ No duplicate content hashes found - duplicate detection working well!')
    }
    
    // Content scoring analysis
    console.log('\\n\\n⭐ CONTENT SCORING ANALYSIS:')
    
    // Check content quality by platform
    const scoringCheck = await db.query(\`
      SELECT 
        source_platform,
        content_status,
        COUNT(*) as count
      FROM content_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY source_platform, content_status
      ORDER BY count DESC
      LIMIT 10
    \`)
    
    console.log('Content status by platform:')
    scoringCheck.rows.forEach(row => {
      console.log(\`  📊 \${row.source_platform}: \${row.content_status} (\${row.count} items)\`)
    })
    
    // Processing pipeline status
    console.log('\\n\\n⚙️ PROCESSING PIPELINE STATUS:')
    const pipelineStatus = await db.query(\`
      SELECT 
        content_status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
      FROM content_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY content_status
      ORDER BY count DESC
    \`)
    
    pipelineStatus.rows.forEach(row => {
      const avgTime = row.avg_processing_time ? Math.round(row.avg_processing_time) : 0
      console.log(\`  📊 \${row.content_status}: \${row.count} items (avg \${avgTime}s processing)\`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    process.exit(0)
  }
}

analyzePipeline()
`

const child = spawn('npx', ['tsx', '--eval', testScript], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  process.exit(code)
})