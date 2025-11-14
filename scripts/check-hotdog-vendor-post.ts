#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPost() {
  const { data, error} = await supabase
    .from('content_queue')
    .select('id, content_type, content_text, content_image_url, content_video_url, content_metadata, original_url')
    .ilike('content_text', '%92 hotdogs%')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const count = data ? data.length : 0;
  console.log(`Found ${count} posts matching "92 hotdogs":\n`);

  if (data) {
    data.forEach((post, i) => {
      console.log(`Post #${i + 1}:`);
      console.log(`  ID: ${post.id}`);
      console.log(`  Type: ${post.content_type}`);
      const textPreview = post.content_text ? post.content_text.substring(0, 80) : 'N/A';
      console.log(`  Text: ${textPreview}...`);
      console.log(`  Image URL: ${post.content_image_url || 'NULL'}`);
      console.log(`  Video URL: ${post.content_video_url || 'NULL'}`);
      console.log(`  Metadata:`, JSON.stringify(post.content_metadata, null, 2));
      console.log(`  Original URL: ${post.original_url}`);
      console.log('');
    });
  }
}

checkPost();
