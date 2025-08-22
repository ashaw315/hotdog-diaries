// YouTube Iframe Fix Verification Script
// Run this in browser console on https://hotdog-diaries.vercel.app

console.log('🔧 Verifying YouTube Iframe Fix...');

function verifyYouTubeiFix() {
  console.log('\n🎬 === YouTube Iframe Fix Verification ===\n');

  // 1. Check for YouTube iframes (CORRECT)
  const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
  console.log(`✅ YouTube iframes found: ${youtubeIframes.length}`);
  
  if (youtubeIframes.length > 0) {
    youtubeIframes.forEach((iframe, i) => {
      const src = iframe.src;
      console.log(`\n🎥 YouTube iframe ${i + 1}:`, {
        src: src,
        hasAutoplay: src.includes('autoplay='),
        hasMute: src.includes('mute=1'),
        hasEnableJsApi: src.includes('enablejsapi=1'),
        hasPlaysinline: src.includes('playsinline=1'),
        width: iframe.style.width || iframe.width,
        height: iframe.style.height || iframe.height
      });
    });
  }

  // 2. Check for wrongly rendered video elements with YouTube sources (WRONG)
  const wrongVideoElements = document.querySelectorAll('video source[src*="youtube.com"], video[src*="youtube.com"]');
  console.log(`\n${wrongVideoElements.length === 0 ? '✅' : '❌'} Wrong video elements with YouTube: ${wrongVideoElements.length}`);
  
  if (wrongVideoElements.length > 0) {
    console.log('🚨 Found video elements wrongly using YouTube URLs:');
    wrongVideoElements.forEach((element, i) => {
      const src = element.src || element.getAttribute('src');
      console.log(`   ${i + 1}. ${element.tagName}: ${src}`);
    });
  }

  // 3. Check for any video elements that might be YouTube
  const allVideoElements = document.querySelectorAll('video');
  let youtubeVideoElements = 0;
  allVideoElements.forEach(video => {
    const sources = video.querySelectorAll('source');
    sources.forEach(source => {
      if (source.src && (source.src.includes('youtube.com') || source.src.includes('youtu.be'))) {
        youtubeVideoElements++;
        console.log(`❌ Found video element with YouTube source: ${source.src}`);
      }
    });
  });

  console.log(`\n${youtubeVideoElements === 0 ? '✅' : '❌'} Video elements with YouTube sources: ${youtubeVideoElements}`);

  // 4. Check console for YouTube rendering logs
  console.log('\n📝 Look for these console messages in the main console:');
  console.log('   • "🎥 YouTube rendering: ID=..." - Should show iframe rendering');
  console.log('   • "⚠️ YouTube URL ... passed to MobileVideoPlayer" - Should NOT appear');
  console.log('   • "⚠️ YouTube URL ... reached direct video handler" - Should NOT appear');

  // 5. Test autoplay functionality
  if (youtubeIframes.length > 0) {
    console.log('\n🔧 Testing autoplay functionality...');
    
    // Simulate user interaction first (required for autoplay)
    document.dispatchEvent(new Event('touchstart', { bubbles: true }));
    document.dispatchEvent(new Event('click', { bubbles: true }));
    console.log('✅ User interaction simulated');

    // Test iframe API messaging
    const testIframe = youtubeIframes[0];
    console.log('📨 Testing iframe API messaging...');
    
    setTimeout(() => {
      testIframe.contentWindow?.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        'https://www.youtube.com'
      );
      console.log('✅ Play command sent to iframe');
    }, 1000);
  }

  // 6. Summary
  console.log('\n📊 === Summary ===');
  const isFixed = youtubeIframes.length > 0 && wrongVideoElements.length === 0 && youtubeVideoElements === 0;
  
  if (isFixed) {
    console.log('🎉 YouTube iframe fix is working correctly!');
    console.log('✅ YouTube videos are using proper iframe embeds');
    console.log('✅ No video elements are wrongly using YouTube URLs');
    console.log('✅ Autoplay should now work properly');
  } else {
    console.log('❌ Issues detected:');
    if (youtubeIframes.length === 0) console.log('   • No YouTube iframes found');
    if (wrongVideoElements.length > 0) console.log('   • Video elements still using YouTube URLs');
    if (youtubeVideoElements > 0) console.log('   • Video elements with YouTube sources detected');
  }

  return {
    youtubeIframes: youtubeIframes.length,
    wrongVideoElements: wrongVideoElements.length,
    youtubeVideoElements: youtubeVideoElements,
    isFixed: isFixed
  };
}

// Auto-run verification
const result = verifyYouTubeiFix();

// Make function available globally
window.verifyYouTubeiFix = verifyYouTubeiFix;

console.log('\n💡 Run verifyYouTubeiFix() again anytime to re-check');

// Return result for programmatic use
result;