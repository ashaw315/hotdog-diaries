#!/usr/bin/env node

async function testLemmyAPI() {
  try {
    console.log('🔍 Testing Lemmy API for epoxy hot dog post...\n')
    
    // Fetch from the hot_dog community on lemmy.world
    const url = 'https://lemmy.world/api/v3/post/list?community_name=hot_dog&limit=50'
    
    console.log(`Fetching: ${url}\n`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HotdogDiariesBot/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log(`📊 Found ${data.posts?.length || 0} posts total\n`)
    
    // Find the epoxy post
    const epoxyPost = data.posts?.find((item: any) => 
      item.post?.name?.toLowerCase().includes('epoxy') ||
      item.post?.body?.toLowerCase().includes('epoxy')
    )
    
    if (!epoxyPost) {
      console.log('❌ Epoxy hot dog post not found in recent posts')
      
      // Show a few recent posts for context
      console.log('\n📋 Recent posts:')
      data.posts?.slice(0, 5).forEach((item: any, index: number) => {
        console.log(`${index + 1}. "${item.post?.name}" by ${item.creator?.name}`)
        if (item.post?.url) console.log(`   URL: ${item.post.url}`)
        if (item.post?.thumbnail_url) console.log(`   Thumbnail: ${item.post.thumbnail_url}`)
        console.log('')
      })
      return
    }
    
    console.log('✅ Found epoxy hot dog post!\n')
    console.log('📝 Post Details:')
    console.log(`Title: ${epoxyPost.post.name}`)
    console.log(`Body: ${epoxyPost.post.body || 'No body'}`)
    console.log(`Author: ${epoxyPost.creator?.name}`)
    console.log(`Score: ${epoxyPost.counts?.score}`)
    console.log(`Published: ${epoxyPost.post.published}`)
    console.log('')
    
    console.log('🔗 Media URLs:')
    console.log(`post.url: ${epoxyPost.post.url || 'None'}`)
    console.log(`post.thumbnail_url: ${epoxyPost.post.thumbnail_url || 'None'}`)
    console.log(`post.embed_video_url: ${epoxyPost.post.embed_video_url || 'None'}`)
    console.log(`post.embed_description: ${epoxyPost.post.embed_description || 'None'}`)
    console.log(`post.embed_title: ${epoxyPost.post.embed_title || 'None'}`)
    console.log('')
    
    console.log('🔍 Full post object structure:')
    console.log(JSON.stringify(epoxyPost, null, 2))
    
    // Check if the URL might be a video
    const url_value = epoxyPost.post.url
    if (url_value) {
      console.log(`\n🎥 URL Analysis: ${url_value}`)
      
      // Check common video patterns
      const videoPatterns = [
        { name: 'Direct MP4', pattern: /\.mp4$/i },
        { name: 'Direct WebM', pattern: /\.webm$/i },
        { name: 'Direct MOV', pattern: /\.mov$/i },
        { name: 'YouTube', pattern: /youtube\.com|youtu\.be/i },
        { name: 'Vimeo', pattern: /vimeo\.com/i },
        { name: 'Reddit Video', pattern: /v\.redd\.it/i },
        { name: 'GIFV (Video)', pattern: /\.gifv$/i },
        { name: 'TikTok', pattern: /tiktok\.com/i }
      ]
      
      videoPatterns.forEach(({ name, pattern }) => {
        if (pattern.test(url_value)) {
          console.log(`   ✅ Matches ${name} pattern`)
        }
      })
      
      // Fetch the URL to see what it returns
      try {
        console.log(`\n🌐 Testing URL fetch...`)
        const testResponse = await fetch(url_value, { 
          method: 'HEAD',
          headers: { 'User-Agent': 'HotdogDiariesBot/1.0' }
        })
        console.log(`   Status: ${testResponse.status}`)
        console.log(`   Content-Type: ${testResponse.headers.get('content-type') || 'Unknown'}`)
        console.log(`   Content-Length: ${testResponse.headers.get('content-length') || 'Unknown'}`)
      } catch (fetchError) {
        console.log(`   ❌ URL fetch failed: ${fetchError}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testLemmyAPI().catch(console.error)