#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addColumn() {
  console.log('Adding content_metadata column to content_queue table...');
  
  // Use raw SQL to add the column
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'content_queue' 
          AND column_name = 'content_metadata'
        ) THEN
          ALTER TABLE content_queue 
          ADD COLUMN content_metadata JSONB DEFAULT NULL;
          
          COMMENT ON COLUMN content_queue.content_metadata IS 
          'Flexible metadata storage for platform-specific data like gallery images, video variants, etc.';
          
          RAISE NOTICE 'Column content_metadata added successfully';
        ELSE
          RAISE NOTICE 'Column content_metadata already exists';
        END IF;
      END $$;
    `
  });

  if (error) {
    console.error('Error adding column:', error);
    console.log('\nTrying alternative approach with direct SQL...');
    
    // Alternative: Try direct ALTER TABLE (requires appropriate permissions)
    const { error: altError } = await supabase
      .from('content_queue')
      .select('content_metadata')
      .limit(1);
    
    if (altError && altError.message.includes('does not exist')) {
      console.error('Column does not exist and we cannot add it via RPC.');
      console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
      console.log('━'.repeat(60));
      console.log(`
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN content_queue.content_metadata IS 
'Flexible metadata storage for platform-specific data like gallery images, video variants, etc.';
      `);
      console.log('━'.repeat(60));
    } else if (!altError) {
      console.log('✅ Column already exists!');
    }
  } else {
    console.log('✅ Migration completed successfully!');
  }
}

addColumn();
