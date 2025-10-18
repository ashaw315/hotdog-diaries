#!/usr/bin/env node
import { createSimpleClient } from '../utils/supabase/server'
import crypto from 'crypto'

interface ContentItem {
  id: number
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  original_url?: string
  source_platform?: string
  content_hash?: string
  created_at: string
  is_posted?: boolean
}

interface DuplicateGroup {
  content_text: string
  content_image_url?: string
  content_video_url?: string
  source_platform: string
  ids: number[]
  count: number
}

function generateContentHash(content: ContentItem): string {
  const hashInput = [
    content.source_platform?.toLowerCase(),
    content.content_text?.toLowerCase().trim(),
    content.content_image_url,
    content.content_video_url,
    content.original_url
  ].filter(Boolean).join('|')
  
  return crypto.createHash('sha256')
    .update(hashInput)
    .digest('hex')
}

async function deduplicateDatabase() {
  console.log('🔍 Starting comprehensive database deduplication...')
  
  const supabase = createSimpleClient()
  
  try {
    // Step 1: Find duplicates in content_queue
    console.log('\n📊 Step 1: Analyzing content_queue for duplicates...')
    
    const { data: allContent, error: fetchError } = await supabase
      .from('content_queue')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (fetchError) throw fetchError
    
    if (!allContent || allContent.length === 0) {
      console.log('No content found in database')
      return
    }
    
    console.log(`Found ${allContent.length} total content items`)
    
    // Group duplicates by various criteria
    const hashGroups = new Map<string, ContentItem[]>()
    const imageGroups = new Map<string, ContentItem[]>()
    const textGroups = new Map<string, ContentItem[]>()
    const urlGroups = new Map<string, ContentItem[]>()
    
    // Build groups
    for (const content of allContent) {
      // Group by content hash
      const hash = generateContentHash(content)
      if (!hashGroups.has(hash)) hashGroups.set(hash, [])
      hashGroups.get(hash)!.push(content)
      
      // Group by image URL
      if (content.content_image_url) {
        if (!imageGroups.has(content.content_image_url)) {
          imageGroups.set(content.content_image_url, [])
        }
        imageGroups.get(content.content_image_url)!.push(content)
      }
      
      // Group by exact text (for text duplicates)
      if (content.content_text && content.content_text.length > 10) {
        const textKey = `${content.source_platform}:${content.content_text.toLowerCase().trim()}`
        if (!textGroups.has(textKey)) textGroups.set(textKey, [])
        textGroups.get(textKey)!.push(content)
      }
      
      // Group by original URL
      if (content.original_url) {
        if (!urlGroups.has(content.original_url)) {
          urlGroups.set(content.original_url, [])
        }
        urlGroups.get(content.original_url)!.push(content)
      }
    }
    
    // Find all duplicate IDs to remove
    const duplicateIds = new Set<number>()
    const keepIds = new Set<number>()
    
    // Process hash duplicates
    console.log('\n🔍 Finding duplicates by content hash...')
    for (const [hash, items] of hashGroups) {
      if (items.length > 1) {
        // Keep the oldest one (or the posted one if any are posted)
        const postedItem = items.find(i => i.is_posted)
        const keepItem = postedItem || items[0]
        keepIds.add(keepItem.id)
        
        for (const item of items) {
          if (item.id !== keepItem.id) {
            duplicateIds.add(item.id)
          }
        }
        
        console.log(`  Hash ${hash.substring(0, 8)}... has ${items.length} duplicates, keeping ID ${keepItem.id}`)
      }
    }
    
    // Process image URL duplicates
    console.log('\n🖼️  Finding duplicates by image URL...')
    for (const [url, items] of imageGroups) {
      if (items.length > 1) {
        const postedItem = items.find(i => i.is_posted)
        const keepItem = postedItem || items[0]
        
        if (!keepIds.has(keepItem.id)) {
          keepIds.add(keepItem.id)
        }
        
        for (const item of items) {
          if (item.id !== keepItem.id && !keepIds.has(item.id)) {
            duplicateIds.add(item.id)
          }
        }
        
        console.log(`  Image URL has ${items.length} duplicates, keeping ID ${keepItem.id}`)
      }
    }
    
    // Process text duplicates
    console.log('\n📝 Finding duplicates by text content...')
    for (const [textKey, items] of textGroups) {
      if (items.length > 1) {
        const postedItem = items.find(i => i.is_posted)
        const keepItem = postedItem || items[0]
        
        if (!keepIds.has(keepItem.id)) {
          keepIds.add(keepItem.id)
        }
        
        for (const item of items) {
          if (item.id !== keepItem.id && !keepIds.has(item.id)) {
            duplicateIds.add(item.id)
          }
        }
        
        const preview = textKey.substring(0, 50)
        console.log(`  Text "${preview}..." has ${items.length} duplicates, keeping ID ${keepItem.id}`)
      }
    }
    
    // Convert to array and remove any IDs that are marked as "keep"
    const idsToRemove = Array.from(duplicateIds).filter(id => !keepIds.has(id))
    
    console.log(`\n📊 Summary:`)
    console.log(`  - Total content items: ${allContent.length}`)
    console.log(`  - Unique items to keep: ${keepIds.size}`)
    console.log(`  - Duplicates to remove: ${idsToRemove.length}`)
    
    if (idsToRemove.length === 0) {
      console.log('✅ No duplicates found!')
      return
    }
    
    // Step 2: Remove duplicates from posted_content first (due to foreign key)
    console.log('\n🗑️  Step 2: Removing duplicates from posted_content...')
    
    const { error: deletePostedError } = await supabase
      .from('posted_content')
      .delete()
      .in('content_queue_id', idsToRemove)
    
    if (deletePostedError) {
      console.warn('Warning: Could not delete from posted_content:', deletePostedError.message)
    }
    
    // Step 3: Remove duplicates from content_queue
    console.log('\n🗑️  Step 3: Removing duplicates from content_queue...')
    
    const batchSize = 100
    let removedCount = 0
    
    for (let i = 0; i < idsToRemove.length; i += batchSize) {
      const batch = idsToRemove.slice(i, i + batchSize)
      const { error: deleteError } = await supabase
        .from('content_queue')
        .delete()
        .in('id', batch)
      
      if (deleteError) {
        console.error(`Failed to delete batch ${i}-${i + batchSize}:`, deleteError.message)
      } else {
        removedCount += batch.length
        console.log(`  Removed batch ${i + 1}-${Math.min(i + batchSize, idsToRemove.length)} (${batch.length} items)`)
      }
    }
    
    // Step 4: Clean up posted_content duplicates (same content_queue_id multiple times)
    console.log('\n🧹 Step 4: Cleaning up posted_content duplicates...')
    
    const { data: postedContent } = await supabase
      .from('posted_content')
      .select('*')
      .order('posted_at', { ascending: true })
    
    if (postedContent) {
      const postedByQueueId = new Map<number, any[]>()
      
      for (const post of postedContent) {
        if (!postedByQueueId.has(post.content_queue_id)) {
          postedByQueueId.set(post.content_queue_id, [])
        }
        postedByQueueId.get(post.content_queue_id)!.push(post)
      }
      
      const postedDuplicatesToRemove: number[] = []
      
      for (const [queueId, posts] of postedByQueueId) {
        if (posts.length > 1) {
          // Keep first posting, remove others
          for (let i = 1; i < posts.length; i++) {
            postedDuplicatesToRemove.push(posts[i].id)
          }
          console.log(`  Queue ID ${queueId} posted ${posts.length} times, removing ${posts.length - 1} duplicates`)
        }
      }
      
      if (postedDuplicatesToRemove.length > 0) {
        const { error: deletePostedDupes } = await supabase
          .from('posted_content')
          .delete()
          .in('id', postedDuplicatesToRemove)
        
        if (deletePostedDupes) {
          console.error('Failed to remove posted_content duplicates:', deletePostedDupes.message)
        } else {
          console.log(`  Removed ${postedDuplicatesToRemove.length} duplicate postings`)
        }
      }
    }
    
    // Step 5: Update content hashes
    console.log('\n🔧 Step 5: Updating content hashes...')
    
    const { data: remainingContent } = await supabase
      .from('content_queue')
      .select('*')
    
    if (remainingContent) {
      let hashUpdateCount = 0
      
      for (const content of remainingContent) {
        const correctHash = generateContentHash(content)
        if (content.content_hash !== correctHash) {
          const { error: updateError } = await supabase
            .from('content_queue')
            .update({ content_hash: correctHash })
            .eq('id', content.id)
          
          if (!updateError) {
            hashUpdateCount++
          }
        }
      }
      
      console.log(`  Updated ${hashUpdateCount} content hashes`)
    }
    
    // Step 6: Sync is_posted flags
    console.log('\n🔄 Step 6: Syncing is_posted flags...')
    
    const { data: postedIds } = await supabase
      .from('posted_content')
      .select('content_queue_id')
    
    if (postedIds) {
      const postedQueueIds = postedIds.map(p => p.content_queue_id)
      
      // Set is_posted = true for posted items
      await supabase
        .from('content_queue')
        .update({ is_posted: true })
        .in('id', postedQueueIds)
      
      // Set is_posted = false for non-posted items
      await supabase
        .from('content_queue')
        .update({ is_posted: false })
        .not('id', 'in', `(${postedQueueIds.join(',')})`)
      
      console.log('  Synced is_posted flags')
    }
    
    // Final statistics
    console.log('\n✅ Deduplication complete!')
    
    const { data: finalStats } = await supabase
      .from('content_queue')
      .select('id, is_posted, is_approved')
    
    const { data: postedStats } = await supabase
      .from('posted_content')
      .select('id')
    
    console.log('\n📈 Final Statistics:')
    console.log(`  - Total content items: ${finalStats?.length || 0}`)
    console.log(`  - Posted items: ${postedStats?.length || 0}`)
    console.log(`  - Approved (unposted): ${finalStats?.filter(c => c.is_approved && !c.is_posted).length || 0}`)
    console.log(`  - Ready to post: ${finalStats?.filter(c => c.is_approved && !c.is_posted).length || 0}`)
    console.log(`  - Duplicates removed: ${removedCount}`)
    
  } catch (error) {
    console.error('❌ Deduplication failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  deduplicateDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export { deduplicateDatabase }