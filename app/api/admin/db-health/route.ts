import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[DB HEALTH CHECK] Starting database health verification");
    
    // Detect database mode based on environment variables (matching lib/db.ts logic)
    const databaseUrl = process.env.DATABASE_URL;
    const hasSupabaseUrl = !!(databaseUrl?.includes("supabase.co"));
    const isProduction = process.env.NODE_ENV === "production";
    const isPreview = process.env.VERCEL_ENV === "preview";
    const isDevelopment = process.env.NODE_ENV === "development";
    
    let databaseMode: string;
    if (isProduction || hasSupabaseUrl) {
      databaseMode = hasSupabaseUrl ? "supabase" : "unknown";
    } else if (isPreview || isDevelopment) {
      databaseMode = hasSupabaseUrl ? "supabase" : "sqlite";
    } else {
      databaseMode = hasSupabaseUrl ? "supabase" : "postgres-pool";
    }
    
    // Environment info
    const hasPostgresUrl = !!(databaseUrl?.includes("postgres") && !hasSupabaseUrl);
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
      
      // Test core tables
      const tableTests: Record<string, any> = {};
      const coreTableNames = [
        'content_queue',
        'posted_content', 
        'admin_users',
        'system_logs',
        'system_alerts',
        'content_analysis',
        'queue_alerts',
        'platform_metrics',
        'api_usage_metrics'
      ];
      
      for (const tableName of coreTableNames) {
        try {
          const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
          tableTests[tableName] = {
            exists: true,
            row_count: parseInt(result.rows[0]?.count || "0")
          };
          console.log(`[DB HEALTH CHECK] ${tableName} table test passed`);
        } catch (error) {
          tableTests[tableName] = {
            exists: false,
            error: error instanceof Error ? error.message : "Unknown error"
          };
          console.log(`[DB HEALTH CHECK] ${tableName} table test failed:`, error);
        }
      }
      
      // Test column existence for critical tables
      const columnTests: Record<string, any> = {};
      
      if (databaseMode !== "sqlite") {
        // PostgreSQL/Supabase specific column checks
        const criticalColumns = [
          { table: 'posted_content', column: 'posted_at' },
          { table: 'posted_content', column: 'scheduled_time' },
          { table: 'posted_content', column: 'post_order' },
          { table: 'content_queue', column: 'content_status' },
          { table: 'content_analysis', column: 'confidence_score' }
        ];
        
        for (const { table, column } of criticalColumns) {
          try {
            const result = await db.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public'
            `, [table, column]);
            
            columnTests[`${table}.${column}`] = {
              exists: result.rows.length > 0
            };
          } catch (error) {
            columnTests[`${table}.${column}`] = {
              exists: false,
              error: error instanceof Error ? error.message : "Unknown error"
            };
          }
        }
      }
      
      // Calculate health status
      const totalTables = coreTableNames.length;
      const existingTables = Object.values(tableTests).filter((test: any) => test.exists).length;
      const healthPercentage = Math.round((existingTables / totalTables) * 100);
      
      const healthStatus = {
        overall: healthPercentage >= 90 ? 'healthy' : healthPercentage >= 70 ? 'warning' : 'critical',
        tables_total: totalTables,
        tables_existing: existingTables,
        health_percentage: healthPercentage,
        missing_tables: coreTableNames.filter(name => !tableTests[name]?.exists)
      };
      
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: envInfo,
        database: dbInfo,
        health_status: healthStatus,
        table_tests: tableTests,
        column_tests: columnTests,
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