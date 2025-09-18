import { Pool, PoolClient, QueryResult } from 'pg'
import { sql } from '@vercel/postgres'
import { LogLevel } from '@/types'
import { Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { QueryResult as DbQueryResult, DatabaseHealthCheck } from '@/types/database'

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

class DatabaseConnection {
  private pool: Pool | null = null
  private sqliteDb: Database | null = null
  private isVercel: boolean = false
  private isSqlite: boolean = false

  constructor() {
    // Enhanced Vercel environment detection
    const hasVercelEnv = !!(process.env.VERCEL || process.env.VERCEL_ENV)
    const hasPostgresUrl = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres'))
    
    // Vercel deployment detection: Use Vercel Postgres in production or when Vercel env vars exist
    this.isVercel = (hasVercelEnv && hasPostgresUrl) || (process.env.NODE_ENV === 'production' && hasPostgresUrl)
    this.isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !hasPostgresUrl
    
    console.log(`🗄️ Database Mode: ${this.isVercel ? 'Vercel Postgres' : this.isSqlite ? 'SQLite' : 'PostgreSQL Pool'}`)
    
    // Debug environment variables in production
    if (process.env.NODE_ENV === 'production') {
      console.log('🔍 Production DB Config:', {
        hasVercelEnv,
        hasPostgresUrl,
        isVercel: this.isVercel,
        nodeEnv: process.env.NODE_ENV
      })
    }
  }

  private getConfig(): DatabaseConfig {
    if (this.isVercel) {
      // Vercel Postgres configuration - uses environment variables set by Vercel
      return {
        host: process.env.POSTGRES_HOST!,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE!,
        user: process.env.POSTGRES_USER!,
        password: process.env.POSTGRES_PASSWORD!,
        ssl: true,
        max: 10, // Vercel Postgres has connection limits
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000, // Increased timeout for Vercel
      }
    }

    return {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'hotdog_diaries_dev',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'password',
      ssl: false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  }

  async connect(): Promise<void> {
    if (this.isSqlite) {
      return this.connectSqlite()
    }

    if (this.pool) {
      return
    }

    const config = this.getConfig()
    this.pool = new Pool(config)

    this.pool.on('error', (err) => {
      console.error('Unexpected database error on idle client', err)
    })

    this.pool.on('connect', () => {
      console.log('Database connection established')
    })

    this.pool.on('remove', () => {
      console.log('Database connection removed')
    })

    try {
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      console.log('Database connection successful')
    } catch (error) {
      console.error('Database connection failed:', error)
      throw error
    }
  }

  private async connectSqlite(): Promise<void> {
    if (this.sqliteDb) {
      return
    }

    const dbPath = process.env.DATABASE_URL_SQLITE?.replace('sqlite:', '') || './hotdog_diaries_dev.db'
    const fullPath = path.resolve(dbPath)
    
    try {
      this.sqliteDb = await open({
        filename: fullPath,
        driver: sqlite3.Database
      })
      
      // Test connection
      await this.sqliteDb.get('SELECT 1')
      console.log(`SQLite database connected: ${fullPath}`)
    } catch (error) {
      console.error('SQLite connection failed:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.isSqlite && this.sqliteDb) {
      await this.sqliteDb.close()
      this.sqliteDb = null
      console.log('SQLite database closed')
    } else if (this.pool) {
      await this.pool.end()
      this.pool = null
      console.log('Database connection closed')
    }
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (this.isSqlite) {
      return this.querySqlite<T>(text, params)
    }

    if (this.isVercel) {
      try {
        const start = Date.now()
        const result = await sql.query(text, params || []) as QueryResult<T>
        const duration = Date.now() - start
        
        // Log slow queries in production
        if (duration > 1000) {
          console.warn(`Slow query detected: ${duration}ms`, { 
            query: text.substring(0, 100),
            duration 
          })
        }
        
        return result
      } catch (error: unknown) {
        const err = error as Error & { code?: string }
        console.error('Vercel Postgres query error:', {
          error: err.message,
          code: err.code,
          query: text.substring(0, 100)
        })
        throw error
      }
    }

    // Ensure connection before query
    if (!this.pool) {
      try {
        await this.connect()
      } catch (error) {
        console.error('Failed to establish database connection:', error)
        throw new Error('Database connection unavailable')
      }
    }

    const start = Date.now()
    let retries = 3
    
    while (retries > 0) {
      try {
        const result = await this.pool!.query<T>(text, params)
        const duration = Date.now() - start
        
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Query executed', { text: text.substring(0, 100), duration, rows: result.rowCount })
        }
        
        return result
      } catch (error: unknown) {
        const err = error as Error & { code?: string }
        const duration = Date.now() - start
        retries--
        
        // If it's a connection error and we have retries left, try to reconnect
        if ((err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') && retries > 0) {
          console.warn(`Database connection error, retrying... (${retries} attempts left)`)
          this.pool = null
          await this.connect()
          continue
        }
        
        console.error('Query error', { 
          text: text.substring(0, 100), 
          duration, 
          error: err.message,
          code: err.code
        })
        throw error
      }
    }
    
    throw new Error('Database query failed after all retries')
  }

  private async querySqlite<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.sqliteDb) {
      await this.connect()
    }

    const start = Date.now()
    
    try {
      // Convert PostgreSQL syntax to SQLite
      let sqliteQuery = this.convertPostgresToSqlite(text)
      
      // Handle different query types
      if (sqliteQuery.trim().toUpperCase().startsWith('SELECT') || sqliteQuery.trim().toUpperCase().startsWith('WITH')) {
        const rows = await this.sqliteDb!.all(sqliteQuery, params || [])
        const duration = Date.now() - start
        
        if (process.env.NODE_ENV === 'development') {
          console.log('SQLite Query executed', { text: sqliteQuery.substring(0, 100), duration, rows: rows.length })
        }
        
        return {
          rows: rows as T[],
          rowCount: rows.length,
          command: 'SELECT',
          oid: 0,
          fields: []
        } as QueryResult<T>
      } else {
        // INSERT, UPDATE, DELETE
        const result = await this.sqliteDb!.run(sqliteQuery, params || [])
        const duration = Date.now() - start
        
        if (process.env.NODE_ENV === 'development') {
          console.log('SQLite Query executed', { text: sqliteQuery.substring(0, 100), duration, changes: result.changes })
        }
        
        // For RETURNING queries, we need to fetch the inserted/updated data
        let returnedRows: T[] = []
        if (text.toUpperCase().includes('RETURNING') && (result.lastID || result.changes > 0)) {
          const returnMatch = text.match(/RETURNING\s+(.+?)(?:$|;)/i)
          if (returnMatch) {
            const tableName = this.extractTableName(text)
            let selectQuery: string
            
            if (result.lastID) {
              // For INSERT operations
              selectQuery = `SELECT ${returnMatch[1]} FROM ${tableName} WHERE id = ${result.lastID}`
            } else if (text.toUpperCase().includes('UPDATE') && result.changes > 0) {
              // For UPDATE operations - this is trickier, but we can try to extract the WHERE clause
              const whereMatch = text.match(/WHERE\s+(.+?)(?:RETURNING|$)/i)
              if (whereMatch) {
                selectQuery = `SELECT ${returnMatch[1]} FROM ${tableName} WHERE ${whereMatch[1]}`
              } else {
                // Fallback: just return the first row (not ideal but better than nothing)
                selectQuery = `SELECT ${returnMatch[1]} FROM ${tableName} LIMIT 1`
              }
            }
            
            if (selectQuery) {
              try {
                returnedRows = await this.sqliteDb!.all(selectQuery) as T[]
              } catch (error) {
                console.warn('Failed to fetch RETURNING data:', error)
                // Return at least something to indicate success
                returnedRows = [{ id: result.lastID } as T]
              }
            }
          }
        }
        
        // If we don't have returning data but have successful changes, provide minimal response
        if (returnedRows.length === 0 && (result.lastID || result.changes > 0)) {
          returnedRows = [{ id: result.lastID || 1 } as T]
        }
        
        return {
          rows: returnedRows,
          rowCount: result.changes || 0,
          command: this.extractCommand(text),
          oid: 0,
          fields: []
        } as QueryResult<T>
      }
    } catch (error: unknown) {
      const err = error as Error
      const duration = Date.now() - start
      console.error('SQLite Query error', { 
        text: text.substring(0, 100), 
        duration, 
        error: err.message
      })
      throw error
    }
  }

  private convertPostgresToSqlite(query: string): string {
    let converted = query
    
    // Convert PostgreSQL-specific syntax to SQLite
    converted = converted.replace(/NOW\(\)/g, "datetime('now')")
    converted = converted.replace(/SERIAL/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    converted = converted.replace(/TIMESTAMP WITH TIME ZONE/g, 'DATETIME')
    converted = converted.replace(/TIMESTAMP/g, 'DATETIME')
    converted = converted.replace(/JSONB/g, 'TEXT')
    converted = converted.replace(/TEXT\[\]/g, 'TEXT')
    converted = converted.replace(/INTEGER\[\]/g, 'TEXT')
    
    // Convert PostgreSQL-specific functions
    converted = converted.replace(/current_database\(\)/g, "'sqlite'")
    converted = converted.replace(/current_user/g, "'sqlite_user'")
    
    // Remove PostgreSQL-specific clauses that SQLite doesn't support
    converted = converted.replace(/ON CONFLICT.*?DO UPDATE SET.*?(?=WHERE|$|;)/gi, '')
    
    // Convert RETURNING clauses (SQLite doesn't support them directly)
    if (converted.includes('RETURNING')) {
      converted = converted.replace(/\s+RETURNING.*?(?=;|$)/gi, '')
    }
    
    return converted
  }

  private extractTableName(query: string): string {
    const match = query.match(/(?:INSERT INTO|UPDATE|FROM)\s+(\w+)/i)
    return match ? match[1] : 'unknown'
  }

  private extractCommand(query: string): string {
    const command = query.trim().split(' ')[0].toUpperCase()
    return command
  }

  async getClient(): Promise<PoolClient> {
    if (this.isVercel) {
      throw new Error('Client connections not supported in Vercel environment')
    }

    if (!this.pool) {
      await this.connect()
    }

    return await this.pool!.connect()
  }

  getPoolStats(): { total: number; idle: number; active: number } {
    if (this.isVercel || !this.pool) {
      return { total: 0, idle: 0, active: 0 }
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount
    }
  }

  async healthCheck(): Promise<DatabaseHealthCheck> {
    try {
      const start = Date.now()
      await this.query('SELECT 1 as health_check')
      const latency = Date.now() - start
      return { connected: true, latency }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.isVercel) {
      throw new Error('Transactions not supported in Vercel environment with @vercel/postgres')
    }

    const client = await this.getClient()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

export const db = new DatabaseConnection()

export async function initializeDatabase(): Promise<void> {
  try {
    await db.connect()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await db.disconnect()
    console.log('Database closed successfully')
  } catch (error) {
    console.error('Failed to close database:', error)
    throw error
  }
}

export async function logToDatabase(
  level: LogLevel,
  message: string,
  component: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Convert LogLevel enum to database-compatible string
    let dbLevel: string
    switch (level) {
      case LogLevel.DEBUG:
        dbLevel = 'debug'
        break
      case LogLevel.INFO:
        dbLevel = 'info'
        break
      case LogLevel.WARN:
        dbLevel = 'warning'
        break
      case LogLevel.ERROR:
        dbLevel = 'error'
        break
      case LogLevel.FATAL:
        dbLevel = 'error' // Map FATAL to error since it's not in constraint
        break
      default:
        dbLevel = 'info'
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

export { sql } from '@vercel/postgres'

// Export query function for direct imports
export const query = db.query.bind(db)

// Export additional utility functions
export const getClient = db.getClient.bind(db)
export const transaction = db.transaction.bind(db)
export const healthCheck = db.healthCheck.bind(db)
export const getPoolStats = db.getPoolStats.bind(db)