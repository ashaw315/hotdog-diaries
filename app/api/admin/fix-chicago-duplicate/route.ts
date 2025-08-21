import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🔧 Fixing specific Chicago hot dog duplicate...')
  
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // Specifically fix the known duplicate: ID 151 is a duplicate of ID 104
    // Content ID 104 was posted first (2025-08-20), ID 151 posted second (2025-08-21)
    // We should mark ID 151 as rejected/duplicate
    
    console.log('🎯 Marking content ID 151 as duplicate of ID 104...')
    
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        is_approved: false,
        is_rejected: true,
        confidence_score: 0.1,
        updated_at: new Date().toISOString()
      })
      .eq('id', 151)

    if (updateError) {
      throw new Error(`Failed to mark duplicate: ${updateError.message}`)
    }

    // Verify the fix worked
    const { data: verification } = await supabase
      .from('content_queue')
      .select('id, content_text, is_approved, is_rejected, is_posted')
      .in('id', [104, 151])

    return NextResponse.json({
      success: true,
      message: 'Fixed Chicago hot dog duplicate - marked ID 151 as rejected',
      action: 'Marked content ID 151 as duplicate/rejected',
      verification: verification || [],
      details: {
        kept: 'Content ID 104 (posted 2025-08-20)',
        rejected: 'Content ID 151 (posted 2025-08-21)',
        reason: 'Identical content text from same Reddit post'
      }
    })

  } catch (error) {
    console.error('❌ Error fixing Chicago duplicate:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}