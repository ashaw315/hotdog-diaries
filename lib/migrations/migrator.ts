import { db } from '../db'
import fs from 'fs'
import path from 'path'

interface Migration {
  id: string
  filename: string
  sql: string
}

class DatabaseMigrator {
  private migrationsPath: string

  constructor() {
    this.migrationsPath = path.join(process.cwd(), 'lib', 'migrations')
  }

  private async ensureMigrationsTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const result = await db.query(`
      SELECT id FROM migrations ORDER BY id
    `)
    return result.rows.map(row => row.id)
  }

  private getMigrationFiles(): Migration[] {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort()

    return files.map(filename => {
      const id = filename.replace('.sql', '')
      const sql = fs.readFileSync(
        path.join(this.migrationsPath, filename),
        'utf-8'
      )
      return { id, filename, sql }
    })
  }

  async runMigrations(): Promise<void> {
    try {
      await db.connect()
      await this.ensureMigrationsTable()

      const executedMigrations = await this.getExecutedMigrations()
      const allMigrations = this.getMigrationFiles()

      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration.id)
      )

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations')
        return
      }

      console.log(`Running ${pendingMigrations.length} migrations...`)

      for (const migration of pendingMigrations) {
        console.log(`Running migration: ${migration.filename}`)
        
        try {
          // Execute the migration SQL
          await db.query(migration.sql)
          
          // Record the migration as executed
          await db.query(
            'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
            [migration.id, migration.filename]
          )
          
          console.log(`✓ Migration ${migration.filename} completed`)
        } catch (error) {
          console.error(`✗ Migration ${migration.filename} failed:`, error)
          throw error
        }
      }

      console.log('All migrations completed successfully')
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  async rollbackLastMigration(): Promise<void> {
    try {
      await db.connect()
      await this.ensureMigrationsTable()

      const result = await db.query(`
        SELECT id, filename FROM migrations 
        ORDER BY executed_at DESC 
        LIMIT 1
      `)

      if (result.rows.length === 0) {
        console.log('No migrations to rollback')
        return
      }

      const lastMigration = result.rows[0]
      console.log(`Rolling back migration: ${lastMigration.filename}`)

      // Check if rollback file exists
      const rollbackFilename = lastMigration.filename.replace('.sql', '_rollback.sql')
      const rollbackPath = path.join(this.migrationsPath, rollbackFilename)

      if (fs.existsSync(rollbackPath)) {
        const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8')
        await db.query(rollbackSql)
      } else {
        console.warn(`No rollback file found for ${lastMigration.filename}`)
        console.warn('Manual rollback may be required')
      }

      // Remove migration record
      await db.query(
        'DELETE FROM migrations WHERE id = $1',
        [lastMigration.id]
      )

      console.log(`✓ Rollback of ${lastMigration.filename} completed`)
    } catch (error) {
      console.error('Rollback failed:', error)
      throw error
    }
  }

  async getMigrationStatus(): Promise<void> {
    try {
      await db.connect()
      await this.ensureMigrationsTable()

      const executedMigrations = await this.getExecutedMigrations()
      const allMigrations = this.getMigrationFiles()

      console.log('\n=== Migration Status ===')
      console.log(`Total migrations: ${allMigrations.length}`)
      console.log(`Executed migrations: ${executedMigrations.length}`)

      allMigrations.forEach(migration => {
        const status = executedMigrations.includes(migration.id) ? '✓' : '○'
        console.log(`${status} ${migration.filename}`)
      })

      const pending = allMigrations.length - executedMigrations.length
      if (pending > 0) {
        console.log(`\n${pending} pending migrations`)
      } else {
        console.log('\nAll migrations up to date')
      }
    } catch (error) {
      console.error('Failed to get migration status:', error)
      throw error
    }
  }
}

export const migrator = new DatabaseMigrator()

// CLI interface for running migrations
if (require.main === module) {
  const command = process.argv[2]

  switch (command) {
    case 'migrate':
      migrator.runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
      break
    case 'rollback':
      migrator.rollbackLastMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
      break
    case 'status':
      migrator.getMigrationStatus()
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
      break
    default:
      console.log('Usage: node migrator.js [migrate|rollback|status]')
      process.exit(1)
  }
}