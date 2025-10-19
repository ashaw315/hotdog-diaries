#!/usr/bin/env tsx

/**
 * Preflight checks for CI workflows
 * Validates required secrets and creates/updates GitHub issues when secrets are missing
 */

export interface PreflightConfig {
  workflowName: string
  requiredSecrets: string[]
  issueLabel: string
  repo?: string
}

export interface PreflightResult {
  shouldSkip: boolean
  missingSecrets: string[]
  message: string
}

/**
 * Check if required secrets are present
 */
export function checkSecrets(config: PreflightConfig): PreflightResult {
  const missingSecrets: string[] = []
  
  for (const secret of config.requiredSecrets) {
    const value = process.env[secret]
    if (!value || value.trim() === '') {
      missingSecrets.push(secret)
    }
  }
  
  const shouldSkip = missingSecrets.length > 0
  
  return {
    shouldSkip,
    missingSecrets,
    message: shouldSkip 
      ? `Missing required secrets: ${missingSecrets.join(', ')}`
      : 'All required secrets are present'
  }
}

/**
 * Create or update GitHub issue for missing secrets
 * Safe no-op when token permissions are insufficient
 */
export async function createOrUpdateSecretIssue(
  config: PreflightConfig, 
  missingSecrets: string[]
): Promise<void> {
  if (missingSecrets.length === 0) {
    return
  }

  const issueTitle = 'CI Scanner Secrets Missing'
  const issueBody = generateIssueBody(config.workflowName, missingSecrets)
  
  try {
    // Use GitHub CLI to create/update issue
    const { execSync } = await import('child_process')
    
    // Check if issue already exists
    const existingIssueCmd = `gh issue list --label "${config.issueLabel}" --state open --json number,title`
    
    try {
      const existingIssuesOutput = execSync(existingIssueCmd, { 
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN }
      })
      
      const existingIssues = JSON.parse(existingIssuesOutput)
      const existingIssue = existingIssues.find((issue: any) => 
        issue.title.includes('CI Scanner Secrets Missing')
      )
      
      if (existingIssue) {
        // Update existing issue
        const updateCmd = `gh issue edit ${existingIssue.number} --body "${issueBody.replace(/"/g, '\\"')}"`
        execSync(updateCmd, { 
          encoding: 'utf8',
          env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN }
        })
        console.log(`✅ Updated existing issue #${existingIssue.number}`)
      } else {
        // Create new issue
        const createCmd = `gh issue create --title "${issueTitle}" --body "${issueBody.replace(/"/g, '\\"')}" --label "${config.issueLabel}"`
        const output = execSync(createCmd, { 
          encoding: 'utf8',
          env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN }
        })
        console.log(`✅ Created new issue: ${output.trim()}`)
      }
    } catch (ghError) {
      console.warn('⚠️ Could not manage GitHub issue (insufficient permissions or gh CLI not available)')
      console.warn('Missing secrets should be configured manually:', missingSecrets.join(', '))
    }
  } catch (error) {
    console.warn('⚠️ Could not manage GitHub issue:', error)
    console.warn('Missing secrets should be configured manually:', missingSecrets.join(', '))
  }
}

function generateIssueBody(workflowName: string, missingSecrets: string[]): string {
  const timestamp = new Date().toISOString()
  
  return `## 🔐 CI Scanner Secrets Missing

The **${workflowName}** workflow is unable to run due to missing required secrets.

### Missing Secrets

${missingSecrets.map(secret => `- [ ] \`${secret}\``).join('\\n')}

### Required Actions

#### For YouTube API Key (\`YOUTUBE_API_KEY\`)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create API key with YouTube Data API v3 access
4. Add as GitHub secret: \`YOUTUBE_API_KEY\`

#### For Reddit API (\`REDDIT_CLIENT_ID\`, \`REDDIT_CLIENT_SECRET\`)
1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Create a new application (script type)
3. Note the client ID and secret
4. Add as GitHub secrets: \`REDDIT_CLIENT_ID\`, \`REDDIT_CLIENT_SECRET\`
5. Optionally add \`REDDIT_USERNAME\`, \`REDDIT_PASSWORD\` for authenticated access

#### For Authentication (\`AUTH_TOKEN\`)
1. Generate JWT token using: \`pnpm run generate-auth-token\`
2. Add as GitHub secret: \`AUTH_TOKEN\`

### Current Status

- **Workflow:** ${workflowName}
- **Status:** ⏸️ Paused (neutral conclusion)
- **Last Check:** ${timestamp}

### Re-enabling

Once secrets are configured:
1. Close this issue
2. Re-run the workflow manually to verify
3. Workflow will resume automatic scheduling

---

*This issue was created automatically by the CI preflight system.*`
}

/**
 * Set GitHub Actions output
 */
export function setOutput(name: string, value: string): void {
  const output = process.env.GITHUB_OUTPUT
  if (output) {
    const fs = require('fs')
    fs.appendFileSync(output, `${name}=${value}\\n`)
  } else {
    // Fallback for local testing
    console.log(`::set-output name=${name}::${value}`)
  }
}

/**
 * Main preflight function that can be called from workflows
 */
export async function runPreflight(config: PreflightConfig): Promise<PreflightResult> {
  console.log(`🚀 Running preflight checks for ${config.workflowName}...`)
  
  const result = checkSecrets(config)
  
  if (result.shouldSkip) {
    console.log(`❌ ${result.message}`)
    
    // Create/update GitHub issue
    await createOrUpdateSecretIssue(config, result.missingSecrets)
    
    // Set GitHub Actions output
    setOutput('should_skip', 'true')
    setOutput('missing_secrets', result.missingSecrets.join(','))
    
    console.log('⏸️ Workflow will be skipped with neutral conclusion')
  } else {
    console.log(`✅ ${result.message}`)
    setOutput('should_skip', 'false')
  }
  
  return result
}

// CLI usage
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: preflight.ts <workflow-name> <required-secret1,required-secret2,...>')
    process.exit(1)
  }
  
  const [workflowName, secretsArg] = args
  const requiredSecrets = secretsArg.split(',').map(s => s.trim())
  
  const config: PreflightConfig = {
    workflowName,
    requiredSecrets,
    issueLabel: 'ci-scanner-secrets'
  }
  
  runPreflight(config).catch(error => {
    console.error('❌ Preflight failed:', error)
    process.exit(1)
  })
}