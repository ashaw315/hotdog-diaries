import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Testing fresh Giphy scan with new search terms...')
    
    // Temporarily modify search terms to get different GIFs
    const originalSearchTerms = (giphyScanningService as any).constructor.SEARCH_TERMS
    ;(giphyScanningService as any).constructor.SEARCH_TERMS = ['sausage', 'bratwurst', 'frankfurter']
    
    const result = await giphyScanningService.performScan({ maxPosts: 3 })
    
    // Restore original search terms  
    ;(giphyScanningService as any).constructor.SEARCH_TERMS = originalSearchTerms
    
    return NextResponse.json({
      success: true,
      message: 'Fresh Giphy scan with different terms',
      result
    })

  } catch (error) {
    console.error('Fresh Giphy scan error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}