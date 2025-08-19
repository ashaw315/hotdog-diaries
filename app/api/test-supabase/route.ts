import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    console.log('🔗 Testing Supabase connection...');
    
    const supabase = await createClient();
    
    // Test basic connection
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        message: 'Supabase connection failed'
      });
    }
    
    console.log('✅ Supabase connection successful');
    
    // Try to create the admin_users table if it doesn't exist
    const createTableResult = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          full_name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
    
    // Try a simpler approach - check if we can access any tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    return NextResponse.json({
      success: true,
      message: 'Supabase connection working!',
      tablesFound: tables ? tables.length : 0,
      tables: tables?.slice(0, 5) || [], // Show first 5 tables
      connectionTest: 'SUCCESS'
    });
    
  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Supabase test failed'
    }, { status: 500 });
  }
}