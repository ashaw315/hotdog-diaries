import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { FilteringService } from '@/lib/services/filtering'

export async function POST(request: NextRequest) {
  try {
    const { text, patternType } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 }
      )
    }

    const filteringService = new FilteringService()
    
    let patternsQuery = `
      SELECT 
        id,
        pattern_type,
        pattern,
        description,
        is_regex,
        is_enabled
      FROM filter_patterns
      WHERE is_enabled = true
    `
    
    const queryParams = []
    
    if (patternType && patternType !== 'all') {
      patternsQuery += ' AND pattern_type = $1'
      queryParams.push(patternType)
    }
    
    patternsQuery += ' ORDER BY pattern_type, created_at DESC'

    const patterns = await query(patternsQuery, queryParams)

    const results = []

    for (const pattern of patterns.rows) {
      try {
        let matches = false
        let matchedText = undefined

        if (pattern.is_regex) {
          const regex = new RegExp(pattern.pattern, 'i')
          const match = text.match(regex)
          matches = match !== null
          matchedText = match ? match[0] : undefined
        } else {
          const lowerText = text.toLowerCase()
          const lowerPattern = pattern.pattern.toLowerCase()
          matches = lowerText.includes(lowerPattern)
          if (matches) {
            const index = lowerText.indexOf(lowerPattern)
            matchedText = text.substring(index, index + pattern.pattern.length)
          }
        }

        results.push({
          pattern,
          matches,
          matchedText
        })
      } catch (error) {
        results.push({
          pattern,
          matches: false,
          error: error.message
        })
      }
    }

    const overallAnalysis = {
      isSpam: await filteringService.isSpamContent(text),
      isInappropriate: await filteringService.isInappropriateContent(text),
      isUnrelated: await filteringService.isUnrelatedContent(text),
      isValidHotdog: await filteringService.isValidHotdogContent(text)
    }

    return NextResponse.json({
      results,
      analysis: overallAnalysis,
      summary: {
        totalPatterns: results.length,
        matches: results.filter(r => r.matches).length,
        errors: results.filter(r => r.error).length
      }
    })
  } catch (error) {
    console.error('Error testing filters:', error)
    return NextResponse.json(
      { error: 'Failed to test filters' },
      { status: 500 }
    )
  }
}