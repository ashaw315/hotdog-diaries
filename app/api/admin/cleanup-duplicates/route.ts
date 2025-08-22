import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { generateContentHash } from '@/lib/utils/content-deduplication'

export async function POST(request: NextRequest) {
  console.log('🧹 Starting comprehensive duplicate cleanup...')
  
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // Get all content ordered by creation date (keep earliest)
    const { data: allContent, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, content_text, content_image_url, content_video_url, original_url, source_platform, content_hash, created_at, is_posted')
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch content: ${fetchError.message}`)
    }

    if (!allContent || allContent.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No content to process',
        duplicatesRemoved: 0
      })
    }

    console.log(`📊 Processing ${allContent.length} content items...`)

    // Group content to find duplicates
    const seenHashes = new Set()
    const seenImageUrls = new Set()
    const seenOriginalUrls = new Set()
    const seenTextHashes = new Set()
    
    const duplicatesToRemove: number[] = []
    const hashUpdates: Array<{ id: number; hash: string }> = []
    
    for (const content of allContent) {
      let isDuplicate = false
      let duplicateReason = ''
      
      // Generate proper hash if missing or incorrect
      const correctHash = generateContentHash(content)
      if (content.content_hash !== correctHash) {
        hashUpdates.push({ id: content.id, hash: correctHash })
      }
      
      // Check for exact hash duplicates
      if (seenHashes.has(correctHash)) {
        isDuplicate = true
        duplicateReason = 'Exact content hash'
      }
      
      // Check for image URL duplicates
      if (!isDuplicate && content.content_image_url && seenImageUrls.has(content.content_image_url)) {
        isDuplicate = true
        duplicateReason = 'Same image URL'
      }
      
      // Check for original URL duplicates
      if (!isDuplicate && content.original_url && seenOriginalUrls.has(content.original_url)) {
        isDuplicate = true
        duplicateReason = 'Same original URL'
      }
      
      // Check for very similar text content
      if (!isDuplicate && content.content_text && content.content_text.length > 20) {
        const textHash = content.content_text.toLowerCase().trim().substring(0, 100)
        if (seenTextHashes.has(textHash)) {
          isDuplicate = true
          duplicateReason = 'Very similar text'
        }
        seenTextHashes.add(textHash)
      }
      
      if (isDuplicate) {
        duplicatesToRemove.push(content.id)
        console.log(`🔍 Duplicate found: ID ${content.id} - ${duplicateReason}`)
      } else {
        // Mark as seen
        seenHashes.add(correctHash)
        if (content.content_image_url) seenImageUrls.add(content.content_image_url)
        if (content.original_url) seenOriginalUrls.add(content.original_url)
      }
    }

    console.log(`📈 Found ${duplicatesToRemove.length} duplicates to remove`)
    console.log(`🔧 Found ${hashUpdates.length} hashes to update`)

    let removedCount = 0
    let updatedCount = 0
    const errors: string[] = []

    // Remove duplicates in batches
    const batchSize = 50
    for (let i = 0; i < duplicatesToRemove.length; i += batchSize) {
      const batch = duplicatesToRemove.slice(i, i + batchSize)
      const { error: deleteError } = await supabase
        .from('content_queue')
        .delete()
        .in('id', batch)

      if (deleteError) {
        errors.push(`Failed to delete batch ${i}-${i + batchSize}: ${deleteError.message}`)
      } else {
        removedCount += batch.length
        console.log(`✅ Removed duplicate batch: ${batch.length} items`)
      }
    }

    // Update content hashes in batches
    for (let i = 0; i < hashUpdates.length; i += batchSize) {
      const batch = hashUpdates.slice(i, i + batchSize)
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ content_hash: update.hash })
          .eq('id', update.id)

        if (updateError) {
          errors.push(`Failed to update hash for ID ${update.id}: ${updateError.message}`)
        } else {
          updatedCount++
        }
      }
    }

    // Update is_posted flags based on posted_content table
    const { error: syncError } = await supabase.rpc('sync_posted_flags', {})
    if (syncError) {
      console.warn('Warning: Could not sync is_posted flags:', syncError.message)
    }

    // Get final stats
    const { data: finalStats } = await supabase
      .from('content_queue')
      .select('id, is_posted, is_approved')

    const stats = {
      totalContent: finalStats?.length || 0,
      approved: finalStats?.filter(c => c.is_approved && !c.is_posted).length || 0,
      posted: finalStats?.filter(c => c.is_posted).length || 0,
      duplicatesRemoved: removedCount,
      hashesUpdated: updatedCount
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete: removed ${removedCount} duplicates, updated ${updatedCount} hashes`,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      details: {
        originalCount: allContent.length,
        duplicatesFound: duplicatesToRemove.length,
        duplicatesRemoved: removedCount,
        hashesUpdated: updatedCount,
        finalCount: stats.totalContent
      }
    })

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}