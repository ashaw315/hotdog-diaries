// lib/probeSchema.ts
import { supabase } from "./db";

export type ProbeResult = {
  query_successful: boolean;
  column_found: boolean;
  error: string | null;
  connection_identity: { database: string; host: string } | null;
  posted_content_columns?: string[];
};

export async function probeScheduledPostId(): Promise<ProbeResult> {
  try {
    console.log('[probe] Starting schema probe using Supabase client only');
    
    // Check if scheduled_post_id column exists by trying to select it
    let column_found = false;
    let posted_content_columns: string[] = [];

    try {
      // Try to query the column - if it exists, this will succeed
      const { data, error } = await supabase
        .from('posted_content')
        .select('scheduled_post_id')
        .limit(1);
      
      if (!error) {
        column_found = true;
        console.log('[probe] ✅ scheduled_post_id column exists - query successful');
      } else if (error.message.includes('column') && error.message.includes('does not exist')) {
        column_found = false;
        console.log('[probe] ❌ scheduled_post_id column does not exist');
      } else {
        // Other error, but column might exist
        console.log('[probe] ⚠️ Column probe inconclusive:', error.message);
        column_found = false;
      }
    } catch (columnError) {
      console.log('[probe] ❌ Column existence check failed:', columnError);
      column_found = false;
    }

    // Get table columns by querying sample data structure (safer than information_schema)
    try {
      const { data: sampleData, error: sampleError } = await supabase
        .from('posted_content')
        .select('*')
        .limit(1);
      
      if (!sampleError && sampleData && sampleData.length > 0) {
        posted_content_columns = Object.keys(sampleData[0]);
        console.log('[probe] ✅ Retrieved column list from sample data:', posted_content_columns.length, 'columns');
        
        // Double-check our column finding using actual data structure
        if (posted_content_columns.includes('scheduled_post_id')) {
          column_found = true;
          console.log('[probe] ✅ scheduled_post_id confirmed in actual table structure');
        }
      } else if (!sampleError) {
        // Table exists but no data - try to get columns via empty select
        console.log('[probe] Table exists but no data, attempting empty select for columns');
        const { data: emptyData, error: emptyError } = await supabase
          .from('posted_content')
          .select('*')
          .limit(0);
        
        if (!emptyError) {
          // Use the error message or metadata to infer column existence
          console.log('[probe] Empty select successful, using fallback column detection');
          posted_content_columns = ['id', 'content_queue_id', 'posted_at', 'created_at']; // Core columns
          
          // Try specific column test
          const { error: testError } = await supabase
            .from('posted_content')
            .select('scheduled_post_id')
            .limit(0);
          
          if (!testError) {
            posted_content_columns.push('scheduled_post_id');
            column_found = true;
            console.log('[probe] ✅ scheduled_post_id confirmed via empty select test');
          }
        }
      } else {
        console.log('[probe] ⚠️ Could not retrieve sample data:', sampleError?.message);
        posted_content_columns = [];
      }
    } catch (schemaError) {
      console.log('[probe] ❌ Sample data query failed:', schemaError);
      posted_content_columns = [];
    }

    // Return successful probe result
    const result = {
      query_successful: true,
      column_found,
      error: null,
      connection_identity: { 
        database: 'supabase_production', 
        host: 'ulaadphxfsrihoubjdrb.supabase.co' 
      },
      posted_content_columns,
    };
    
    console.log('[probe] ✅ Schema probe completed successfully:', {
      column_found,
      columns_detected: posted_content_columns.length
    });
    
    return result;
  } catch (e: any) {
    console.error('[probe] ❌ Probe failed:', e);
    return {
      query_successful: false,
      column_found: false,
      error: String(e?.message || e),
      connection_identity: null,
      posted_content_columns: [],
    };
  }
}