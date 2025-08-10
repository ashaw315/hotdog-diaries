// PRIORITY 3 VERIFICATION - Video/GIF Playback Tests
// Copy and paste this entire script into browser console at http://localhost:3002

console.log('🧪 PRIORITY 3 VERIFICATION: Video/GIF Playback Tests\n')

// Test 1: Check for CORS errors (CRITICAL)
console.log('Test 1: Checking for CORS errors...')
const corsErrors = performance.getEntriesByType('resource')
  .filter(e => e.name.includes('googlevideo') || e.name.includes('imgur'))
  .filter(e => e.transferSize === 0)
console.log('CORS Errors:', corsErrors.length)
console.log('EXPECTED: 0 (if > 0, videos will fail to load)\n')

// Test 2: Check YouTube iframe elements
console.log('Test 2: Checking YouTube iframe elements...')
const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]')
console.log('YouTube iframes found:', youtubeIframes.length)

youtubeIframes.forEach((iframe, index) => {
  console.log(`  YouTube iframe ${index + 1}:`)
  console.log(`    - Src: ${iframe.src}`)
  console.log(`    - Width: ${iframe.style.width || iframe.width}`)
  console.log(`    - Height: ${iframe.style.height || iframe.height}`)
  console.log(`    - Allow: ${iframe.getAttribute('allow')}`)
})

console.log()

// Test 3: Check HTML5 video elements (for Imgur)
console.log('Test 3: Checking HTML5 video elements...')
const videoElements = document.querySelectorAll('video')
console.log('HTML5 video elements found:', videoElements.length)

videoElements.forEach((video, index) => {
  console.log(`  Video ${index + 1}:`)
  console.log(`    - Src: ${video.src}`)
  console.log(`    - Ready state: ${video.readyState} (4=can play through)`)
  console.log(`    - Network state: ${video.networkState} (3=loading, 2=idle)`)
  console.log(`    - Error: ${video.error?.message || 'none'}`)
  console.log(`    - Duration: ${video.duration || 'unknown'}`)
  console.log(`    - Autoplay: ${video.autoplay}`)
  console.log(`    - Muted: ${video.muted}`)
})

console.log()

// Test 4: Check for failed image loads
console.log('Test 4: Checking for failed image loads...')
const images = document.querySelectorAll('img')
const brokenImages = Array.from(images).filter(img => 
  img.complete && img.naturalWidth === 0
)
console.log('Broken images:', brokenImages.length, '/', images.length)

if (brokenImages.length > 0) {
  brokenImages.forEach((img, index) => {
    console.log(`  Broken image ${index + 1}: ${img.src}`)
  })
}

console.log()

// Test 5: Test error logging endpoint
console.log('Test 5: Testing error logging endpoint...')
fetch('/api/admin/video-errors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'verification-test',
    url: 'http://localhost:3002/test',
    error: 'browser_verification_test'
  })
})
.then(response => response.json())
.then(data => {
  console.log('  Error logging endpoint:', data.success ? '✅ Working' : '❌ Failed')
  console.log('  Response:', data)
})
.catch(err => {
  console.log('  Error logging endpoint: ❌ Failed -', err.message)
})

// Test 6: Check video playback functionality
console.log('\nTest 6: Testing video playback...')
setTimeout(() => {
  const videos = document.querySelectorAll('video')
  const iframes = document.querySelectorAll('iframe[src*="youtube"]')
  
  console.log('Video playback status:')
  videos.forEach((video, index) => {
    console.log(`  Video ${index + 1}: ${video.paused ? 'Paused' : 'Playing'} - Ready: ${video.readyState >= 3}`)
  })
  
  iframes.forEach((iframe, index) => {
    console.log(`  YouTube iframe ${index + 1}: ${iframe.src ? 'Loaded' : 'Not loaded'}`)
  })
}, 2000)

// Test 7: Platform-specific content verification
console.log('\nTest 7: Platform-specific content verification...')
setTimeout(() => {
  const postCards = document.querySelectorAll('[data-platform]')
  const platformCounts = {}
  
  postCards.forEach(card => {
    const platform = card.getAttribute('data-platform')
    platformCounts[platform] = (platformCounts[platform] || 0) + 1
  })
  
  console.log('Platform content distribution:')
  Object.entries(platformCounts).forEach(([platform, count]) => {
    console.log(`  ${platform}: ${count} posts`)
  })
}, 1000)

console.log('\n🎯 Verification tests initiated. Results will appear above as they complete.')
console.log('\n📋 VERIFICATION CHECKLIST:')
console.log('  ☐ CORS Errors = 0')
console.log('  ☐ YouTube iframes loading properly')
console.log('  ☐ Imgur videos playing without errors')
console.log('  ☐ Error logging endpoint working')
console.log('  ☐ No broken images')
console.log('  ☐ Videos auto-playing when active')
console.log('\nNext: Scroll through feed and verify videos play correctly!')