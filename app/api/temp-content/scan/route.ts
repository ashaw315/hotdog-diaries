import { NextResponse } from 'next/server';

interface TempContent {
  id: string;
  title: string;
  url: string;
  source: string;
  imageUrl?: string;
  videoUrl?: string;
  content: string;
  timestamp: string;
  platform: string;
}

export async function POST() {
  try {
    console.log('🌭 Starting temporary content scan...');
    
    const tempContent: TempContent[] = [];
    const errors: string[] = [];

    // Reddit scanning
    try {
      console.log('📱 Scanning Reddit...');
      const redditContent = await scanReddit();
      tempContent.push(...redditContent);
      console.log(`✅ Reddit: Found ${redditContent.length} items`);
    } catch (error) {
      console.error('❌ Reddit scan failed:', error);
      errors.push(`Reddit: ${error.message}`);
    }

    // YouTube scanning
    try {
      console.log('📺 Scanning YouTube...');
      const youtubeContent = await scanYouTube();
      tempContent.push(...youtubeContent);
      console.log(`✅ YouTube: Found ${youtubeContent.length} items`);
    } catch (error) {
      console.error('❌ YouTube scan failed:', error);
      errors.push(`YouTube: ${error.message}`);
    }

    // Pixabay scanning
    try {
      console.log('🖼️ Scanning Pixabay...');
      const pixabayContent = await scanPixabay();
      tempContent.push(...pixabayContent);
      console.log(`✅ Pixabay: Found ${pixabayContent.length} items`);
    } catch (error) {
      console.error('❌ Pixabay scan failed:', error);
      errors.push(`Pixabay: ${error.message}`);
    }

    // Store content temporarily (in production, this would go to database)
    if (tempContent.length > 0) {
      // For now, we'll return the content directly
      console.log(`🎉 Total content found: ${tempContent.length} items`);
    }

    return NextResponse.json({
      success: true,
      message: `Temporary scan completed! Found ${tempContent.length} hotdog items`,
      content: tempContent,
      errors: errors,
      stats: {
        total: tempContent.length,
        reddit: tempContent.filter(c => c.platform === 'reddit').length,
        youtube: tempContent.filter(c => c.platform === 'youtube').length,
        pixabay: tempContent.filter(c => c.platform === 'pixabay').length
      }
    });

  } catch (error) {
    console.error('❌ Temporary scan failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Temporary content scan failed'
    }, { status: 500 });
  }
}

async function scanReddit(): Promise<TempContent[]> {
  const items: TempContent[] = [];
  
  // Reddit API call
  const response = await fetch('https://www.reddit.com/r/hotdogs.json?limit=10');
  if (!response.ok) throw new Error(`Reddit API failed: ${response.status}`);
  
  const data = await response.json();
  
  for (const post of data.data.children) {
    const postData = post.data;
    
    items.push({
      id: `reddit_${postData.id}`,
      title: postData.title,
      url: `https://reddit.com${postData.permalink}`,
      source: postData.url,
      imageUrl: postData.url?.includes('.jpg') || postData.url?.includes('.png') || postData.url?.includes('.gif') ? postData.url : undefined,
      content: postData.selftext || postData.title,
      timestamp: new Date().toISOString(),
      platform: 'reddit'
    });
  }
  
  return items;
}

async function scanYouTube(): Promise<TempContent[]> {
  const items: TempContent[] = [];
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) throw new Error('YouTube API key not configured');
  
  // YouTube API call
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=hotdog&type=video&maxResults=5&key=${apiKey}`
  );
  
  if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);
  
  const data = await response.json();
  
  for (const video of data.items) {
    items.push({
      id: `youtube_${video.id.videoId}`,
      title: video.snippet.title,
      url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      source: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      imageUrl: video.snippet.thumbnails?.high?.url,
      videoUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      content: video.snippet.description,
      timestamp: new Date().toISOString(),
      platform: 'youtube'
    });
  }
  
  return items;
}

async function scanPixabay(): Promise<TempContent[]> {
  const items: TempContent[] = [];
  const apiKey = process.env.PIXABAY_API_KEY;
  
  if (!apiKey) throw new Error('Pixabay API key not configured');
  
  // Pixabay API call
  const response = await fetch(
    `https://pixabay.com/api/?key=${apiKey}&q=hotdog&image_type=photo&per_page=10`
  );
  
  if (!response.ok) throw new Error(`Pixabay API failed: ${response.status}`);
  
  const data = await response.json();
  
  for (const image of data.hits) {
    items.push({
      id: `pixabay_${image.id}`,
      title: image.tags || 'Hotdog Image',
      url: image.pageURL,
      source: image.webformatURL,
      imageUrl: image.webformatURL,
      content: `Delicious hotdog image: ${image.tags}`,
      timestamp: new Date().toISOString(),
      platform: 'pixabay'
    });
  }
  
  return items;
}