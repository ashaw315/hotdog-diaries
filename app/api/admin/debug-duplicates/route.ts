import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // Get the specific content IDs we know are duplicates
    const { data: suspectedDuplicates, error: selectError } = await supabase
      .from('content_queue')
      .select('id, content_text, content_hash, source_platform, original_url, is_posted, created_at, original_author')
      .in('id', [104, 151])
      .order('id')

    if (selectError) {
      throw new Error(`Failed to select content: ${selectError.message}`)
    }

    // Get all posted content to see the pattern
    const { data: allPosted } = await supabase
      .from('posted_content')
      .select(`
        id, content_queue_id, posted_at,
        content_queue (id, content_text, content_hash, source_platform, original_author)
      `)
      .order('posted_at', { ascending: false })

    // Look for content with similar text patterns
    const { data: allContent } = await supabase
      .from('content_queue')
      .select('id, content_text, content_hash, source_platform, original_url, is_posted, original_author')
      .ilike('content_text', '%Chicago style hot dog%')

    return NextResponse.json({
      success: true,
      suspectedDuplicates: suspectedDuplicates || [],
      chicagoHotDogContent: allContent || [],
      postedContentDetails: allPosted || [],
      analysis: {
        totalContentChecked: allContent?.length || 0,
        suspectedDuplicatesFound: suspectedDuplicates?.length || 0,
        postedItemsTotal: allPosted?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Error debugging duplicates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}