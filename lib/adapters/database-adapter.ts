import { db } from '@/lib/db'

export interface DatabaseAdapter {
  isPostgreSQL: boolean
  isSQLite: boolean
  
  // Date functions
  now(): string
  dateFormat(field: string): string
  dateTrunc(unit: string, field: string): string
  dateAdd(field: string, interval: number, unit: string): string
  
  // Aggregation functions
  count(field?: string): string
  sum(field: string): string
  avg(field: string): string
  min(field: string): string
  max(field: string): string
  
  // JSON functions
  jsonExtract(field: string, path: string): string
  
  // Type conversions
  castToInteger(field: string): string
  castToReal(field: string): string
  
  // Limit/Offset
  limitOffset(limit: number, offset?: number): string
  
  // Conditional expressions
  caseWhen(condition: string, thenValue: string, elseValue: string): string
  
  // String functions
  concat(...fields: string[]): string
  substring(field: string, start: number, length?: number): string
}

class PostgreSQLAdapter implements DatabaseAdapter {
  isPostgreSQL = true
  isSQLite = false
  
  now(): string {
    return "NOW()"
  }
  
  dateFormat(field: string): string {
    return `TO_CHAR(${field}, 'YYYY-MM-DD')`
  }
  
  dateTrunc(unit: string, field: string): string {
    return `DATE_TRUNC('${unit}', ${field})`
  }
  
  dateAdd(field: string, interval: number, unit: string): string {
    return `${field} + INTERVAL '${interval} ${unit}'`
  }
  
  count(field = '*'): string {
    return `COUNT(${field})`
  }
  
  sum(field: string): string {
    return `SUM(${field})`
  }
  
  avg(field: string): string {
    return `AVG(${field})`
  }
  
  min(field: string): string {
    return `MIN(${field})`
  }
  
  max(field: string): string {
    return `MAX(${field})`
  }
  
  jsonExtract(field: string, path: string): string {
    return `${field}->>'${path}'`
  }
  
  castToInteger(field: string): string {
    return `${field}::INTEGER`
  }
  
  castToReal(field: string): string {
    return `${field}::REAL`
  }
  
  limitOffset(limit: number, offset = 0): string {
    return `LIMIT ${limit} OFFSET ${offset}`
  }
  
  caseWhen(condition: string, thenValue: string, elseValue: string): string {
    return `CASE WHEN ${condition} THEN ${thenValue} ELSE ${elseValue} END`
  }
  
  concat(...fields: string[]): string {
    return fields.join(' || ')
  }
  
  substring(field: string, start: number, length?: number): string {
    if (length !== undefined) {
      return `SUBSTRING(${field} FROM ${start} FOR ${length})`
    }
    return `SUBSTRING(${field} FROM ${start})`
  }
}

class SQLiteAdapter implements DatabaseAdapter {
  isPostgreSQL = false
  isSQLite = true
  
  now(): string {
    return "datetime('now')"
  }
  
  dateFormat(field: string): string {
    return `date(${field})`
  }
  
  dateTrunc(unit: string, field: string): string {
    switch (unit.toLowerCase()) {
      case 'hour':
        return `datetime(${field}, 'start of hour')`
      case 'day':
        return `date(${field})`
      case 'week':
        return `date(${field}, 'weekday 0', '-6 days')`
      case 'month':
        return `date(${field}, 'start of month')`
      case 'year':
        return `date(${field}, 'start of year')`
      default:
        return `date(${field})`
    }
  }
  
  dateAdd(field: string, interval: number, unit: string): string {
    return `datetime(${field}, '+${interval} ${unit}')`
  }
  
  count(field = '*'): string {
    return `COUNT(${field})`
  }
  
  sum(field: string): string {
    return `SUM(${field})`
  }
  
  avg(field: string): string {
    return `AVG(${field})`
  }
  
  min(field: string): string {
    return `MIN(${field})`
  }
  
  max(field: string): string {
    return `MAX(${field})`
  }
  
  jsonExtract(field: string, path: string): string {
    return `json_extract(${field}, '$.${path}')`
  }
  
  castToInteger(field: string): string {
    return `CAST(${field} AS INTEGER)`
  }
  
  castToReal(field: string): string {
    return `CAST(${field} AS REAL)`
  }
  
  limitOffset(limit: number, offset = 0): string {
    return `LIMIT ${limit} OFFSET ${offset}`
  }
  
  caseWhen(condition: string, thenValue: string, elseValue: string): string {
    return `CASE WHEN ${condition} THEN ${thenValue} ELSE ${elseValue} END`
  }
  
  concat(...fields: string[]): string {
    return fields.join(' || ')
  }
  
  substring(field: string, start: number, length?: number): string {
    if (length !== undefined) {
      return `substr(${field}, ${start}, ${length})`
    }
    return `substr(${field}, ${start})`
  }
}

// Database type detection
function detectDatabaseType(): DatabaseAdapter {
  const databaseUrl = process.env.DATABASE_URL
  const isVercel = !!process.env.POSTGRES_URL && process.env.NODE_ENV !== 'development'
  const usePostgres = process.env.USE_POSTGRES_IN_DEV === 'true'
  
  if (databaseUrl?.includes('postgres') || isVercel || usePostgres) {
    return new PostgreSQLAdapter()
  }
  
  return new SQLiteAdapter()
}

export const dbAdapter = detectDatabaseType()

// Helper function to execute database-agnostic queries
export async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await db.query(query, params)
    return result
  } catch (error) {
    console.error('Database query error:', error)
    console.error('Query:', query)
    console.error('Params:', params)
    throw error
  }
}