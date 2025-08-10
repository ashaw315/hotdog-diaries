// STRICT VERIFICATION SCRIPT - COPY THIS ENTIRE BLOCK
console.clear();
console.log('🔴 STRICT VIDEO VERIFICATION - ZERO ERRORS REQUIRED\n');

// Test 1: Count all console errors
const originalError = console.error;
let errorCount = 0;
console.error = function(...args) {
  errorCount++;
  originalError.apply(console, args);
};

// Test 2: Check for CORS-blocked resources
setTimeout(() => {
  const blockedResources = performance.getEntriesByType('resource')
    .filter(e => e.transferSize === 0 && (e.name.includes('video') || e.name.includes('google')));
  
  console.log('=== FINAL RESULTS ===');
  console.log('❌ Console Errors:', errorCount);
  console.log('❌ CORS Blocked:', blockedResources.length);
  console.log('📹 YouTube iframes:', document.querySelectorAll('iframe[src*="youtube"]').length);
  console.log('🎬 Video elements:', document.querySelectorAll('video').length);
  console.log('🖼️ Images:', document.querySelectorAll('img').length);
  
  if (errorCount === 0 && blockedResources.length === 0) {
    console.log('✅ ALL TESTS PASSED - ZERO ERRORS!');
  } else {
    console.log('❌ FAILED - ERRORS STILL EXIST');
    console.log('Blocked URLs:', blockedResources.map(r => r.name));
  }
}, 5000);

console.log('Scroll through 10+ cards and wait 5 seconds for results...');