import { NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET() {
  console.log('🔧 Testing queue endpoint...')
  
  try {
    const supabase = createSimpleClient()
    console.log('✅ Supabase client created')
    
    // First, let's see what tables exist
    console.log('📋 Checking available tables...')
    
    // Try a simple query to content_queue first
    console.log('🔍 Testing content_queue table...')
    const { data: simpleData, error: simpleError } = await supabase
      .from('content_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (simpleError) {
      console.error('❌ Simple query error:', simpleError)
      return NextResponse.json({
        success: false,
        error: 'Simple query failed',
        details: {
          message: simpleError.message,
          details: simpleError.details,
          hint: simpleError.hint,
          code: simpleError.code
        }
      }, { status: 500 })
    }
    
    console.log('✅ Simple query worked! Found items:', simpleData?.length || 0)
    
    if (simpleData && simpleData.length > 0) {
      console.log('📊 Sample item structure:', Object.keys(simpleData[0]))
      console.log('📝 First item:', {
        id: simpleData[0].id,
        content_text: simpleData[0].content_text?.substring(0, 50),
        source_platform: simpleData[0].source_platform,
        content_status: simpleData[0].content_status
      })
    }
    
    // Now try the complex query with LEFT JOIN
    console.log('🔍 Testing complex query with content_analysis join...')
    const { data: complexData, error: complexError } = await supabase
      .from('content_queue')
      .select(`
        *,
        content_analysis!left (
          confidence_score,
          is_spam,
          is_inappropriate,
          is_unrelated,
          is_valid_hotdog
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (complexError) {
      console.error('❌ Complex query error:', complexError)
      console.log('⚠️ Complex query failed, but simple query worked')
      
      // Return simple data in the format expected by frontend
      return NextResponse.json({
        success: true,
        message: 'Using simple query (content_analysis table not available)',
        content: simpleData || [],
        pagination: {
          total: simpleData?.length || 0,
          limit: 50,
          offset: 0,
          hasMore: false
        },
        complexQueryError: {
          message: complexError.message,
          details: complexError.details,
          hint: complexError.hint
        }
      })
    }
    
    console.log('✅ Complex query worked! Found items:', complexData?.length || 0)
    
    return NextResponse.json({
      success: true,
      message: 'Both simple and complex queries worked',
      content: complexData || [],
      pagination: {
        total: complexData?.length || 0,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    })
    
  } catch (error) {
    console.error('❌ Critical error in test endpoint:', error)
    return NextResponse.json({
      success: false,
      error: 'Critical error',
      details: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : { error: String(error) }
    }, { status: 500 })
  }
}