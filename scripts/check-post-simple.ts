#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPost() {
  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .ilike('content_text', '%92 hotdogs%')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Columns available:', Object.keys(data?.[0] || {}));
  console.log('\nPost data:', JSON.stringify(data, null, 2));
}

checkPost();
