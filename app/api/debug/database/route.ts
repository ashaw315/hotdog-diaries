import { NextResponse } from 'next/server';

export async function GET() {
  const debug = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    databaseConfig: {
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasVercelUrl: !!process.env.VERCEL_URL,
      postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0
    },
    connectionTest: null,
    error: null
  };

  try {
    // Test database connection
    const { sql } = await import('@vercel/postgres');
    
    const result = await sql`SELECT 1 as test, NOW() as current_time`;
    
    debug.connectionTest = {
      success: true,
      testResult: result.rows[0],
      message: 'Database connection successful'
    };

    // Test content_queue table
    try {
      const contentCount = await sql`SELECT COUNT(*) as count FROM content_queue`;
      debug.connectionTest.contentCount = parseInt(contentCount.rows[0].count);
    } catch (tableError) {
      debug.connectionTest.tableError = tableError.message;
    }

  } catch (error) {
    debug.error = {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5) // First 5 lines only
    };
  }

  return NextResponse.json(debug);
}