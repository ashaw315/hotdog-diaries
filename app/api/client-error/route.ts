import { NextRequest, NextResponse } from 'next/server'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { level, message, errorReport } = await request.json()

    // Map string level to LogLevel enum
    const logLevel = level === 'error' ? LogLevel.ERROR :
                    level === 'warn' ? LogLevel.WARN :
                    LogLevel.INFO

    // Log the client error to database
    await logToDatabase(logLevel, message, errorReport)

    return NextResponse.json({ 
      success: true,
      errorId: errorReport.errorId 
    })
  } catch (error) {
    console.error('Failed to log client error:', error)
    return NextResponse.json(
      { error: 'Failed to log client error' },
      { status: 500 }
    )
  }
}