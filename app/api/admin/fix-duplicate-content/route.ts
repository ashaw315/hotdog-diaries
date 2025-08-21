import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🔧 Fix duplicate content triggered...')
  
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // 1. Find duplicate content based on content_hash or content_text
    const { data: allContent, error: selectError } = await supabase
      .from('content_queue')
      .select('id, content_text, content_hash, source_platform, original_url, is_posted, created_at')
      .order('created_at', { ascending: true })

    if (selectError) {
      throw new Error(`Failed to select content: ${selectError.message}`)
    }

    // 2. Group by content text/hash to find duplicates
    const contentGroups = new Map()
    
    for (const content of allContent || []) {
      const key = content.content_hash || content.content_text?.substring(0, 100)
      if (!key) continue
      
      if (!contentGroups.has(key)) {
        contentGroups.set(key, [])
      }
      contentGroups.get(key).push(content)
    }

    // 3. Find groups with duplicates
    const duplicateGroups = Array.from(contentGroups.entries())
      .filter(([key, items]) => items.length > 1)
      .map(([key, items]) => items)

    console.log(`🔍 Found ${duplicateGroups.length} groups with duplicates`)

    const fixedDuplicates = []
    const errors = []

    // 4. For each duplicate group, keep the earliest one posted, mark others appropriately
    for (const duplicates of duplicateGroups) {
      try {
        // Sort by: already posted first, then by creation date
        duplicates.sort((a, b) => {
          if (a.is_posted && !b.is_posted) return -1
          if (!a.is_posted && b.is_posted) return 1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })

        const [keeper, ...toRemove] = duplicates
        
        console.log(`📋 Duplicate group: keeping ID ${keeper.id}, removing ${toRemove.map(d => d.id).join(', ')}`)

        // Mark duplicates as rejected/duplicate
        for (const duplicate of toRemove) {
          const { error: updateError } = await supabase
            .from('content_queue')
            .update({
              is_approved: false,
              is_posted: false,
              is_rejected: true,
              confidence_score: 0.1,
              updated_at: new Date().toISOString()
            })
            .eq('id', duplicate.id)

          if (updateError) {
            errors.push(`Failed to mark duplicate ${duplicate.id}: ${updateError.message}`)
          } else {
            fixedDuplicates.push({
              kept: keeper.id,
              removed: duplicate.id,
              text: duplicate.content_text?.substring(0, 50) + '...'
            })
          }
        }
      } catch (groupError) {
        errors.push(`Group processing error: ${groupError instanceof Error ? groupError.message : 'Unknown'}`)
      }
    }

    // 5. Get updated stats
    const { data: updatedStats } = await supabase
      .from('content_queue')
      .select('id, is_approved, is_posted, is_rejected')

    const stats = {
      totalContent: updatedStats?.length || 0,
      approved: updatedStats?.filter(c => c.is_approved && !c.is_posted).length || 0,
      posted: updatedStats?.filter(c => c.is_posted).length || 0,
      rejected: updatedStats?.filter(c => c.is_rejected).length || 0,
      duplicatesFixed: fixedDuplicates.length
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedDuplicates.length} duplicate content items`,
      duplicateGroupsFound: duplicateGroups.length,
      fixedDuplicates,
      stats,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Error fixing duplicates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}