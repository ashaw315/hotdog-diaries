#!/usr/bin/env tsx

/**
 * Comprehensive scanner investigation to identify issues similar to Tumblr
 */

interface ScannerAnalysis {
  platform: string
  searchTerms: string[]
  autoApprovalThreshold: number
  recentScans: number
  approvedCount: number
  issues: string[]
  recommendations: string[]
}

const analyses: ScannerAnalysis[] = []

// Reddit Analysis
analyses.push({
  platform: 'Reddit',
  searchTerms: ['hotdog', 'hot dog'],
  autoApprovalThreshold: 0.6,
  recentScans: 7,
  approvedCount: 7,
  issues: [
    'Only 2 search terms (limited variety)'
  ],
  recommendations: [
    'Add search terms: "corn dog", "chili dog", "chicago dog", "bratwurst"'
  ]
})

// Pixabay Analysis
analyses.push({
  platform: 'Pixabay',
  searchTerms: ['hotdog', 'hot dog', 'bratwurst', 'frankfurter', 'sausage grill'],
  autoApprovalThreshold: 0.6,
  recentScans: 4,
  approvedCount: 4,
  issues: [
    'Last new content: Aug 26 (exhausted)',
    '"sausage grill" is generic (like Tumblr\'s "food photography")',
    'Finding only duplicates'
  ],
  recommendations: [
    'Replace "sausage grill" with "hotdog stand", "street food", "corn dog"',
    'Add date-based or sorting parameter to API calls for fresher content'
  ]
})

// Giphy Analysis
analyses.push({
  platform: 'Giphy',
  searchTerms: ['hotdog', 'hot dog', 'corn dog', 'chicago style hotdog', 'bratwurst', 'chili dog'],
  autoApprovalThreshold: 0.30,
  recentScans: 0,
  approvedCount: 0,
  issues: [
    'Last new content: Aug 26 (exhausted)',
    'Auto-approves ALL content (is_approved: true in code)',
    'Threshold is 0.3 (very low) but still 0 approved',
    'EXCELLENT search terms but finding duplicates',
    'Rate limit system may be blocking scans'
  ],
  recommendations: [
    'Remove auto-approval (is_approved: true) - let content processor decide',
    'Add trending/recency parameter to API calls',
    'Rotate through search terms instead of using all at once',
    'Check rate limit logic - may be preventing scans unnecessarily'
  ]
})

// Imgur Analysis
analyses.push({
  platform: 'Imgur',
  searchTerms: ['hotdog', 'hot dog', 'chili dog', 'chicago dog', 'corn dog'],
  autoApprovalThreshold: 0.5,
  recentScans: 4,
  approvedCount: 4,
  issues: [
    'No major issues detected'
  ],
  recommendations: [
    'Add "hotdog stand", "street food", "frankfurter" for more variety'
  ]
})

// Bluesky Analysis
analyses.push({
  platform: 'Bluesky',
  searchTerms: ['hotdog', 'hot dog', 'chili dog'],
  autoApprovalThreshold: 0.6,
  recentScans: 2,
  approvedCount: 2,
  issues: [
    'Only 3 search terms (VERY LIMITED - same issue as early Tumblr)',
    'Low approval rate despite recent scans',
    'Reduced to 3 terms "for faster serverless execution"'
  ],
  recommendations: [
    'Expand search terms to match other platforms: add "corn dog", "chicago dog", "bratwurst", "hotdog stand"',
    'Serverless performance concerns are overblown - other platforms use 5-6 terms fine'
  ]
})

// Lemmy Analysis
analyses.push({
  platform: 'Lemmy',
  searchTerms: [], // Uses community targeting instead
  autoApprovalThreshold: 0.65,
  recentScans: 1,
  approvedCount: 1,
  issues: [
    'HIGHEST approval threshold (0.65) - too strict',
    'Only targets 2 communities',
    'Extensive spam filtering may reject good content',
    'Text length limits may be too strict (150 chars for title, 150-300 for body)'
  ],
  recommendations: [
    'Lower autoApprovalThreshold from 0.65 to 0.6 (match other platforms)',
    'Add more Lemmy communities: lemmy.world/c/streetfood, lemmy.ml/c/food, etc.',
    'Relax text length limits - some good content has longer descriptions',
    'Reduce spam filtering aggressiveness for community-targeted content'
  ]
})

console.log('\n🔍 SCANNER INVESTIGATION REPORT\n')
console.log('='  .repeat(80))

for (const analysis of analyses) {
  console.log(`\n📊 ${analysis.platform}`)
  console.log('-'.repeat(80))
  console.log(`Search Terms: [${analysis.searchTerms.join('", "')}]`)
  console.log(`Auto-Approval Threshold: ${analysis.autoApprovalThreshold}`)
  console.log(`Approved Items: ${analysis.approvedCount}`)
  console.log(`\n❌ Issues Found:`)
  analysis.issues.forEach(issue => {
    console.log(`  • ${issue}`)
  })
  console.log(`\n✅ Recommendations:`)
  analysis.recommendations.forEach(rec => {
    console.log(`  • ${rec}`)
  })
}

console.log('\n')
console.log('='  .repeat(80))
console.log('\n🎯 PRIORITY FIXES:')
console.log('\n1. GIPHY (Critical - 0 approved, exhausted)')
console.log('   - Remove auto-approval bypass')
console.log('   - Add trending/recent sorting to find fresh content')
console.log('   - Rotate search terms instead of using all at once')
console.log('\n2. BLUESKY (High - Limited search terms)')
console.log('   - Expand from 3 to 6+ search terms')
console.log('   - Add: corn dog, chicago dog, bratwurst, hotdog stand')
console.log('\n3. PIXABAY (Medium - Exhausted, generic terms)')
console.log('   - Replace "sausage grill" with specific hotdog terms')
console.log('   - Add date/sorting parameters for fresher results')
console.log('\n4. LEMMY (Medium - Too strict, limited communities)')
console.log('   - Lower threshold from 0.65 to 0.6')
console.log('   - Add more communities')
console.log('   - Relax spam filtering')
console.log('\n5. REDDIT (Low - Add more search terms)')
console.log('   - Expand from 2 to 5+ terms')
console.log('\n6. IMGUR (Low - Minor improvements)')
console.log('   - Add 2-3 more search terms')
console.log('\n')
