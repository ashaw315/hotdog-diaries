// Browser Console Verification Script
// Run this in the browser console at http://localhost:3002

console.log('🧪 Starting Video Playback Verification Tests...\n')

// Test 1: Check for CORS errors
console.log('Test 1: Checking for CORS errors...')
const corsErrors = performance.getEntriesByType('resource')
  .filter(e => e.name.includes('googlevideo') || e.name.includes('imgur'))
  .filter(e => e.transferSize === 0)
console.log('CORS Errors:', corsErrors.length)
console.log('EXPECTED: 0\n')

// Test 2: Check video elements
console.log('Test 2: Checking video elements...')
const videoElements = document.querySelectorAll('video')
console.log('Video elements found:', videoElements.length)
videoElements.forEach((video, index) => {
  console.log(`Video ${index + 1}:`, {
    src: video.src,
    canPlay: video.readyState >= 3,
    error: video.error?.message || 'none'
  })
})

// Test 3: Check YouTube iframes
console.log('\nTest 3: Checking YouTube iframes...')
const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]')
console.log('YouTube iframes found:', youtubeIframes.length)
youtubeIframes.forEach((iframe, index) => {
  console.log(`YouTube iframe ${index + 1}:`, {
    src: iframe.src,
    loaded: iframe.contentDocument !== null
  })
})

// Test 4: Check for failed image loads
console.log('\nTest 4: Checking for failed image loads...')
const images = document.querySelectorAll('img')
const brokenImages = Array.from(images).filter(img => img.naturalWidth === 0 && img.complete)
console.log('Broken images:', brokenImages.length)
console.log('Total images:', images.length)

// Test 5: Check error logging
console.log('\nTest 5: Testing error logging endpoint...')
fetch('/api/admin/video-errors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'test',
    url: 'test-url',
    error: 'verification-test'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Error logging test:', data.success ? '✅ Working' : '❌ Failed')
})
.catch(err => console.log('Error logging test: ❌ Failed -', err.message))

console.log('\n🎯 Verification complete! Check results above.')