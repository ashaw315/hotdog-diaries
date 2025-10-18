#!/usr/bin/env tsx

import { sql } from '@vercel/postgres'

/**
 * Script to identify and remove duplicate content in production database
 */
async function fixDuplicateContent() {
  try {
    console.log('🔍 Checking for duplicate content in production database...')
    
    // First, identify duplicates based on content_hash
    const duplicates = await sql`
      SELECT 
        content_hash,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at ASC) as ids,
        ARRAY_AGG(content_text) as texts,
        ARRAY_AGG(is_posted) as posted_status
      FROM content_queue
      GROUP BY content_hash
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicates found based on content_hash')
      
      // Check for duplicates based on exact content match (in case hash is different)
      const contentDuplicates = await sql`
        SELECT 
          content_text,
          content_image_url,
          COUNT(*) as count,
          ARRAY_AGG(id ORDER BY created_at ASC) as ids,
          ARRAY_AGG(is_posted) as posted_status
        FROM content_queue
        WHERE content_text IS NOT NULL OR content_image_url IS NOT NULL
        GROUP BY content_text, content_image_url
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `
      
      if (contentDuplicates.rows.length === 0) {
        console.log('✅ No duplicates found based on content match either')
        return
      }
      
      console.log(`⚠️ Found ${contentDuplicates.rows.length} sets of duplicates based on content match`)
      
      // Process content-based duplicates
      for (const dup of contentDuplicates.rows) {
        const ids = dup.ids as number[]
        const postedStatus = dup.posted_status as boolean[]
        
        console.log(`\n📋 Duplicate set with ${dup.count} copies:`)
        console.log(`   Content: ${dup.content_text ? dup.content_text.substring(0, 50) + '...' : 'No text'}`)
        console.log(`   IDs: ${ids.join(', ')}`)
        console.log(`   Posted status: ${postedStatus.join(', ')}`)
        
        // Keep the first one (oldest) or the posted one if any exists
        const postedIndex = postedStatus.indexOf(true)
        const keepId = postedIndex >= 0 ? ids[postedIndex] : ids[0]
        const deleteIds = ids.filter(id => id !== keepId)
        
        console.log(`   ✅ Keeping ID: ${keepId}`)
        console.log(`   🗑️ Deleting IDs: ${deleteIds.join(', ')}`)
        
        // Delete the duplicates
        if (deleteIds.length > 0) {
          const result = await sql`
            DELETE FROM content_queue 
            WHERE id = ANY(${deleteIds}::int[])
          `
          console.log(`   ✅ Deleted ${deleteIds.length} duplicates`)
        }
      }
      
    } else {
      console.log(`⚠️ Found ${duplicates.rows.length} sets of duplicates based on content_hash`)
      
      // Process hash-based duplicates
      for (const dup of duplicates.rows) {
        const ids = dup.ids as number[]
        const postedStatus = dup.posted_status as boolean[]
        
        console.log(`\n📋 Duplicate set with ${dup.count} copies:`)
        console.log(`   Hash: ${dup.content_hash}`)
        console.log(`   IDs: ${ids.join(', ')}`)
        console.log(`   Content samples: ${(dup.texts as string[]).map(t => t ? t.substring(0, 30) : 'No text').join(' | ')}`)
        console.log(`   Posted status: ${postedStatus.join(', ')}`)
        
        // Keep the first one (oldest) or the posted one if any exists
        const postedIndex = postedStatus.indexOf(true)
        const keepId = postedIndex >= 0 ? ids[postedIndex] : ids[0]
        const deleteIds = ids.filter(id => id !== keepId)
        
        console.log(`   ✅ Keeping ID: ${keepId}`)
        console.log(`   🗑️ Deleting IDs: ${deleteIds.join(', ')}`)
        
        // Delete the duplicates
        if (deleteIds.length > 0) {
          const result = await sql`
            DELETE FROM content_queue 
            WHERE id = ANY(${deleteIds}::int[])
          `
          console.log(`   ✅ Deleted ${deleteIds.length} duplicates`)
        }
      }
    }
    
    // Final verification
    console.log('\n📊 Final verification...')
    
    const totalContent = await sql`
      SELECT COUNT(*) as count FROM content_queue
    `
    
    const uniqueHashes = await sql`
      SELECT COUNT(DISTINCT content_hash) as count FROM content_queue
    `
    
    console.log(`Total content items: ${totalContent.rows[0].count}`)
    console.log(`Unique content hashes: ${uniqueHashes.rows[0].count}`)
    
    if (totalContent.rows[0].count === uniqueHashes.rows[0].count) {
      console.log('✅ All content is now unique!')
    } else {
      console.log('⚠️ There may still be some duplicates with null hashes')
    }
    
    console.log('\n🎉 Duplicate cleanup completed!')
    
  } catch (error) {
    console.error('❌ Failed to fix duplicates:', error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  fixDuplicateContent().catch(console.error)
}

export default fixDuplicateContent