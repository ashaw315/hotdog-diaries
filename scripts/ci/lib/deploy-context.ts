#!/usr/bin/env tsx

/**
 * Deployment Context Utility
 * 
 * Analyzes GitHub deployment_status events and Vercel deployments to provide
 * consistent context for CI gates. Handles both deployment_status webhooks
 * and push events by querying Vercel API.
 * 
 * Exit codes:
 * - 0: Deployment successful and URL available (proceed with checks)
 * - 78: Deployment not successful or URL missing (neutral/skip checks)
 * - 1: Hard errors (configuration/auth issues)
 */

import { spawn } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'

const execFile = promisify(spawn)

export interface DeploymentContext {
  state: string
  url: string
  commit: string
  reason: string
  environment?: string
}

export interface VercelDeployment {
  uid: string
  url: string
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED'
  readyState: 'QUEUED' | 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'READY' | 'CANCELED'
  meta: {
    githubCommitSha?: string
  }
  target: string | null
  aliasError?: {
    code: string
    message: string
  }
  errorCode?: string
  errorMessage?: string
}

/**
 * Extract deployment context from GitHub event
 */
export function extractGitHubDeploymentContext(): DeploymentContext | null {
  const eventName = process.env.GITHUB_EVENT_NAME
  const eventPath = process.env.GITHUB_EVENT_PATH
  
  if (!eventPath) {
    return null
  }
  
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    
    if (eventName === 'deployment_status') {
      const deployment = event.deployment
      const deploymentStatus = event.deployment_status
      
      return {
        state: deploymentStatus.state, // success, failure, inactive, in_progress, queued, error
        url: deploymentStatus.target_url || deploymentStatus.environment_url || deployment.payload?.web_url || '',
        commit: deployment.sha || process.env.GITHUB_SHA || '',
        reason: deploymentStatus.description || deployment.description || '',
        environment: deployment.environment
      }
    }
    
    if (eventName === 'push') {
      return {
        state: 'push',
        url: '',
        commit: process.env.GITHUB_SHA || '',
        reason: 'Push event - will query Vercel API',
        environment: 'production'
      }
    }
    
    return null
  } catch (error) {
    console.error('❌ Failed to parse GitHub event:', error.message)
    return null
  }
}

/**
 * Query Vercel API for deployment status
 */
export async function queryVercelDeployment(sha: string, options: {
  maxWaitMinutes?: number
  pollIntervalSeconds?: number
} = {}): Promise<DeploymentContext> {
  const { maxWaitMinutes = 4, pollIntervalSeconds = 10 } = options
  
  const vercelToken = process.env.VERCEL_TOKEN
  const vercelProjectId = process.env.VERCEL_PROJECT_ID
  const vercelTeamId = process.env.VERCEL_TEAM_ID
  
  if (!vercelToken || !vercelProjectId) {
    throw new Error('Missing required Vercel credentials: VERCEL_TOKEN and VERCEL_PROJECT_ID required')
  }
  
  const maxWaitMs = maxWaitMinutes * 60 * 1000
  const pollIntervalMs = pollIntervalSeconds * 1000
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const url = new URL('https://api.vercel.com/v6/deployments')
      url.searchParams.set('projectId', vercelProjectId)
      url.searchParams.set('meta-githubCommitSha', sha)
      url.searchParams.set('limit', '1')
      if (vercelTeamId) {
        url.searchParams.set('teamId', vercelTeamId)
      }
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      }
      
      const response = await fetch(url.toString(), { headers })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`Vercel API authentication failed: ${response.status} ${response.statusText}. Check VERCEL_TOKEN.`)
        }
        if (response.status === 403) {
          throw new Error(`Vercel API access forbidden: ${response.status} ${response.statusText}. Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID.`)
        }
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      const deployments = data.deployments as VercelDeployment[]
      
      if (!deployments || deployments.length === 0) {
        // No deployment found yet, wait and retry
        if (Date.now() - startTime + pollIntervalMs >= maxWaitMs) {
          return {
            state: 'timeout',
            url: '',
            commit: sha,
            reason: `Timeout waiting ${maxWaitMinutes} minutes for Vercel deployment`
          }
        }
        
        console.log(`⏳ No deployment found for ${sha.substring(0, 7)}, waiting ${pollIntervalSeconds}s...`)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        continue
      }
      
      const deployment = deployments[0]
      const vercelState = deployment.readyState || deployment.state
      
      // Map Vercel states to our context states
      let mappedState: string
      let deploymentUrl = ''
      let reason = ''
      
      switch (vercelState) {
        case 'READY':
          mappedState = 'success'
          deploymentUrl = `https://${deployment.url}`
          reason = 'Vercel deployment ready'
          break
          
        case 'ERROR':
        case 'CANCELED':
          mappedState = 'failure'
          reason = deployment.errorMessage || deployment.aliasError?.message || `Vercel deployment ${vercelState.toLowerCase()}`
          break
          
        case 'BUILDING':
        case 'INITIALIZING':
        case 'QUEUED':
          // Still in progress, continue waiting if we have time
          if (Date.now() - startTime + pollIntervalMs >= maxWaitMs) {
            return {
              state: 'timeout',
              url: '',
              commit: sha,
              reason: `Timeout waiting for deployment to complete (still ${vercelState.toLowerCase()})`
            }
          }
          
          console.log(`⏳ Deployment ${vercelState.toLowerCase()} for ${sha.substring(0, 7)}, waiting ${pollIntervalSeconds}s...`)
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
          continue
          
        default:
          mappedState = 'unknown'
          reason = `Unknown Vercel state: ${vercelState}`
      }
      
      return {
        state: mappedState,
        url: deploymentUrl,
        commit: sha,
        reason,
        environment: deployment.target || 'preview'
      }
      
    } catch (error) {
      if (error.message.includes('Vercel API')) {
        throw error // Re-throw Vercel API errors as hard failures
      }
      
      console.error(`⚠️ Error querying Vercel API: ${error.message}`)
      
      // For network errors, continue retrying if we have time
      if (Date.now() - startTime + pollIntervalMs < maxWaitMs) {
        console.log(`🔄 Retrying in ${pollIntervalSeconds}s...`)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        continue
      }
      
      return {
        state: 'error',
        url: '',
        commit: sha,
        reason: `Failed to query Vercel API: ${error.message}`
      }
    }
  }
  
  return {
    state: 'timeout',
    url: '',
    commit: sha,
    reason: `Timeout after ${maxWaitMinutes} minutes waiting for deployment`
  }
}

/**
 * Determine if we should proceed with checks based on deployment context
 */
export function shouldProceedWithChecks(context: DeploymentContext): boolean {
  return context.state === 'success' && context.url.length > 0
}

/**
 * Output GitHub Actions outputs
 */
export function setGitHubOutputs(context: DeploymentContext): void {
  if (!process.env.GITHUB_OUTPUT) {
    return
  }
  
  const outputs = [
    `state=${context.state}`,
    `url=${context.url}`,
    `commit=${context.commit}`,
    `reason=${context.reason}`,
    `proceed=${shouldProceedWithChecks(context) ? 'true' : 'false'}`,
    `environment=${context.environment || ''}`
  ]
  
  fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n')
}

/**
 * Write job summary explaining deployment context
 */
export function writeJobSummary(context: DeploymentContext): void {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return
  }
  
  const proceed = shouldProceedWithChecks(context)
  const emoji = proceed ? '✅' : (context.state === 'failure' ? '❌' : '⏸️')
  
  const summary = `
## ${emoji} Deployment Context Analysis

| Field | Value |
|-------|-------|
| **State** | \`${context.state}\` |
| **URL** | ${context.url ? `[${context.url}](${context.url})` : '_none_'} |
| **Commit** | \`${context.commit.substring(0, 7)}\` |
| **Environment** | \`${context.environment || 'unknown'}\` |
| **Reason** | ${context.reason} |
| **Proceed with checks** | ${proceed ? '✅ Yes' : '⏸️ No'} |

${!proceed ? `
### 🔄 Next Steps

This deployment is not ready for health checks. This is normal and expected for:
- Failed deployments (fix the deployment issue first)
- Deployments still in progress (wait for completion)
- Missing preview URLs (check Vercel configuration)

**No action required** - this workflow will conclude neutrally.
` : `
### ✅ Ready for Health Checks

Deployment is successful with a valid URL. Health checks will proceed.
`}
`.trim()
  
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0] || 'analyze'
  
  try {
    if (command === 'analyze') {
      console.log('🔍 Analyzing deployment context...')
      
      // First try to extract from GitHub event
      let context = extractGitHubDeploymentContext()
      
      if (!context) {
        console.error('❌ Unable to extract deployment context from GitHub event')
        process.exit(1)
      }
      
      console.log(`📋 Initial context: state=${context.state}, commit=${context.commit.substring(0, 7)}`)
      
      // For push events, query Vercel API
      if (context.state === 'push') {
        console.log('🔍 Push event detected, querying Vercel API...')
        
        const maxWaitFlag = args.find(arg => arg.startsWith('--max-wait='))
        const maxWait = maxWaitFlag ? parseInt(maxWaitFlag.split('=')[1]) : 4
        
        context = await queryVercelDeployment(context.commit, { maxWaitMinutes: maxWait })
      }
      
      // Output results
      console.log(`📊 Final context: state=${context.state}, url=${context.url ? 'present' : 'missing'}`)
      console.log(JSON.stringify(context, null, 2))
      
      // Set GitHub outputs if running in Actions
      if (process.env.GITHUB_ACTIONS) {
        setGitHubOutputs(context)
        writeJobSummary(context)
      }
      
      // Determine exit code
      if (shouldProceedWithChecks(context)) {
        console.log('✅ Deployment ready - proceeding with checks')
        process.exit(0)
      } else if (['failure', 'error', 'timeout', 'canceled'].includes(context.state)) {
        console.log(`⏸️ Deployment not ready (${context.state}) - concluding neutrally`)
        process.exit(78) // Neutral exit code
      } else {
        console.log(`⏸️ Deployment in progress (${context.state}) - concluding neutrally`)
        process.exit(78)
      }
      
    } else if (command === 'help' || command === '--help') {
      console.log(`
Deployment Context Utility

Usage:
  deploy-context.ts [analyze] [--max-wait=4]

Commands:
  analyze     Analyze current deployment context (default)
  help        Show this help message

Options:
  --max-wait=N    Maximum minutes to wait for deployment (default: 4)

Environment Variables:
  VERCEL_TOKEN         Vercel API token (required for push events)
  VERCEL_PROJECT_ID    Vercel project ID (required for push events)
  VERCEL_TEAM_ID       Vercel team ID (optional)

Exit Codes:
  0    Deployment successful and URL available
  78   Deployment not ready or failed (neutral)
  1    Configuration error

Examples:
  # Analyze GitHub deployment_status event
  deploy-context.ts analyze
  
  # Wait up to 6 minutes for push deployment
  deploy-context.ts analyze --max-wait=6
      `.trim())
      
    } else {
      console.error(`❌ Unknown command: ${command}`)
      console.error('Use "deploy-context.ts help" for usage information')
      process.exit(1)
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    
    // Provide actionable error messages
    if (error.message.includes('VERCEL_TOKEN')) {
      console.error('💡 Set VERCEL_TOKEN secret with a token that has deployments:read permission')
    }
    if (error.message.includes('VERCEL_PROJECT_ID')) {
      console.error('💡 Set VERCEL_PROJECT_ID secret with your Vercel project ID')
    }
    
    process.exit(1)
  }
}

// Run CLI if called directly (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}