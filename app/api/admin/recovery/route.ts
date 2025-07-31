import { NextRequest, NextResponse } from 'next/server'
import { errorRecoveryService } from '@/lib/services/error-recovery'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const actionId = searchParams.get('actionId')

  if (actionId) {
    const status = errorRecoveryService.getRecoveryActionStatus(actionId)
    return NextResponse.json(status)
  }

  const statistics = errorRecoveryService.getRecoveryStatistics()
  return NextResponse.json(statistics)
})

export const POST = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { action, actionId, enabled } = body

  switch (action) {
    case 'execute':
      if (!actionId) {
        return NextResponse.json({ error: 'actionId is required' }, { status: 400 })
      }
      
      const success = await errorRecoveryService.executeRecoveryAction(actionId, true)
      return NextResponse.json({ 
        success, 
        message: success ? 'Recovery action executed successfully' : 'Recovery action failed'
      })

    case 'test':
      if (!actionId) {
        return NextResponse.json({ error: 'actionId is required' }, { status: 400 })
      }
      
      const testResult = await errorRecoveryService.testRecoveryAction(actionId)
      return NextResponse.json({ 
        success: testResult,
        message: testResult ? 'Recovery action test passed' : 'Recovery action test failed'
      })

    case 'enable':
    case 'disable':
      if (!actionId) {
        return NextResponse.json({ error: 'actionId is required' }, { status: 400 })
      }
      
      const enableAction = action === 'enable'
      errorRecoveryService.setRecoveryActionEnabled(actionId, enableAction)
      return NextResponse.json({ 
        success: true,
        message: `Recovery action ${enableAction ? 'enabled' : 'disabled'}`
      })

    case 'trigger_degradation':
      const scenario = body.scenario
      if (!scenario || !['database_down', 'api_down', 'high_load'].includes(scenario)) {
        return NextResponse.json({ 
          error: 'Invalid scenario. Supported: database_down, api_down, high_load' 
        }, { status: 400 })
      }
      
      await errorRecoveryService.triggerGracefulDegradation(scenario)
      return NextResponse.json({ 
        success: true,
        message: `Graceful degradation triggered for scenario: ${scenario}`
      })

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: execute, test, enable, disable, trigger_degradation' },
        { status: 400 }
      )
  }
})