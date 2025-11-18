import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixBlueskyDoubleXrpc() {
  console.log('🔧 Fixing Bluesky items with double /xrpc/xrpc/ in URLs\n');
  console.log('='.repeat(60));

  // Find all Bluesky items with double /xrpc/xrpc/ in either image or video URLs
  const { data: items, error: fetchError } = await supabase
    .from('content_queue')
    .select('id, content_image_url, content_video_url')
    .eq('source_platform', 'bluesky')
    .or('content_image_url.like.%/xrpc/xrpc/%,content_video_url.like.%/xrpc/xrpc/%');

  if (fetchError) {
    console.error('❌ Error fetching items:', fetchError);
    return;
  }

  if (!items || items.length === 0) {
    console.log('✅ No items found with double /xrpc/ - all clean!');
    return;
  }

  console.log(`\n📊 Found ${items.length} items with double /xrpc/ URLs\n`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const item of items) {
    try {
      const updates: any = {};
      let hasUpdates = false;

      // Fix image URL if it has double /xrpc/xrpc/
      if (item.content_image_url && item.content_image_url.includes('/xrpc/xrpc/')) {
        updates.content_image_url = item.content_image_url.replace('/xrpc/xrpc/', '/xrpc/');
        hasUpdates = true;
        console.log(`  🔧 Fixing item ${item.id}:`);
        console.log(`     Before: ${item.content_image_url.substring(0, 100)}...`);
        console.log(`     After:  ${updates.content_image_url.substring(0, 100)}...`);
      }

      // Fix video URL if it has double /xrpc/xrpc/
      if (item.content_video_url && item.content_video_url.includes('/xrpc/xrpc/')) {
        updates.content_video_url = item.content_video_url.replace('/xrpc/xrpc/', '/xrpc/');
        hasUpdates = true;
        if (!updates.content_image_url) {
          console.log(`  🔧 Fixing item ${item.id}:`);
        }
        console.log(`     Video before: ${item.content_video_url.substring(0, 100)}...`);
        console.log(`     Video after:  ${updates.content_video_url.substring(0, 100)}...`);
      }

      if (hasUpdates) {
        // Update the item
        const { error: updateError } = await supabase
          .from('content_queue')
          .update(updates)
          .eq('id', item.id);

        if (updateError) {
          console.error(`  ❌ Error updating item ${item.id}:`, updateError);
          errorCount++;
        } else {
          fixedCount++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing item ${item.id}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`  Total items found: ${items.length}`);
  console.log(`  Successfully fixed: ${fixedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (fixedCount > 0) {
    console.log('\n✅ Bluesky URLs have been fixed!');
    console.log('   All /xrpc/xrpc/ patterns have been replaced with /xrpc/');
  }
}

fixBlueskyDoubleXrpc();
