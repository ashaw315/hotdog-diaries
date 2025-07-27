import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, contentIds } = body

    if (!action || !Array.isArray(contentIds) || contentIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid action or content IDs' },
        { status: 400 }
      )
    }

    // Validate that all contentIds are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!contentIds.every(id => uuidRegex.test(id))) {
      return NextResponse.json(
        { error: 'Invalid content ID format' },
        { status: 400 }
      )
    }

    const placeholders = contentIds.map((_, index) => `$${index + 1}`).join(', ')
    
    let query = ''
    let successMessage = ''

    switch (action) {
      case 'approve':
        query = `
          UPDATE content 
          SET status = 'approved', updated_at = NOW()
          WHERE id IN (${placeholders}) AND status = 'pending'
        `
        successMessage = 'Content approved successfully'
        break

      case 'schedule':
        // Schedule content for the next available slot (every 4 hours)
        const now = new Date()
        const nextSlotHour = Math.ceil(now.getHours() / 4) * 4
        const scheduledFor = new Date(now)
        scheduledFor.setHours(nextSlotHour, 0, 0, 0)
        
        // If the calculated time is in the past or too soon, add 4 hours
        if (scheduledFor.getTime() <= now.getTime() + 30 * 60 * 1000) {
          scheduledFor.setHours(scheduledFor.getHours() + 4)
        }

        query = `
          UPDATE content 
          SET 
            status = 'scheduled', 
            scheduled_for = $${contentIds.length + 1},
            updated_at = NOW()
          WHERE id IN (${placeholders}) AND status IN ('pending', 'approved')
        `
        contentIds.push(scheduledFor.toISOString())
        successMessage = 'Content scheduled successfully'
        break

      case 'delete':
        query = `
          DELETE FROM content 
          WHERE id IN (${placeholders}) AND status IN ('pending', 'scheduled')
        `
        successMessage = 'Content deleted successfully'
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    const result = await db.query(query, contentIds)

    return NextResponse.json({
      success: true,
      message: successMessage,
      affectedRows: result.rowCount
    })
  } catch (error) {
    console.error('Error performing bulk action:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}