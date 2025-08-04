import { QueryResult, QueryResultRow } from 'pg'
import { db } from './db'

export interface WhereCondition {
  field: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL'
  value?: any
  values?: any[]
}

export interface OrderBy {
  field: string
  direction: 'ASC' | 'DESC'
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: string
}

export class QueryBuilder {
  private selectFields: string[] = ['*']
  private fromTable: string = ''
  private whereConditions: WhereCondition[] = []
  private orderByFields: OrderBy[] = []
  private joinClauses: JoinClause[] = []
  private limitCount?: number
  private offsetCount?: number
  private parameters: any[] = []

  static table(tableName: string): QueryBuilder {
    const builder = new QueryBuilder()
    builder.fromTable = tableName
    return builder
  }

  select(fields: string | string[]): QueryBuilder {
    if (typeof fields === 'string') {
      this.selectFields = [fields]
    } else {
      this.selectFields = fields
    }
    return this
  }

  where(field: string, operator: WhereCondition['operator'], value?: any): QueryBuilder {
    this.whereConditions.push({ field, operator, value })
    return this
  }

  whereIn(field: string, values: any[]): QueryBuilder {
    this.whereConditions.push({ field, operator: 'IN', values })
    return this
  }

  whereNotIn(field: string, values: any[]): QueryBuilder {
    this.whereConditions.push({ field, operator: 'NOT IN', values })
    return this
  }

  whereNull(field: string): QueryBuilder {
    this.whereConditions.push({ field, operator: 'IS NULL' })
    return this
  }

  whereNotNull(field: string): QueryBuilder {
    this.whereConditions.push({ field, operator: 'IS NOT NULL' })
    return this
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.orderByFields.push({ field, direction })
    return this
  }

  join(table: string, on: string, type: JoinClause['type'] = 'INNER'): QueryBuilder {
    this.joinClauses.push({ type, table, on })
    return this
  }

  leftJoin(table: string, on: string): QueryBuilder {
    return this.join(table, on, 'LEFT')
  }

  limit(count: number): QueryBuilder {
    this.limitCount = count
    return this
  }

  offset(count: number): QueryBuilder {
    this.offsetCount = count
    return this
  }

  build(): { query: string; params: any[] } {
    this.parameters = []
    let paramIndex = 1

    // Build SELECT clause
    const selectClause = `SELECT ${this.selectFields.join(', ')}`
    
    // Build FROM clause
    let fromClause = `FROM ${this.fromTable}`
    
    // Build JOIN clauses
    if (this.joinClauses.length > 0) {
      fromClause += ' ' + this.joinClauses.map(join => 
        `${join.type} JOIN ${join.table} ON ${join.on}`
      ).join(' ')
    }

    // Build WHERE clause
    let whereClause = ''
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map(condition => {
        switch (condition.operator) {
          case 'IS NULL':
          case 'IS NOT NULL':
            return `${condition.field} ${condition.operator}`
          
          case 'IN':
          case 'NOT IN':
            if (!condition.values || condition.values.length === 0) {
              throw new Error(`${condition.operator} requires non-empty values array`)
            }
            const placeholders = condition.values.map(() => `$${paramIndex++}`).join(', ')
            this.parameters.push(...condition.values)
            return `${condition.field} ${condition.operator} (${placeholders})`
          
          default:
            this.parameters.push(condition.value)
            return `${condition.field} ${condition.operator} $${paramIndex++}`
        }
      })
      whereClause = `WHERE ${conditions.join(' AND ')}`
    }

    // Build ORDER BY clause
    let orderByClause = ''
    if (this.orderByFields.length > 0) {
      const orderFields = this.orderByFields.map(order => 
        `${order.field} ${order.direction}`
      ).join(', ')
      orderByClause = `ORDER BY ${orderFields}`
    }

    // Build LIMIT clause
    let limitClause = ''
    if (this.limitCount !== undefined) {
      limitClause = `LIMIT $${paramIndex++}`
      this.parameters.push(this.limitCount)
    }

    // Build OFFSET clause
    let offsetClause = ''
    if (this.offsetCount !== undefined) {
      offsetClause = `OFFSET $${paramIndex++}`
      this.parameters.push(this.offsetCount)
    }

    // Combine all clauses
    const query = [
      selectClause,
      fromClause,
      whereClause,
      orderByClause,
      limitClause,
      offsetClause
    ].filter(Boolean).join(' ')

    return { query, params: this.parameters }
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { query, params } = this.build()
    return await db.query<T>(query, params)
  }

  async first<T extends QueryResultRow = any>(): Promise<T | null> {
    const result = await this.limit(1).execute<T>()
    return result.rows[0] || null
  }

  async count(): Promise<number> {
    const originalSelect = this.selectFields
    this.selectFields = ['COUNT(*) as count']
    
    const result = await this.execute<{ count: string }>()
    this.selectFields = originalSelect
    
    return parseInt(result.rows[0]?.count || '0')
  }

  /**
   * Perform an upsert operation (insert or update if exists)
   */
  async upsert(data: Record<string, any>, conflictTarget?: string): Promise<any> {
    // Use the InsertBuilder with conflict handling
    const insertBuilder = InsertBuilder.into(this.fromTable)
      .values(data)
    
    if (conflictTarget) {
      // For now, do an update on conflict
      insertBuilder.onConflictDoUpdate(conflictTarget, data)
    } else {
      // Try to determine primary key or use 'id' as default
      insertBuilder.onConflictDoUpdate('id', data)
    }
    
    return await insertBuilder.execute()
  }
}

export class InsertBuilder {
  private tableName: string = ''
  private insertData: Record<string, any>[] = []
  private returnFields: string[] = ['*']
  private conflictAction?: 'DO NOTHING' | 'DO UPDATE'
  private conflictTarget?: string
  private updateData?: Record<string, any>

  static into(tableName: string): InsertBuilder {
    const builder = new InsertBuilder()
    builder.tableName = tableName
    return builder
  }

  values(data: Record<string, any> | Record<string, any>[]): InsertBuilder {
    if (Array.isArray(data)) {
      this.insertData = data
    } else {
      this.insertData = [data]
    }
    return this
  }

  returning(fields: string | string[]): InsertBuilder {
    if (typeof fields === 'string') {
      this.returnFields = [fields]
    } else {
      this.returnFields = fields
    }
    return this
  }

  onConflict(target: string, action: 'DO NOTHING' | 'DO UPDATE', updateData?: Record<string, any>): InsertBuilder {
    this.conflictTarget = target
    this.conflictAction = action
    this.updateData = updateData
    return this
  }

  onConflictDoNothing(target: string): InsertBuilder {
    return this.onConflict(target, 'DO NOTHING')
  }

  onConflictDoUpdate(target: string, updateData: Record<string, any>): InsertBuilder {
    return this.onConflict(target, 'DO UPDATE', updateData)
  }

  build(): { query: string; params: any[] } {
    if (this.insertData.length === 0) {
      throw new Error('No data provided for INSERT operation')
    }

    // Get field names from the first record
    const fields = Object.keys(this.insertData[0])
    const allValues: any[] = []
    
    // Build placeholders and collect all values
    const valueRows: string[] = []
    let paramIndex = 1
    
    for (const record of this.insertData) {
      const rowPlaceholders: string[] = []
      for (const field of fields) {
        rowPlaceholders.push(`$${paramIndex}`)
        allValues.push(record[field])
        paramIndex++
      }
      valueRows.push(`(${rowPlaceholders.join(', ')})`)
    }

    let query = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES ${valueRows.join(', ')}`

    // Add conflict handling
    if (this.conflictTarget && this.conflictAction) {
      query += ` ON CONFLICT (${this.conflictTarget}) ${this.conflictAction}`
      
      if (this.conflictAction === 'DO UPDATE' && this.updateData) {
        const updateFields = Object.keys(this.updateData)
        const updateClause = updateFields.map(field => `${field} = EXCLUDED.${field}`).join(', ')
        query += ` SET ${updateClause}`
      }
    }

    // Add RETURNING clause
    if (this.returnFields.length > 0) {
      query += ` RETURNING ${this.returnFields.join(', ')}`
    }

    return { query, params: allValues }
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { query, params } = this.build()
    return await db.query<T>(query, params)
  }

  async first<T extends QueryResultRow = any>(): Promise<T | null> {
    const result = await this.execute<T>()
    return result.rows[0] || null
  }
}

export class UpdateBuilder {
  private tableName: string = ''
  private updateData: Record<string, any> = {}
  private whereConditions: WhereCondition[] = []
  private returnFields: string[] = ['*']
  private parameters: any[] = []

  static table(tableName: string): UpdateBuilder {
    const builder = new UpdateBuilder()
    builder.tableName = tableName
    return builder
  }

  set(data: Record<string, any>): UpdateBuilder {
    this.updateData = { ...this.updateData, ...data }
    return this
  }

  where(field: string, operator: WhereCondition['operator'], value?: any): UpdateBuilder {
    this.whereConditions.push({ field, operator, value })
    return this
  }

  returning(fields: string | string[]): UpdateBuilder {
    if (typeof fields === 'string') {
      this.returnFields = [fields]
    } else {
      this.returnFields = fields
    }
    return this
  }

  build(): { query: string; params: any[] } {
    this.parameters = []
    let paramIndex = 1

    // Build SET clause
    const updateFields = Object.keys(this.updateData)
    const setClause = updateFields.map(field => {
      this.parameters.push(this.updateData[field])
      return `${field} = $${paramIndex++}`
    }).join(', ')

    let query = `UPDATE ${this.tableName} SET ${setClause}`

    // Build WHERE clause
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map(condition => {
        if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
          return `${condition.field} ${condition.operator}`
        }
        this.parameters.push(condition.value)
        return `${condition.field} ${condition.operator} $${paramIndex++}`
      })
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add RETURNING clause
    if (this.returnFields.length > 0) {
      query += ` RETURNING ${this.returnFields.join(', ')}`
    }

    return { query, params: this.parameters }
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { query, params } = this.build()
    return await db.query<T>(query, params)
  }

  async first<T extends QueryResultRow = any>(): Promise<T | null> {
    const result = await this.execute<T>()
    return result.rows[0] || null
  }
}

export class DeleteBuilder {
  private tableName: string = ''
  private whereConditions: WhereCondition[] = []
  private returnFields: string[] = ['*']
  private parameters: any[] = []

  static from(tableName: string): DeleteBuilder {
    const builder = new DeleteBuilder()
    builder.tableName = tableName
    return builder
  }

  where(field: string, operator: WhereCondition['operator'], value?: any): DeleteBuilder {
    this.whereConditions.push({ field, operator, value })
    return this
  }

  returning(fields: string | string[]): DeleteBuilder {
    if (typeof fields === 'string') {
      this.returnFields = [fields]
    } else {
      this.returnFields = fields
    }
    return this
  }

  build(): { query: string; params: any[] } {
    this.parameters = []
    let paramIndex = 1

    let query = `DELETE FROM ${this.tableName}`

    // Build WHERE clause
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map(condition => {
        if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
          return `${condition.field} ${condition.operator}`
        }
        this.parameters.push(condition.value)
        return `${condition.field} ${condition.operator} $${paramIndex++}`
      })
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add RETURNING clause
    if (this.returnFields.length > 0) {
      query += ` RETURNING ${this.returnFields.join(', ')}`
    }

    return { query, params: this.parameters }
  }

  async execute<T extends QueryResultRow = any>(): Promise<QueryResult<T>> {
    const { query, params } = this.build()
    return await db.query<T>(query, params)
  }

  async first<T extends QueryResultRow = any>(): Promise<T | null> {
    const result = await this.execute<T>()
    return result.rows[0] || null
  }
}

// Export convenience functions
export const query = QueryBuilder.table
export const insert = InsertBuilder.into
export const update = UpdateBuilder.table
export const deleteFrom = DeleteBuilder.from