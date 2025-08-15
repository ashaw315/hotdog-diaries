#!/usr/bin/env node
import { LemmyScanningService } from '../lib/services/lemmy-scanning'

async function testLemmyFix() {
  try {
    console.log('🧪 Testing Lemmy video extraction fix...\n')
    
    const service = new LemmyScanningService()
    
    // Test the video extraction directly
    const testUrl = 'https://packaged-media.redd.it/wk10f3dzoqt91/pb/m2-res_480p.mp4?m=DASHPlaylist.mpd&v=1&e=1721811600&s=62e5488e73b31e147944ee424fdff823e34775ab#t=0'
    
    // Access the private method via reflection for testing
    const extractVideoUrl = (service as any).extractVideoUrl.bind(service)
    const extractImageUrl = (service as any).extractImageUrl.bind(service)
    
    console.log('🔗 Testing URL:', testUrl)
    console.log('')
    
    const videoResult = extractVideoUrl(testUrl)
    const imageResult = extractImageUrl(testUrl)
    
    console.log('🎥 Video extraction result:', videoResult || 'None')
    console.log('🖼️  Image extraction result:', imageResult || 'None')
    console.log('')
    
    if (videoResult) {
      console.log('✅ SUCCESS: Video URL detected correctly!')
      console.log('📋 Expected behavior:')
      console.log('   - content_video_url will be set')
      console.log('   - content_type will be "video"')
      console.log('   - content_image_url will be null')
    } else {
      console.log('❌ FAILED: Video URL not detected')
    }
    
    // Test other video URLs
    const testUrls = [
      'https://v.redd.it/abc123',
      'https://youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://vimeo.com/123456',
      'https://example.com/video.mp4',
      'https://example.com/video.gifv',
      'https://example.com/image.jpg' // Should not be detected as video
    ]
    
    console.log('\n🧪 Testing other video patterns:')
    testUrls.forEach(url => {
      const isVideo = extractVideoUrl(url)
      const isImage = extractImageUrl(url)
      console.log(`   ${url}`)
      console.log(`     Video: ${isVideo ? '✅' : '❌'} | Image: ${isImage ? '✅' : '❌'}`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testLemmyFix().catch(console.error)