// lib/probeSchema.ts
import { db } from "./db";

export type ProbeResult = {
  query_successful: boolean;
  column_found: boolean;
  error: string | null;
  connection_identity: { database: string; host: string } | null;
  posted_content_columns?: string[];
};

export async function probeScheduledPostId(): Promise<ProbeResult> {
  try {
    // Use hybrid db.query() instead of direct sql connection to avoid auth issues
    
    // Robust pg_catalog check (ignores dropped columns, etc.)
    const columnExistsResult = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c      ON a.attrelid = c.oid
        JOIN pg_namespace n  ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'posted_content'
          AND a.attname = 'scheduled_post_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) AS column_exists
    `);
    
    const column_exists = columnExistsResult.rows[0]?.column_exists;

    // Get all columns in posted_content table
    const colsResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='posted_content'
      ORDER BY ordinal_position
    `);

    // Get connection identity
    const identResult = await db.query(`
      SELECT current_database() AS database,
             inet_server_addr()::text AS host
    `);

    return {
      query_successful: true,
      column_found: !!column_exists,
      error: null,
      connection_identity: identResult.rows[0] || null,
      posted_content_columns: colsResult.rows.map(r => r.column_name),
    };
  } catch (e: any) {
    return {
      query_successful: false,
      column_found: false,
      error: String(e?.message || e),
      connection_identity: null,
    };
  }
}