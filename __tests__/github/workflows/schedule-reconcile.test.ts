/**
 * Tests for Schedule Reconciliation Workflow Logic
 * 
 * Validates workflow decision logic and report generation.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'

describe('Schedule Reconciliation Workflow', () => {
  let workflowContent: string
  let workflow: any

  beforeAll(() => {
    const workflowPath = join(process.cwd(), '.github/workflows/schedule-reconcile.yml')
    workflowContent = readFileSync(workflowPath, 'utf8')
    workflow = yaml.parse(workflowContent)
  })

  describe('workflow configuration', () => {
    it('should have correct name and triggers', () => {
      expect(workflow.name).toBe('Schedule Reconciliation')
      
      // Should run daily at 2:30 AM ET
      expect(workflow.on.schedule).toEqual([
        { cron: '30 6 * * *' }
      ])
      
      // Should support manual trigger
      expect(workflow.on.workflow_dispatch).toBeDefined()
      expect(workflow.on.workflow_dispatch.inputs.date).toBeDefined()
      expect(workflow.on.workflow_dispatch.inputs.force_backfill).toBeDefined()
    })

    it('should have proper environment configuration', () => {
      expect(workflow.env.NODE_ENV).toBe('production')
    })

    it('should have reasonable timeout', () => {
      expect(workflow.jobs.reconcile['timeout-minutes']).toBe(10)
    })
  })

  describe('workflow steps structure', () => {
    const steps = workflow.jobs.reconcile.steps

    it('should have all required setup steps', () => {
      const stepNames = steps.map((step: any) => step.name)
      
      expect(stepNames).toContain('Checkout code')
      expect(stepNames).toContain('Setup Node.js')
      expect(stepNames).toContain('Install dependencies')
      expect(stepNames).toContain('Determine target date')
    })

    it('should have health check steps', () => {
      const stepNames = steps.map((step: any) => step.name)
      
      expect(stepNames).toContain('Health Check - Timezone Handling')
      expect(stepNames).toContain('Health Check - Posting Source of Truth')
    })

    it('should have backfill and reporting steps', () => {
      const stepNames = steps.map((step: any) => step.name)
      
      expect(stepNames).toContain('Run Backfill Job')
      expect(stepNames).toContain('Generate Daily Report')
      expect(stepNames).toContain('Upload Reports')
    })

    it('should have status determination and notification steps', () => {
      const stepNames = steps.map((step: any) => step.name)
      
      expect(stepNames).toContain('Determine Workflow Status')
      expect(stepNames).toContain('Notify on Failure')
      expect(stepNames).toContain('Success Summary')
    })
  })

  describe('conditional execution logic', () => {
    const steps = workflow.jobs.reconcile.steps

    it('should conditionally run backfill job', () => {
      const backfillStep = steps.find((step: any) => step.name === 'Run Backfill Job')
      
      expect(backfillStep.if).toContain('steps.health_posting.outputs.orphan_count > 0')
      expect(backfillStep.if).toContain('github.event.inputs.force_backfill == \'true\'')
    })

    it('should always upload reports', () => {
      const uploadStep = steps.find((step: any) => step.name === 'Upload Reports')
      
      expect(uploadStep.if).toBe('always()')
    })

    it('should conditionally notify on failure', () => {
      const notifyStep = steps.find((step: any) => step.name === 'Notify on Failure')
      
      expect(notifyStep.if).toBe('steps.status.outputs.workflow_status == \'failure\'')
    })

    it('should conditionally show success summary', () => {
      const successStep = steps.find((step: any) => step.name === 'Success Summary')
      
      expect(successStep.if).toBe('steps.status.outputs.workflow_status == \'success\'')
    })
  })

  describe('date handling logic', () => {
    const dateStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Determine target date')

    it('should use input date when provided', () => {
      expect(dateStep.run).toContain('if [ -n "${{ github.event.inputs.date }}" ]')
      expect(dateStep.run).toContain('TARGET_DATE="${{ github.event.inputs.date }}"')
    })

    it('should default to yesterday in ET timezone', () => {
      expect(dateStep.run).toContain('TZ=America/New_York date -d "yesterday" +%Y-%m-%d')
    })

    it('should output the target date for later steps', () => {
      expect(dateStep.run).toContain('echo "target_date=$TARGET_DATE" >> $GITHUB_OUTPUT')
    })
  })

  describe('health check implementation', () => {
    const steps = workflow.jobs.reconcile.steps

    it('should check timezone health with proper error handling', () => {
      const tzStep = steps.find((step: any) => step.name === 'Health Check - Timezone Handling')
      
      expect(tzStep.run).toContain('curl -s -w "%{http_code}"')
      expect(tzStep.run).toContain('/api/health/schedule-tz')
      expect(tzStep.run).toContain('HTTP_CODE="${RESPONSE: -3}"')
      expect(tzStep.run).toContain('if [ "$HTTP_CODE" != "200" ]')
    })

    it('should check posting health with metrics extraction', () => {
      const postingStep = steps.find((step: any) => step.name === 'Health Check - Posting Source of Truth')
      
      expect(postingStep.run).toContain('/api/health/posting-source-of-truth')
      expect(postingStep.run).toContain('ORPHAN_COUNT=$(echo "$BODY" | jq -r \'.orphan_posts // 0\')')
      expect(postingStep.run).toContain('COMPLIANCE_SCORE=$(echo "$BODY" | jq -r \'.posting_compliance_score // 0\')')
    })

    it('should set proper output variables for downstream steps', () => {
      const tzStep = steps.find((step: any) => step.name === 'Health Check - Timezone Handling')
      const postingStep = steps.find((step: any) => step.name === 'Health Check - Posting Source of Truth')
      
      expect(tzStep.run).toContain('echo "timezone_health_status=$HTTP_CODE" >> $GITHUB_OUTPUT')
      expect(postingStep.run).toContain('echo "orphan_count=$ORPHAN_COUNT" >> $GITHUB_OUTPUT')
      expect(postingStep.run).toContain('echo "compliance_score=$COMPLIANCE_SCORE" >> $GITHUB_OUTPUT')
    })
  })

  describe('backfill job execution', () => {
    const backfillStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Run Backfill Job')

    it('should use required environment variables', () => {
      expect(backfillStep.env.DATABASE_URL).toBe('${{ secrets.DATABASE_URL }}')
      expect(backfillStep.env.SUPABASE_URL).toBe('${{ secrets.SUPABASE_URL }}')
      expect(backfillStep.env.SUPABASE_SERVICE_ROLE_KEY).toBe('${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}')
    })

    it('should run backfill script with correct parameters', () => {
      expect(backfillStep.run).toContain('npx tsx scripts/ops/backfill-post-links.ts')
      expect(backfillStep.run).toContain('--date "${{ steps.date.outputs.target_date }}"')
      expect(backfillStep.run).toContain('--write')
      expect(backfillStep.run).toContain('--verbose')
    })

    it('should check for report generation', () => {
      expect(backfillStep.run).toContain('if [ -f "ci_audit/backfill-${{ steps.date.outputs.target_date }}.md" ]')
      expect(backfillStep.run).toContain('echo "backfill_report_generated=true" >> $GITHUB_OUTPUT')
    })
  })

  describe('report generation', () => {
    const reportStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Generate Daily Report')

    it('should create comprehensive markdown report', () => {
      expect(reportStep.run).toContain('REPORT_FILE="ci_audit/reconcile-${{ steps.date.outputs.target_date }}.md"')
      expect(reportStep.run).toContain('mkdir -p ci_audit')
      expect(reportStep.run).toContain('cat > "$REPORT_FILE" << \'EOF\'')
    })

    it('should include all health check results in report template', () => {
      expect(reportStep.run).toContain('## Health Check Results')
      expect(reportStep.run).toContain('### Timezone Handling')
      expect(reportStep.run).toContain('### Posting Source of Truth')
      expect(reportStep.run).toContain('${{ steps.health_tz.outputs.timezone_health_status }}')
      expect(reportStep.run).toContain('${{ steps.health_posting.outputs.orphan_count }}')
    })

    it('should include backfill results and recommendations', () => {
      expect(reportStep.run).toContain('## Backfill Results')
      expect(reportStep.run).toContain('## Recommendations')
      expect(reportStep.run).toContain('## Next Steps')
    })
  })

  describe('failure detection logic', () => {
    const statusStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Determine Workflow Status')

    it('should detect various failure conditions', () => {
      expect(statusStep.run).toContain('if [[ "${{ steps.health_tz.outputs.timezone_issues }}" == "true" ]]')
      expect(statusStep.run).toContain('|| [[ "${{ steps.health_posting.outputs.posting_issues }}" == "true" ]]')
      expect(statusStep.run).toContain('|| [[ "${{ steps.backfill.outcome }}" == "failure" ]]')
    })

    it('should set appropriate workflow status outputs', () => {
      expect(statusStep.run).toContain('echo "workflow_status=failure" >> $GITHUB_OUTPUT')
      expect(statusStep.run).toContain('echo "workflow_status=success" >> $GITHUB_OUTPUT')
    })
  })

  describe('notification and alerting', () => {
    const notifyStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Notify on Failure')

    it('should provide detailed failure information', () => {
      expect(notifyStep.run).toContain('🚨 RECONCILIATION ISSUES DETECTED')
      expect(notifyStep.run).toContain('Timezone Health: ${{ steps.health_tz.outputs.timezone_issues')
      expect(notifyStep.run).toContain('Orphan Posts: ${{ steps.health_posting.outputs.orphan_count }}')
      expect(notifyStep.run).toContain('Compliance Score: ${{ steps.health_posting.outputs.compliance_score }}%')
    })

    it('should exit with failure code to mark workflow as failed', () => {
      expect(notifyStep.run).toContain('exit 1')
    })

    const successStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Success Summary')

    it('should provide success summary information', () => {
      expect(successStep.run).toContain('✅ RECONCILIATION COMPLETED SUCCESSFULLY')
      expect(successStep.run).toContain('All health checks passed')
      expect(successStep.run).toContain('System operating within expected parameters')
    })
  })

  describe('artifact handling', () => {
    const uploadStep = workflow.jobs.reconcile.steps.find((step: any) => step.name === 'Upload Reports')

    it('should upload reports with proper configuration', () => {
      expect(uploadStep.uses).toBe('actions/upload-artifact@v4')
      expect(uploadStep.with.name).toBe('reconciliation-reports-${{ steps.date.outputs.target_date }}')
      expect(uploadStep.with.path).toBe('ci_audit/')
      expect(uploadStep.with['retention-days']).toBe(30)
    })
  })

  describe('security and credentials', () => {
    const steps = workflow.jobs.reconcile.steps

    it('should use proper secret references', () => {
      const healthSteps = steps.filter((step: any) => 
        step.name.includes('Health Check')
      )
      
      healthSteps.forEach((step: any) => {
        expect(step.run).toContain('${{ secrets.AUTH_TOKEN }}')
      })
    })

    it('should use configurable site URL with fallback', () => {
      const healthSteps = steps.filter((step: any) => 
        step.name.includes('Health Check')
      )
      
      healthSteps.forEach((step: any) => {
        expect(step.run).toContain('${{ vars.SITE_URL || \'https://hotdog-diaries.vercel.app\' }}')
      })
    })
  })
})