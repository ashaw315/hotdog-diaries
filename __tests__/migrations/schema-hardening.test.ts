/**
 * Tests for Schema Hardening Migrations
 * 
 * Validates migration scripts and constraints.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

describe('Schema Hardening Migrations', () => {
  describe('SQLite Migrations', () => {
    let scheduledPostsMigration: string
    let postedContentMigration: string
    let rollbackScript: string

    beforeAll(() => {
      scheduledPostsMigration = readFileSync(
        join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'),
        'utf8'
      )
      postedContentMigration = readFileSync(
        join(process.cwd(), 'migrations/016_schema_hardening_posted_content.sql'),
        'utf8'
      )
      rollbackScript = readFileSync(
        join(process.cwd(), 'migrations/rollback_015_016_schema_hardening.sql'),
        'utf8'
      )
    })

    describe('scheduled_posts migration (015)', () => {
      it('should create table with all required constraints', () => {
        expect(scheduledPostsMigration).toContain('CREATE TABLE IF NOT EXISTS scheduled_posts_new')
        
        // Check constraint definitions
        expect(scheduledPostsMigration).toContain('CHECK (content_type IN (\'image\',\'video\',\'text\',\'link\'))')
        expect(scheduledPostsMigration).toContain('CHECK (scheduled_slot_index BETWEEN 0 AND 5)')
        expect(scheduledPostsMigration).toContain('CHECK (status IN (\'pending\',\'posting\',\'posted\',\'failed\'))')
        
        // Check foreign key
        expect(scheduledPostsMigration).toContain('FOREIGN KEY (content_id) REFERENCES content_queue(id) ON DELETE CASCADE')
      })

      it('should include data migration logic', () => {
        expect(scheduledPostsMigration).toContain('INSERT OR IGNORE INTO scheduled_posts_new')
        expect(scheduledPostsMigration).toContain('SELECT')
        expect(scheduledPostsMigration).toContain('FROM scheduled_posts')
        expect(scheduledPostsMigration).toContain('WHERE EXISTS')
      })

      it('should create proper indexes', () => {
        expect(scheduledPostsMigration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_unique_slot_platform')
        expect(scheduledPostsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time')
        expect(scheduledPostsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_content_lookup')
        expect(scheduledPostsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_status')
        expect(scheduledPostsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_slot_index')
        expect(scheduledPostsMigration).toContain('CREATE INDEX IF NOT EXISTS idx_scheduled_posts_active')
      })

      it('should create updated_at trigger', () => {
        expect(scheduledPostsMigration).toContain('CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_updated_at')
        expect(scheduledPostsMigration).toContain('AFTER UPDATE ON scheduled_posts')
        expect(scheduledPostsMigration).toContain('SET updated_at = datetime(\'now\')')
      })

      it('should perform table replacement safely', () => {
        expect(scheduledPostsMigration).toContain('DROP TABLE IF EXISTS scheduled_posts')
        expect(scheduledPostsMigration).toContain('ALTER TABLE scheduled_posts_new RENAME TO scheduled_posts')
      })
    })

    describe('posted_content migration (016)', () => {
      it('should create table with all required constraints', () => {
        expect(postedContentMigration).toContain('CREATE TABLE IF NOT EXISTS posted_content_new')
        
        // Check constraints
        expect(postedContentMigration).toContain('UNIQUE (content_queue_id)')
        expect(postedContentMigration).toContain('UNIQUE (scheduled_post_id)')
        expect(postedContentMigration).toContain('CHECK (posted_at >= \'2020-01-01\'')
        
        // Check foreign keys
        expect(postedContentMigration).toContain('FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE')
        expect(postedContentMigration).toContain('FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE SET NULL')
      })

      it('should handle missing columns gracefully', () => {
        expect(postedContentMigration).toContain('CASE')
        expect(postedContentMigration).toContain('WHEN EXISTS(SELECT 1 FROM pragma_table_info')
        expect(postedContentMigration).toContain('scheduled_post_id')
        expect(postedContentMigration).toContain('ELSE NULL')
      })

      it('should create performance indexes', () => {
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_platform')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_scheduled_lookup')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_date_platform')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_lookup')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_audit')
      })

      it('should include constraint verification tests', () => {
        expect(postedContentMigration).toContain('INSERT OR IGNORE INTO posted_content')
        expect(postedContentMigration).toContain('SELECT 999999')
        expect(postedContentMigration).toContain('DELETE FROM posted_content WHERE content_queue_id = 999999')
        expect(postedContentMigration).toContain('DELETE FROM posted_content WHERE content_queue_id = 999998')
      })
    })

    describe('rollback script', () => {
      it('should remove all constraints and indexes', () => {
        // Check trigger removal
        expect(rollbackScript).toContain('DROP TRIGGER IF EXISTS trg_posted_content_updated_at')
        expect(rollbackScript).toContain('DROP TRIGGER IF EXISTS trg_scheduled_posts_updated_at')
        
        // Check index removal
        expect(rollbackScript).toContain('DROP INDEX IF EXISTS idx_posted_content_posted_at')
        expect(rollbackScript).toContain('DROP INDEX IF EXISTS idx_scheduled_posts_unique_slot_platform')
      })

      it('should create simple tables without constraints', () => {
        expect(rollbackScript).toContain('CREATE TABLE IF NOT EXISTS posted_content_rollback')
        expect(rollbackScript).toContain('CREATE TABLE IF NOT EXISTS scheduled_posts_rollback')
        
        // Should not contain CHECK constraints
        expect(rollbackScript).not.toContain('CHECK (')
        expect(rollbackScript).not.toContain('FOREIGN KEY')
        expect(rollbackScript).not.toContain('UNIQUE (')
      })

      it('should preserve data during rollback', () => {
        expect(rollbackScript).toContain('INSERT INTO posted_content_rollback')
        expect(rollbackScript).toContain('SELECT id, content_queue_id, platform')
        expect(rollbackScript).toContain('INSERT INTO scheduled_posts_rollback')
        expect(rollbackScript).toContain('SELECT * FROM scheduled_posts')
      })

      it('should provide guidance for manual index recreation', () => {
        expect(rollbackScript).toContain('-- Note: This rollback removes all constraints and indexes')
        expect(rollbackScript).toContain('-- You may need to recreate basic indexes for performance')
        expect(rollbackScript).toContain('-- CREATE INDEX idx_scheduled_posts_time ON scheduled_posts(scheduled_post_time)')
      })
    })
  })

  describe('PostgreSQL Migrations', () => {
    let scheduledPostsMigration: string
    let postedContentMigration: string

    beforeAll(() => {
      scheduledPostsMigration = readFileSync(
        join(process.cwd(), 'supabase/migrations/20251017_schema_hardening_scheduled_posts.sql'),
        'utf8'
      )
      postedContentMigration = readFileSync(
        join(process.cwd(), 'supabase/migrations/20251017_schema_hardening_posted_content.sql'),
        'utf8'
      )
    })

    describe('scheduled_posts migration (PostgreSQL)', () => {
      it('should add table-level constraints', () => {
        expect(scheduledPostsMigration).toContain('ALTER TABLE public.scheduled_posts')
        expect(scheduledPostsMigration).toContain('ADD CONSTRAINT scheduled_posts_content_type_check')
        expect(scheduledPostsMigration).toContain('ADD CONSTRAINT scheduled_posts_slot_index_check')
        expect(scheduledPostsMigration).toContain('ADD CONSTRAINT scheduled_posts_status_check')
      })

      it('should create PostgreSQL-specific indexes', () => {
        expect(scheduledPostsMigration).toContain('CREATE UNIQUE INDEX idx_scheduled_posts_unique_slot_platform')
        expect(scheduledPostsMigration).toContain('DATE_TRUNC(\'minute\', scheduled_post_time)')
        expect(scheduledPostsMigration).toContain('CREATE INDEX idx_scheduled_posts_status_time_pg')
        expect(scheduledPostsMigration).toContain('WHERE status IN (\'pending\', \'posting\')')
      })

      it('should add foreign key constraints', () => {
        expect(scheduledPostsMigration).toContain('ADD CONSTRAINT fk_scheduled_posts_content_id')
        expect(scheduledPostsMigration).toContain('FOREIGN KEY (content_id) REFERENCES public.content_queue(id)')
        expect(scheduledPostsMigration).toContain('ON DELETE CASCADE')
      })

      it('should create updated_at trigger function', () => {
        expect(scheduledPostsMigration).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()')
        expect(scheduledPostsMigration).toContain('NEW.updated_at = NOW()')
        expect(scheduledPostsMigration).toContain('CREATE TRIGGER trigger_scheduled_posts_updated_at')
      })
    })

    describe('posted_content migration (PostgreSQL)', () => {
      it('should add scheduled_post_id column if missing', () => {
        expect(postedContentMigration).toContain('ALTER TABLE public.posted_content')
        expect(postedContentMigration).toContain('ADD COLUMN IF NOT EXISTS scheduled_post_id INTEGER')
      })

      it('should add appropriate constraints', () => {
        expect(postedContentMigration).toContain('ADD CONSTRAINT posted_content_unique_content_queue_id')
        expect(postedContentMigration).toContain('UNIQUE (content_queue_id)')
        expect(postedContentMigration).toContain('ADD CONSTRAINT posted_content_unique_scheduled_post_id')
        expect(postedContentMigration).toContain('UNIQUE (scheduled_post_id)')
      })

      it('should create foreign key relationships', () => {
        expect(postedContentMigration).toContain('ADD CONSTRAINT fk_posted_content_content_queue_id')
        expect(postedContentMigration).toContain('ADD CONSTRAINT fk_posted_content_scheduled_post_id')
        expect(postedContentMigration).toContain('ON DELETE SET NULL')
      })

      it('should create performance indexes', () => {
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at_pg')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_platform_pg')
        expect(postedContentMigration).toContain('CREATE INDEX IF NOT EXISTS idx_posted_content_scheduled_lookup_pg')
      })
    })
  })

  describe('migration safety', () => {
    it('should use IF NOT EXISTS and IF EXISTS appropriately', () => {
      const migrations = [
        readFileSync(join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'), 'utf8'),
        readFileSync(join(process.cwd(), 'migrations/016_schema_hardening_posted_content.sql'), 'utf8')
      ]

      migrations.forEach(migration => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS')
        expect(migration).toContain('CREATE INDEX IF NOT EXISTS')
        expect(migration).toContain('CREATE TRIGGER IF NOT EXISTS')
      })
    })

    it('should use INSERT OR IGNORE for data safety', () => {
      const migrations = [
        readFileSync(join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'), 'utf8'),
        readFileSync(join(process.cwd(), 'migrations/016_schema_hardening_posted_content.sql'), 'utf8')
      ]

      migrations.forEach(migration => {
        expect(migration).toContain('INSERT OR IGNORE')
      })
    })

    it('should handle missing tables gracefully', () => {
      const postedContentMigration = readFileSync(
        join(process.cwd(), 'migrations/016_schema_hardening_posted_content.sql'),
        'utf8'
      )

      expect(postedContentMigration).toContain('WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=\'posted_content\')')
    })
  })

  describe('constraint validation', () => {
    it('should define proper check constraints', () => {
      const scheduledPostsMigration = readFileSync(
        join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'),
        'utf8'
      )

      // Content type constraint
      expect(scheduledPostsMigration).toContain('content_type IN (\'image\',\'video\',\'text\',\'link\')')
      
      // Slot index constraint (0-5 for 6 daily slots)
      expect(scheduledPostsMigration).toContain('scheduled_slot_index BETWEEN 0 AND 5')
      
      // Status constraint
      expect(scheduledPostsMigration).toContain('status IN (\'pending\',\'posting\',\'posted\',\'failed\')')
    })

    it('should define reasonable time constraints', () => {
      const postedContentMigration = readFileSync(
        join(process.cwd(), 'migrations/016_schema_hardening_posted_content.sql'),
        'utf8'
      )

      expect(postedContentMigration).toContain('posted_at >= \'2020-01-01\'')
      expect(postedContentMigration).toContain('posted_at <= datetime(\'now\', \'+1 hour\')')
    })
  })

  describe('index strategy', () => {
    it('should create indexes for common query patterns', () => {
      const scheduledPostsMigration = readFileSync(
        join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'),
        'utf8'
      )

      // Time-based queries
      expect(scheduledPostsMigration).toContain('idx_scheduled_posts_status_time')
      expect(scheduledPostsMigration).toContain('(status, scheduled_post_time)')
      
      // Platform-based queries
      expect(scheduledPostsMigration).toContain('idx_scheduled_posts_platform_status')
      expect(scheduledPostsMigration).toContain('(platform, status)')
      
      // Slot-based queries
      expect(scheduledPostsMigration).toContain('idx_scheduled_posts_slot_index')
      expect(scheduledPostsMigration).toContain('(scheduled_slot_index, scheduled_post_time)')
    })

    it('should create partial indexes for performance', () => {
      const scheduledPostsMigration = readFileSync(
        join(process.cwd(), 'migrations/015_schema_hardening_scheduled_posts.sql'),
        'utf8'
      )

      expect(scheduledPostsMigration).toContain('idx_scheduled_posts_active')
      expect(scheduledPostsMigration).toContain('WHERE status = \'pending\' AND content_id IS NOT NULL')
    })
  })
})