#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

async function checkRecentPosts() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get the most recent 10 posts by posted_at
  const { data, error } = await supabase
    .from('posted_content')
    .select('id, posted_at, post_order, created_at')
    .order('posted_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Most recent 10 posts by posted_at:');
  data?.forEach((post, i) => {
    console.log(`${i+1}. ID: ${post.id}, posted_at: ${post.posted_at}, post_order: ${post.post_order}`);
  });

  // Also check if there are any posts with NULL posted_at
  const { data: nullPosts, error: nullError } = await supabase
    .from('posted_content')
    .select('id, posted_at, post_order, created_at')
    .is('posted_at', null)
    .limit(10);

  if (nullError) {
    console.error('Error checking null posts:', nullError);
    return;
  }

  console.log(`\nPosts with NULL posted_at: ${nullPosts?.length || 0}`);
  if (nullPosts && nullPosts.length > 0) {
    nullPosts.forEach((post) => {
      console.log(`  ID: ${post.id}, created_at: ${post.created_at}, post_order: ${post.post_order}`);
    });
  }

  // Check what the API endpoint is actually querying
  console.log('\nChecking what the content_queue JOIN returns...');
  const { data: queueData, error: queueError } = await supabase
    .from('content_queue')
    .select('id, status, posted_content!inner(posted_at, post_order)')
    .eq('status', 'posted')
    .order('id', { ascending: false })
    .limit(10);

  if (queueError) {
    console.error('Error querying content_queue:', queueError);
    return;
  }

  console.log('\nContent queue items with status=posted (via JOIN):');
  queueData?.forEach((item: any, i: number) => {
    const pc = Array.isArray(item.posted_content) ? item.posted_content[0] : item.posted_content;
    console.log(`${i+1}. Queue ID: ${item.id}, posted_at: ${pc?.posted_at}, post_order: ${pc?.post_order}`);
  });
}

checkRecentPosts();
