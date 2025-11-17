import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkContent() {
  // Check the specific item the user mentioned (ID 8694)
  const { data: posted, error } = await supabase
    .from('posted_content')
    .select(`
      content_queue_id,
      posted_at,
      content_queue!inner (
        id,
        content_type,
        source_platform,
        content_image_url,
        content_video_url,
        content_text
      )
    `)
    .eq('content_queue_id', 8694)
    .single();

  if (error) {
    console.log('Error fetching item 8694:', error);
  } else {
    console.log('\n=== Item 8694 ===');
    console.log('Type:', posted.content_queue.content_type);
    console.log('Platform:', posted.content_queue.source_platform);
    console.log('Image URL:', posted.content_queue.content_image_url || 'NULL');
    console.log('Video URL:', posted.content_queue.content_video_url || 'NULL');
    console.log('Text:', posted.content_queue.content_text?.substring(0, 100));
  }

  // Check recent videos/gifs
  console.log('\n=== Recent Videos/GIFs ===');
  const { data: items } = await supabase
    .from('posted_content')
    .select(`
      content_queue_id,
      content_queue!inner (
        id,
        content_type,
        source_platform,
        content_image_url,
        content_video_url
      )
    `)
    .in('content_queue.content_type', ['video', 'gif'])
    .order('posted_at', { ascending: false })
    .limit(10);

  items?.forEach((item: any) => {
    console.log(`\nID ${item.content_queue.id}: ${item.content_queue.content_type} from ${item.content_queue.source_platform}`);
    console.log('  Image URL:', item.content_queue.content_image_url || 'NULL');
    console.log('  Video URL:', item.content_queue.content_video_url || 'NULL');
  });

  // Check Pixabay images
  console.log('\n=== Recent Pixabay Images ===');
  const { data: pixabayItems } = await supabase
    .from('posted_content')
    .select(`
      content_queue_id,
      content_queue!inner (
        id,
        content_type,
        source_platform,
        content_image_url
      )
    `)
    .eq('content_queue.source_platform', 'pixabay')
    .order('posted_at', { ascending: false })
    .limit(5);

  pixabayItems?.forEach((item: any) => {
    console.log(`\nID ${item.content_queue.id}: ${item.content_queue.content_type}`);
    console.log('  Image URL:', item.content_queue.content_image_url || 'NULL');
    console.log('  Has /get/ path:', item.content_queue.content_image_url?.includes('/get/') || false);
  });
}

checkContent();
