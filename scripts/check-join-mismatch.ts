#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

async function checkJoinMismatch() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Checking for JOIN mismatches between content_queue and posted_content...\n');

  // Check posts in posted_content that don't have a matching content_queue entry
  const { data: orphanedPosts, error: orphanError } = await supabase
    .from('posted_content')
    .select('id, content_queue_id, posted_at, post_order')
    .is('content_queue_id', null)
    .order('posted_at', { ascending: false })
    .limit(10);

  if (orphanError) {
    console.error('Error checking orphaned posts:', orphanError);
  } else {
    console.log(`Posts with NULL content_queue_id: ${orphanedPosts?.length || 0}`);
    if (orphanedPosts && orphanedPosts.length > 0) {
      orphanedPosts.forEach((post) => {
        console.log(`  ID: ${post.id}, posted_at: ${post.posted_at}, content_queue_id: ${post.content_queue_id}`);
      });
    }
  }

  // Check what the JOIN returns (simulating the API query)
  const { data: joinData, error: joinError } = await supabase.rpc('get_posted_content_with_queue', {
    limit_count: 10,
    offset_count: 0
  });

  if (joinError && joinError.code !== '42883') {
    // Ignore "function does not exist" error
    console.error('\nError testing JOIN:', joinError);
  }

  // Alternative: Check posts that have a content_queue_id
  const { data: validPosts, error: validError } = await supabase
    .from('posted_content')
    .select('id, content_queue_id, posted_at, post_order')
    .not('content_queue_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);

  if (validError) {
    console.error('\nError checking posts with valid content_queue_id:', validError);
  } else {
    console.log(`\nPosts WITH content_queue_id (these should appear in the JOIN): ${validPosts?.length || 0}`);
    validPosts?.forEach((post, i) => {
      console.log(`${i+1}. ID: ${post.id}, posted_at: ${post.posted_at}, post_order: ${post.post_order}, queue_id: ${post.content_queue_id}`);
    });
  }

  // Now check if those content_queue IDs actually exist
  console.log('\nChecking if content_queue entries exist for recent posts...');
  if (validPosts && validPosts.length > 0) {
    const queueIds = validPosts.map(p => p.content_queue_id).filter(Boolean);
    const { data: queueEntries, error: queueError } = await supabase
      .from('content_queue')
      .select('id')
      .in('id', queueIds);

    if (queueError) {
      console.error('Error checking content_queue:', queueError);
    } else {
      console.log(`Content_queue entries found: ${queueEntries?.length || 0} out of ${queueIds.length}`);
      const missingIds = queueIds.filter(id => !queueEntries?.find(e => e.id === id));
      if (missingIds.length > 0) {
        console.log(`Missing content_queue IDs: ${missingIds.join(', ')}`);
      }
    }
  }
}

checkJoinMismatch();
