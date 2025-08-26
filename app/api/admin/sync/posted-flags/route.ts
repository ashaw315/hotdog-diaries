import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = createSimpleClient()
    
    console.log('🔄 Starting is_posted flags synchronization...')
    
    // Get all posted content IDs
    const { data: postedContent, error: postedError } = await supabase
      .from('posted_content')
      .select('content_queue_id')
    
    if (postedError) {
      throw new Error(`Failed to fetch posted content: ${postedError.message}`)
    }
    
    const postedIds = postedContent?.map(p => p.content_queue_id) || []
    
    console.log(`Found ${postedIds.length} posted items`)
    
    // Update all content to set correct is_posted flag
    // First, set all to false
    const { error: resetError } = await supabase
      .from('content_queue')
      .update({ is_posted: false })
      .not('id', 'in', `(${postedIds.length > 0 ? postedIds.join(',') : '0'})`)
    
    if (resetError) {
      console.warn('Warning: Could not reset is_posted flags:', resetError.message)
    }
    
    // Then set posted items to true
    if (postedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({ is_posted: true })
        .in('id', postedIds)
      
      if (updateError) {
        throw new Error(`Failed to update posted flags: ${updateError.message}`)
      }
    }
    
    // Verify the sync
    const { data: verifyData } = await supabase
      .from('content_queue')
      .select('id, is_posted')
    
    const correctlyPosted = verifyData?.filter(c => 
      c.is_posted === postedIds.includes(c.id)
    ).length || 0
    
    const incorrectlyFlagged = (verifyData?.length || 0) - correctlyPosted
    
    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      stats: {
        total_content: verifyData?.length || 0,
        posted_items: postedIds.length,
        correctly_flagged: correctlyPosted,
        fixed: incorrectlyFlagged
      }
    })
    
  } catch (error) {
    console.error('❌ Sync failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}