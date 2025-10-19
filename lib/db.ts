import { Pool, PoolClient, QueryResult } from 'pg'
import { sql } from '@vercel/postgres'
import { LogLevel } from '@/types'
import path from 'path'
import { QueryResult as DbQueryResult, DatabaseHealthCheck } from '@/types/database'

// Conditional SQLite imports to avoid Vercel build issues
let Database: any = null
let sqlite3: any = null
let open: any = null

// Only import SQLite in environments that need it
const shouldUseSqlite = () => {
  const nodeEnv = process.env.NODE_ENV
  const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS)
  const hasSupabaseUrl = !!(process.env.DATABASE_URL?.includes('supabase.co'))
  const isProduction = nodeEnv === 'production'
  
  // Skip SQLite entirely in production unless CI
  if (isProduction && !isCI) return false
  
  // Use SQLite in development without Supabase URL
  if (nodeEnv === 'development' && !hasSupabaseUrl) return true
  
  // Use SQLite in CI without Supabase URL
  if (isCI && !hasSupabaseUrl) return true
  
  return false
}

// Lazy load SQLite dependencies only when needed
async function loadSqlite() {
  if (!Database && shouldUseSqlite()) {
    try {
      const sqliteModule = await import('sqlite')
      const sqlite3Module = await import('sqlite3')
      Database = sqliteModule.Database
      open = sqliteModule.open
      sqlite3 = sqlite3Module.default
    } catch (error) {
      console.warn('SQLite modules not available:', error)
    }
  }
}

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean | { rejectUnauthorized: boolean }
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

class DatabaseConnection {
  private pool: Pool | null = null
  private sqliteDb: any = null  // Using any since we're lazy loading the Database type
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
    const isPreview = process.env.VERCEL_ENV === 'preview'
    const isDevelopment = nodeEnv === 'development'
    const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS)
    
    // Check for Supabase connection string
    const hasSupabaseUrl = !!(databaseUrl?.includes('supabase.co'))
    
    console.log('🚀 [DB INIT] Starting database initialization...')
    console.log('[DB INIT] Environment detection:', {
      NODE_ENV: nodeEnv,
      VERCEL_ENV: process.env.VERCEL_ENV,
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      DATABASE_URL_SET: Boolean(databaseUrl),
      DATABASE_URL_TYPE: hasSupabaseUrl ? 'supabase' : databaseUrl ? 'postgres' : 'missing',
      isProduction,
      isPreview,
      isDevelopment,
      isCI
    })

    // CI ENVIRONMENT (GitHub Actions) - Check BEFORE production
    if (isCI) {
      if (hasSupabaseUrl) {
        this.isSupabase = true
        this.isSqlite = false
        this.connectionMode = 'supabase'
        console.log('✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (CI)')
        return
      } else {
        // CI fallback: Use SQLite for testing even with production NODE_ENV
        this.isSupabase = false
        this.isSqlite = true
        this.connectionMode = 'sqlite'
        console.log('✅ [DB INIT] Using SQLite (CI fallback - DATABASE_URL not available)')
        return
      }
    }

    // PREVIEW ENVIRONMENT (Vercel preview deploys) - Check BEFORE production
    if (isPreview) {
      if (hasSupabaseUrl) {
        this.isSupabase = true
        this.isSqlite = false
        this.connectionMode = 'supabase'
        console.log('✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (preview)')
        return
      } else {
        this.isSupabase = false
        this.isSqlite = true
        this.connectionMode = 'sqlite'
        console.log('✅ [DB INIT] Using SQLite (preview fallback)')
        return
      }
    }

    // STRICT PRODUCTION REQUIREMENTS (after CI and preview checks)
    if (isProduction) {
      if (!databaseUrl) {
        const errorMsg = '🚨 FATAL ERROR: DATABASE_URL not set in production — Supabase connection required.'
        console.error(errorMsg)
        console.error('[DB INIT] Production deployments must have DATABASE_URL configured to connect to Supabase.')
        console.error('[DB INIT] Set DATABASE_URL in your Vercel environment variables.')
        throw new Error('DATABASE_URL is required in production environment')
      }
      
      if (!hasSupabaseUrl) {
        const errorMsg = '🚨 FATAL ERROR: DATABASE_URL in production must be a Supabase connection string.'
        console.error(errorMsg)
        console.error('[DB INIT] Expected DATABASE_URL to contain "supabase.co"')
        console.error('[DB INIT] Current DATABASE_URL type:', databaseUrl.includes('postgres') ? 'postgres' : 'unknown')
        throw new Error('DATABASE_URL must be a Supabase connection string in production')
      }
      
      this.isSupabase = true
      this.isSqlite = false
      this.connectionMode = 'supabase'
      console.log('✅ [DB INIT] Using Supabase Postgres via DATABASE_URL')
      return
    }

    // DEVELOPMENT ENVIRONMENT
    if (isDevelopment) {
      if (hasSupabaseUrl) {
        this.isSupabase = true
        this.isSqlite = false
        this.connectionMode = 'supabase'
        console.log('✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (development)')
        return
      } else {
        this.isSupabase = false
        this.isSqlite = true
        this.connectionMode = 'sqlite'
        console.log('✅ [DB INIT] Using SQLite (development fallback)')
        return
      }
    }

    // FALLBACK FOR OTHER ENVIRONMENTS
    if (hasSupabaseUrl) {
      this.isSupabase = true
      this.isSqlite = false
      this.connectionMode = 'supabase'
      console.log('✅ [DB INIT] Using Supabase Postgres via DATABASE_URL (other environment)')
    } else {
      this.isSupabase = false
      this.isSqlite = false
      this.connectionMode = 'postgres-pool'
      console.log('✅ [DB INIT] Using PostgreSQL connection pool (other environment)')
    }
  }

  private getConfig(): DatabaseConfig {
    if (this.isSupabase) {
      // Parse Supabase DATABASE_URL for connection details
      const databaseUrl = process.env.DATABASE_URL!
      const url = new URL(databaseUrl)
      
      // Configure SSL for Supabase to handle self-signed certificates
      const sslConfig = { rejectUnauthorized: false }
      
      console.log('🔐 [DB CONFIG] Configuring Supabase SSL connection', {
        host: url.hostname,
        sslEnabled: true,
        sslConfig: 'rejectUnauthorized: false'
      })
      
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432'),
        database: url.pathname.slice(1), // Remove leading slash
        user: url.username,
        password: url.password,
        ssl: sslConfig, // Supabase SSL with relaxed certificate validation
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    }

    // Fallback configuration for development or other PostgreSQL connections
    console.log('🔗 [DB CONFIG] Configuring standard PostgreSQL connection', {
      host: process.env.DATABASE_HOST || 'localhost',
      sslEnabled: false
    })
    
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
      const sslStatus = this.isSupabase ? 'SSL enabled (rejectUnauthorized: false)' : 'SSL disabled'
      console.log(`Database connection established - ${sslStatus}`)
    })

    this.pool.on('remove', () => {
      console.log('Database connection removed')
    })

    try {
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      
      const connectionInfo = {
        mode: this.connectionMode,
        ssl: this.isSupabase ? 'enabled (rejectUnauthorized: false)' : 'disabled',
        host: config.host,
        port: config.port
      }
      console.log('✅ Database connection successful', connectionInfo)
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      console.error('Connection config (masked):', {
        host: config.host,
        port: config.port,
        database: config.database,
        ssl: this.isSupabase ? 'SSL configured' : 'No SSL',
        connectionMode: this.connectionMode
      })
      throw error
    }
  }

  private async connectSqlite(): Promise<void> {
    if (this.sqliteDb) {
      return
    }

    // Ensure SQLite modules are loaded
    await loadSqlite()
    
    if (!Database || !sqlite3) {
      throw new Error('SQLite modules not available')
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

    if (this.isSupabase) {
      // For Supabase, use the standard pool connection
      // Supabase is PostgreSQL compatible and works with the pg Pool
      // Fall through to the standard pool logic below
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
      const sqliteQuery = this.convertPostgresToSqlite(text)
      
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
    if (this.isSqlite) {
      throw new Error('Client connections not supported with SQLite')
    }

    if (!this.pool) {
      await this.connect()
    }

    return await this.pool!.connect()
  }

  getPoolStats(): { total: number; idle: number; active: number } {
    if (this.isSqlite || !this.pool) {
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
    if (this.isSqlite) {
      throw new Error('Transactions not supported with SQLite adapter')
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