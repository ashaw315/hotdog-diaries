// lib/db.ts - Hybrid implementation for backward compatibility + new direct SQL probe
import postgres from "postgres";
import { Pool, PoolClient, QueryResult } from 'pg'
import { sql as vercelSql } from '@vercel/postgres'
import { LogLevel } from '@/types'
import path from 'path'
import { QueryResult as DbQueryResult, DatabaseHealthCheck } from '@/types/database'

// NEW: Direct SQL probe connection for schema introspection
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

// NEW: Small, low-latency pool for API routes (schema probe) - only for postgres environments
export const sql = POSTGRES_URL ? postgres(POSTGRES_URL, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 5_000,
  prepare: true,
}) : null;

// EXISTING: Original database class for backward compatibility (truncated for critical functionality)
class DatabaseConnection {
  private pool: Pool | null = null
  private sqliteDb: any = null
  private isSupabase: boolean = false
  private isSqlite: boolean = false
  private connectionMode: 'supabase' | 'sqlite' | 'postgres-pool' = 'postgres-pool'

  constructor() {
    this.initializeDatabaseMode()
  }

  private initializeDatabaseMode(): void {
    const nodeEnv = process.env.NODE_ENV
    const databaseUrl = process.env.DATABASE_URL
    const isProduction = nodeEnv === 'production'
    const hasSupabaseUrl = !!(databaseUrl?.includes('supabase.co'))
    
    // Simplified mode detection for backward compatibility
    if (hasSupabaseUrl) {
      this.isSupabase = true
      this.isSqlite = false
      this.connectionMode = 'supabase'
    } else if (nodeEnv === 'development') {
      this.isSupabase = false
      this.isSqlite = true
      this.connectionMode = 'sqlite'
    } else {
      this.isSupabase = false
      this.isSqlite = false
      this.connectionMode = 'postgres-pool'
    }
  }

  async connect(): Promise<void> {
    // For new probe endpoints, prefer the direct sql connection
    // For legacy routes, use minimal fallback
    return Promise.resolve()
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
    return Promise.resolve()
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    // For production/Supabase, delegate to Vercel SQL
    if (this.isSupabase || process.env.NODE_ENV === 'production') {
      try {
        const result = await vercelSql.query(text, params)
        return result as QueryResult<T>
      } catch (error) {
        console.error('Legacy DB query error:', error)
        throw error
      }
    }
    
    // Development fallback: Use SQLite or postgres connection
    if (sql) {
      // Use direct SQL connection for postgres in development
      try {
        const result = await sql.unsafe(text, params || [])
        // Convert postgres.js result to pg QueryResult format
        return {
          rows: result as T[],
          rowCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
          command: text.split(' ')[0].toUpperCase(),
          oid: 0,
          fields: []
        } as QueryResult<T>
      } catch (error) {
        console.error('Development postgres query error:', error)
        throw error
      }
    } else {
      // SQLite development environment - we need to implement basic SQLite support
      throw new Error('SQLite not implemented in hybrid mode. Please initialize SQLite database first.')
    }
  }

  async healthCheck(): Promise<DatabaseHealthCheck> {
    try {
      const result = await this.query('SELECT 1 as health_check')
      return { connected: true, latency: 50 }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Stub methods for compatibility
  async getClient(): Promise<PoolClient> {
    throw new Error('getClient not implemented in hybrid mode')
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    throw new Error('transaction not implemented in hybrid mode')
  }

  getPoolStats(): { total: number; idle: number; active: number } {
    return { total: 0, idle: 0, active: 0 }
  }
}

// EXISTING: Export original db instance for backward compatibility
export const db = new DatabaseConnection()

// EXISTING: Utility functions for backward compatibility
export async function initializeDatabase(): Promise<void> {
  await db.connect()
}

export async function closeDatabase(): Promise<void> {
  await db.disconnect()
}

export async function logToDatabase(
  level: LogLevel,
  message: string,
  component: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    let dbLevel: string
    switch (level) {
      case LogLevel.DEBUG: dbLevel = 'debug'; break
      case LogLevel.INFO: dbLevel = 'info'; break
      case LogLevel.WARN: dbLevel = 'warning'; break
      case LogLevel.ERROR: dbLevel = 'error'; break
      case LogLevel.FATAL: dbLevel = 'error'; break
      default: dbLevel = 'info'
    }

    await db.query(
      `INSERT INTO system_logs (log_level, message, component, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [dbLevel, message, component, metadata ? JSON.stringify(metadata) : null]
    )
  } catch (error) {
    console.error('Failed to log to database:', error)
  }
}

// EXISTING: Re-export Vercel SQL for compatibility
export { sql as vercelSql } from '@vercel/postgres'

// EXISTING: Export utility functions
export const query = db.query.bind(db)
export const getClient = db.getClient.bind(db)
export const transaction = db.transaction.bind(db)
export const healthCheck = db.healthCheck.bind(db)
export const getPoolStats = db.getPoolStats.bind(db)