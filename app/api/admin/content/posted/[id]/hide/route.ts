import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`🙈 Hide posted content ${params.id} triggered...`)
  
  try {
    // Auth check - allow both admin tokens and GitHub Actions token
    const authHeader = request.headers.get('authorization')
    
    // Check for GitHub Actions token
    const isGitHubActions = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    // Check for admin token (from localStorage) - could be a JWT or simple token
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const hasAdminToken = adminToken && (
      adminToken.length > 10 || // Basic token
      adminToken.includes('.') // JWT token
    )
    
    if (!isGitHubActions && !hasAdminToken) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Valid admin or GitHub Actions token required'
      }, { status: 401 })
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

    // Since is_hidden/hidden_at columns don't exist, use delete approach
    // Delete from posted_content table entirely (removes from public feed)
    const { error: deleteError } = await supabase
      .from('posted_content')
      .delete()
      .eq('id', postId)

    if (deleteError) {
      throw new Error(`Failed to remove posted content: ${deleteError.message}`)
    }

    // Reset the content_queue is_posted flag so it could potentially be posted again
    const { error: resetError } = await supabase
      .from('content_queue')
      .update({
        is_posted: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', postedContent.content_queue_id)

    if (resetError) {
      console.warn('Warning: Failed to reset is_posted flag:', resetError.message)
      // Don't fail the whole operation for this
    }

    return NextResponse.json({
      success: true,
      message: 'Posted content removed from public feed',
      action: 'deleted',
      postId,
      contentId: postedContent.content_queue_id,
      details: 'Content removed from posted_content table and marked as not posted in content_queue'
    })

  } catch (error) {
    console.error('❌ Error hiding posted content:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}