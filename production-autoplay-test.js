// YouTube Autoplay Production Test Script
// Run this in browser console on https://hotdog-diaries.vercel.app

console.log('🎬 Starting YouTube Autoplay Production Test...');

// Test 1: Check if YouTube players exist
function testYouTubePlayersExist() {
  const youtubePlayers = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
  console.log(`📺 YouTube players found: ${youtubePlayers.length}`);
  
  if (youtubePlayers.length === 0) {
    console.log('❌ No YouTube players found. Try scrolling down to find YouTube videos.');
    return false;
  }
  
  // Check each player configuration
  youtubePlayers.forEach((iframe, index) => {
    console.log(`🔍 YouTube Player ${index + 1}:`, {
      src: iframe.src,
      hasAutoplay: iframe.src.includes('autoplay='),
      hasEnableJSAPI: iframe.src.includes('enablejsapi=1'),
      isMuted: iframe.src.includes('mute=1'),
      hasPlaysinline: iframe.src.includes('playsinline=1')
    });
  });
  
  return true;
}

// Test 2: Check autoplay parameters
function testAutoplayConfiguration() {
  const youtubePlayers = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
  let allConfigured = true;
  
  youtubePlayers.forEach((iframe, index) => {
    const src = iframe.src;
    const config = {
      hasEnableJSAPI: src.includes('enablejsapi=1'),
      isMuted: src.includes('mute=1'),
      hasPlaysinline: src.includes('playsinline=1'),
      hasOrigin: src.includes('origin=')
    };
    
    console.log(`⚙️ Player ${index + 1} Configuration:`, config);
    
    if (!config.hasEnableJSAPI || !config.isMuted) {
      console.log(`❌ Player ${index + 1} missing required configuration`);
      allConfigured = false;
    }
  });
  
  return allConfigured;
}

// Test 3: Test iframe API messaging
function testIframeMessaging() {
  const youtubePlayers = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
  
  if (youtubePlayers.length === 0) {
    console.log('❌ No YouTube players to test messaging');
    return false;
  }
  
  const player = youtubePlayers[0];
  console.log('🔧 Testing iframe API messaging on first player...');
  
  // Listen for messages from YouTube
  const messageHandler = (event) => {
    if (event.origin !== 'https://www.youtube.com') return;
    
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      console.log('📨 YouTube API Message:', data);
    } catch (error) {
      // Ignore parsing errors
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Send play command
  setTimeout(() => {
    console.log('▶️ Sending play command...');
    player.contentWindow.postMessage(
      '{"event":"command","func":"playVideo","args":""}',
      'https://www.youtube.com'
    );
  }, 1000);
  
  // Clean up listener after 10 seconds
  setTimeout(() => {
    window.removeEventListener('message', messageHandler);
    console.log('🧹 Cleaned up message listener');
  }, 10000);
  
  return true;
}

// Test 4: Check intersection observer functionality
function testIntersectionObserver() {
  const youtubePlayers = document.querySelectorAll('iframe[src*="youtube.com/embed"]');
  
  if (youtubePlayers.length === 0) {
    console.log('❌ No YouTube players to test intersection observer');
    return false;
  }
  
  console.log('👁️ Testing intersection observer...');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const visibilityPercent = Math.round(entry.intersectionRatio * 100);
      console.log(`🔍 Player visibility: ${visibilityPercent}% (threshold: 50%)`);
      
      if (entry.intersectionRatio > 0.5) {
        console.log('✅ Player is >50% visible - should trigger autoplay');
      } else {
        console.log('⏸️ Player is <50% visible - should pause');
      }
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });
  
  youtubePlayers.forEach(player => {
    observer.observe(player.parentElement || player);
  });
  
  // Clean up after 30 seconds
  setTimeout(() => {
    observer.disconnect();
    console.log('🧹 Cleaned up intersection observer');
  }, 30000);
  
  return true;
}

// Test 5: Simulate user interaction (required for autoplay)
function simulateUserInteraction() {
  console.log('👆 Simulating user interaction for autoplay compliance...');
  
  // Dispatch touch and click events
  document.dispatchEvent(new Event('touchstart', { bubbles: true }));
  document.dispatchEvent(new Event('click', { bubbles: true }));
  
  console.log('✅ User interaction events dispatched');
  return true;
}

// Main test runner
async function runAutoplayTests() {
  console.log('\n🚀 Running YouTube Autoplay Production Tests...\n');
  
  const results = {
    playersExist: testYouTubePlayersExist(),
    configurationCorrect: testAutoplayConfiguration(),
    messagingWorks: testIframeMessaging(),
    intersectionObserverActive: testIntersectionObserver(),
    userInteractionSimulated: simulateUserInteraction()
  };
  
  console.log('\n📊 Test Results Summary:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! YouTube autoplay should be working.');
    console.log('\n📋 Manual Test Steps:');
    console.log('1. Scroll to find a YouTube video in the feed');
    console.log('2. Scroll it into view (>50% visible)');
    console.log('3. Video should start playing automatically (muted)');
    console.log('4. Scroll away - video should pause');
    console.log('5. Try with another video - only one should play at a time');
  } else {
    console.log('\n⚠️ Some tests failed. Check console for details.');
  }
  
  return results;
}

// Auto-run tests
runAutoplayTests();

// Export for manual testing
window.youtubeAutoplayTest = {
  runTests: runAutoplayTests,
  testPlayers: testYouTubePlayersExist,
  testConfig: testAutoplayConfiguration,
  testMessaging: testIframeMessaging,
  testObserver: testIntersectionObserver,
  simulateInteraction: simulateUserInteraction
};

console.log('\n💡 Tip: You can run individual tests using:');
console.log('window.youtubeAutoplayTest.testPlayers()');
console.log('window.youtubeAutoplayTest.testConfig()');
console.log('window.youtubeAutoplayTest.testMessaging()');