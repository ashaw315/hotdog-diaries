// FINAL VERIFICATION SCRIPT
(function() {
  console.clear();
  console.log('🔍 FINAL VIDEO PLAYBACK VERIFICATION\n');
  
  // Check what's actually rendered
  const iframes = document.querySelectorAll('iframe');
  const videos = document.querySelectorAll('video');
  const images = document.querySelectorAll('img');
  
  console.log('📊 ELEMENTS FOUND:');
  console.log('  iframes:', iframes.length);
  console.log('  videos:', videos.length);
  console.log('  images:', images.length);
  
  // Check YouTube iframes specifically
  const youtubeIframes = Array.from(iframes).filter(f => f.src.includes('youtube.com/embed'));
  console.log('\n📹 YOUTUBE IFRAMES:', youtubeIframes.length);
  youtubeIframes.forEach((f, i) => {
    console.log(`  ${i+1}. ${f.src.substring(0, 60)}...`);
  });
  
  // Check for googlevideo requests (SHOULD BE ZERO)
  const googleVideoRequests = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('googlevideo.com'));
  console.log('\n⚠️ GOOGLEVIDEO REQUESTS (SHOULD BE 0):', googleVideoRequests.length);
  if (googleVideoRequests.length > 0) {
    console.error('❌ STILL MAKING DIRECT GOOGLEVIDEO REQUESTS!');
    googleVideoRequests.forEach(r => console.error('  ', r.name.substring(0, 80) + '...'));
  }
  
  // Check playing videos
  const playingVideos = Array.from(videos).filter(v => !v.paused);
  console.log('\n🎬 PLAYING VIDEOS:', playingVideos.length, '/', videos.length);
  
  // Final verdict
  const hasYouTubeIframes = youtubeIframes.length > 0;
  const noGoogleVideo = googleVideoRequests.length === 0;
  const hasPlayingVideos = playingVideos.length > 0;
  
  console.log('\n' + '='.repeat(50));
  if (hasYouTubeIframes && noGoogleVideo && hasPlayingVideos) {
    console.log('✅ ALL SYSTEMS OPERATIONAL');
  } else {
    console.log('❌ CRITICAL FAILURES:');
    if (!hasYouTubeIframes) console.log('  - No YouTube iframes found');
    if (!noGoogleVideo) console.log('  - Still requesting from googlevideo.com');
    if (!hasPlayingVideos) console.log('  - No videos are playing');
  }
  console.log('='.repeat(50));
})();