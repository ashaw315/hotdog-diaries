import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`🙈 Hide posted content ${params.id} triggered...`)
  
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const postId = parseInt(params.id)
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })
    }

    const supabase = createSimpleClient()
    
    // Add is_hidden column to posted_content if it doesn't exist
    // (This will be handled by migration, but we'll add it here for safety)
    
    // Get the posted content first to verify it exists
    const { data: postedContent, error: fetchError } = await supabase
      .from('posted_content')
      .select(`
        id, content_queue_id, posted_at,
        content_queue (id, content_text, source_platform, original_author)
      `)
      .eq('id', postId)
      .single()

    if (fetchError || !postedContent) {
      return NextResponse.json({ 
        error: 'Posted content not found',
        details: fetchError?.message 
      }, { status: 404 })
    }

    // First try to add the column if it doesn't exist (safe operation)
    try {
      await supabase.rpc('add_column_if_not_exists', {
        table_name: 'posted_content',
        column_name: 'is_hidden',
        column_type: 'BOOLEAN DEFAULT FALSE'
      })
    } catch (columnError) {
      // Ignore if function doesn't exist or column already exists
      console.log('Column addition skipped (likely already exists)')
    }

    // Mark the posted content as hidden
    const { error: hideError } = await supabase
      .from('posted_content')
      .update({
        is_hidden: true,
        hidden_at: new Date().toISOString(),
        hidden_reason: 'Admin removed - duplicate content'
      })
      .eq('id', postId)

    if (hideError) {
      console.error('Hide error:', hideError)
      
      // If is_hidden column doesn't exist, try alternative approach
      if (hideError.message?.includes('column "is_hidden" does not exist')) {
        // Delete from posted_content table entirely (soft delete alternative)
        const { error: deleteError } = await supabase
          .from('posted_content')
          .delete()
          .eq('id', postId)

        if (deleteError) {
          throw new Error(`Failed to remove posted content: ${deleteError.message}`)
        }

        // Reset the content_queue is_posted flag so it could potentially be posted again
        await supabase
          .from('content_queue')
          .update({
            is_posted: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', postedContent.content_queue_id)

        return NextResponse.json({
          success: true,
          message: 'Posted content removed from feed',
          action: 'deleted',
          postId,
          contentId: postedContent.content_queue_id,
          details: 'Content removed from posted_content table and can be posted again'
        })
      }
      
      throw new Error(`Failed to hide posted content: ${hideError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Posted content hidden from public feed',
      action: 'hidden',
      postId,
      contentId: postedContent.content_queue_id,
      details: 'Content marked as hidden but preserved in database'
    })

  } catch (error) {
    console.error('❌ Error hiding posted content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}