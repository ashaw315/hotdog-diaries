import { Pool, PoolClient, QueryResult } from 'pg'
import { sql } from '@vercel/postgres'
import { LogLevel } from '@/types'

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
  private isVercel: boolean = false

  constructor() {
    this.isVercel = !!process.env.POSTGRES_URL
  }

  private getConfig(): DatabaseConfig {
    if (this.isVercel) {
      return {
        host: process.env.POSTGRES_HOST!,
        port: 5432,
        database: process.env.POSTGRES_DATABASE!,
        user: process.env.POSTGRES_USER!,
        password: process.env.POSTGRES_PASSWORD!,
        ssl: true,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
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

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      console.log('Database connection closed')
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (this.isVercel) {
      return await sql.query(text, params || []) as QueryResult<T>
    }

    if (!this.pool) {
      await this.connect()
    }

    const start = Date.now()
    try {
      const result = await this.pool.query<T>(text, params)
      const duration = Date.now() - start
      console.log('Query executed', { text, duration, rows: result.rowCount })
      return result
    } catch (error) {
      const duration = Date.now() - start
      console.error('Query error', { text, duration, error })
      throw error
    }
  }

  async getClient(): Promise<PoolClient> {
    if (this.isVercel) {
      throw new Error('Client connections not supported in Vercel environment')
    }

    if (!this.pool) {
      throw new Error('Database not connected')
    }

    return await this.pool.connect()
  }

  async healthCheck(): Promise<{ connected: boolean; latency?: number; error?: string }> {
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
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO system_logs (log_level, message, component, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [level, message, component, metadata ? JSON.stringify(metadata) : null]
    )
  } catch (error) {
    console.error('Failed to log to database:', error)
  }
}

export { sql } from '@vercel/postgres'