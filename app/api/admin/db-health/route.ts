import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[DB HEALTH CHECK] Starting database health verification");
    
    // Detect database mode based on environment variables
    const hasSupabaseUrl = process.env.DATABASE_URL?.includes("supabase.co");
    const hasPostgresUrl = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes("postgres"));
    const databaseMode = hasSupabaseUrl ? "supabase" : hasPostgresUrl ? "postgres" : "sqlite";
    
    // Environment info
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_SET: Boolean(process.env.DATABASE_URL),
      POSTGRES_URL_SET: Boolean(process.env.POSTGRES_URL),
      DATABASE_URL_TYPE: hasSupabaseUrl ? "supabase" : hasPostgresUrl ? "postgres" : "unknown",
      DETECTED_MODE: databaseMode
    };
    
    console.log("[DB HEALTH CHECK] Environment:", envInfo);
    
    // Try database-specific queries
    let dbInfo: any = {};
    
    try {
      if (databaseMode === "sqlite") {
        // SQLite-specific queries
        const versionResult = await db.query("SELECT sqlite_version() as version");
        const dbResult = await db.query("PRAGMA database_list");
        
        dbInfo = {
          type: "SQLite",
          version: versionResult.rows[0]?.version,
          databases: dbResult.rows,
          test_query: "sqlite_version()"
        };
      } else {
        // PostgreSQL-specific queries (works for both Supabase and regular Postgres)
        const versionResult = await db.query("SELECT version() as version, current_database() as db_name");
        const schemaResult = await db.query(`
          SELECT COUNT(*) as table_count 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        dbInfo = {
          type: "PostgreSQL",
          version: versionResult.rows[0]?.version,
          database_name: versionResult.rows[0]?.db_name,
          public_tables: parseInt(schemaResult.rows[0]?.table_count || "0"),
          test_query: "version() + current_database()"
        };
      }
      
      console.log("[DB HEALTH CHECK] Database info retrieved:", dbInfo);
      
      // Test a simple content_queue query if the table exists
      let contentQueueTest: any = null;
      try {
        const contentTest = await db.query("SELECT COUNT(*) as count FROM content_queue LIMIT 1");
        contentQueueTest = {
          table_exists: true,
          row_count: parseInt(contentTest.rows[0]?.count || "0")
        };
        console.log("[DB HEALTH CHECK] content_queue table test passed");
      } catch (tableError) {
        contentQueueTest = {
          table_exists: false,
          error: tableError instanceof Error ? tableError.message : "Unknown table error"
        };
        console.log("[DB HEALTH CHECK] content_queue table test failed:", tableError);
      }
      
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: envInfo,
        database: dbInfo,
        content_queue_test: contentQueueTest,
        connection_verified: true
      });
      
    } catch (queryError) {
      console.error("[DB HEALTH CHECK] Database query failed:", queryError);
      
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        environment: envInfo,
        error: "Database query failed",
        details: queryError instanceof Error ? queryError.message : String(queryError),
        connection_verified: false
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error("[DB HEALTH CHECK] Health check failed:", error);
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      details: error instanceof Error ? error.message : String(error),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: Boolean(process.env.DATABASE_URL),
        POSTGRES_URL_SET: Boolean(process.env.POSTGRES_URL)
      }
    }, { status: 500 });
  }
}