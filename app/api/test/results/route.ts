import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET(request: NextRequest) {
  try {
    const resultsPath = path.join(process.cwd(), 'test-results.json')
    
    if (fs.existsSync(resultsPath)) {
      const data = fs.readFileSync(resultsPath, 'utf-8')
      return NextResponse.json(JSON.parse(data))
    } else {
      return NextResponse.json(
        { error: 'No test results found. Run a scan test first.' },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}