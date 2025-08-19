import { NextResponse } from 'next/server';
import { createSimpleClient } from '@/utils/supabase/server';

export async function GET() {
  const supabase = createSimpleClient();
  
  try {
    // Test 1: Basic connection
    console.log('Testing Supabase connection...');
    
    // Test 2: Check if content_queue table exists
    const { data: tables, error: tablesError } = await supabase
      .from('content_queue')
      .select('count', { count: 'exact', head: true });
    
    if (tablesError) {
      return NextResponse.json({
        success: false,
        error: 'content_queue table not found',
        details: tablesError.message,
        solution: 'Run database migration to create tables'
      }, { status: 500 });
    }

    // Test 3: Insert a test post
    const testPost = {
      content_text: 'Test hotdog post from API',
      content_type: 'text',
      source_platform: 'test',
      original_url: 'https://test.com',
      original_author: 'test-user',
      content_hash: `test_${Date.now()}`,
      confidence_score: 0.9,
      is_approved: true,
      is_rejected: false,
      scraped_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insertError } = await supabase
      .from('content_queue')
      .insert(testPost)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to insert test post',
        details: insertError.message
      }, { status: 500 });
    }

    // Test 4: Retrieve the test post
    const { data: retrieved, error: retrieveError } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', inserted.id)
      .single();

    if (retrieveError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve test post',
        details: retrieveError.message
      }, { status: 500 });
    }

    // Test 5: Clean up the test post
    await supabase
      .from('content_queue')
      .delete()
      .eq('id', inserted.id);

    return NextResponse.json({
      success: true,
      message: 'Database connection working perfectly!',
      tests: {
        connection: '✅ Connected to Supabase',
        tableExists: '✅ content_queue table exists',
        insert: '✅ Can insert posts',
        retrieve: '✅ Can retrieve posts',
        cleanup: '✅ Can delete posts'
      },
      insertedPost: {
        id: inserted.id,
        content_text: retrieved.content_text,
        created_at: retrieved.created_at
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error.message,
      environmentCheck: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
        keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
      }
    }, { status: 500 });
  }
}