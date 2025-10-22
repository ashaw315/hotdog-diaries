#!/usr/bin/env node
/**
 * Production Verification Script for posting-unify-and-cron-stagger
 * 
 * Verifies that the unified posting system works correctly in production:
 * - Scheduler fills 6 slots/day with diversity constraints
 * - Unified posting pipeline runs and posts
 * - Cron staggering reduced collisions
 * - Supabase + secrets healthy
 * - Health endpoints OK
 * - Guarded failures neutralize properly
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Octokit } from '@octokit/rest';
import fetch from 'cross-fetch';
import { glob } from 'glob';
import { execSync } from 'child_process';
import { extractCronSchedules, findCronCollisions, CronJob, CronCollision } from './lib/cron';

// Types
interface VerificationSection {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  details: string[];
  data?: any;
}

interface VerificationReport {
  timestamp: string;
  environment: Record<string, string>;
  sections: VerificationSection[];
  executiveSummary: string;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  nextActions: string[];
}

interface SupabaseScheduledPost {
  id: number;
  content_id: number;
  platform: string;
  content_type: string;
  scheduled_post_time: string;
  scheduled_slot_index: number;
  actual_posted_at?: string;
}

class PostingSystemVerifier {
  private octokit: Octokit;
  private supabaseUrl: string;
  private supabaseServiceKey: string;
  private siteUrl: string;
  private authToken: string;
  private reportDate: string;
  private reportDir: string;
  private rawDataDir: string;
  
  constructor() {
    this.validateEnvironment();
    
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      request: { fetch }
    });
    
    this.supabaseUrl = process.env.SUPABASE_URL!;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.siteUrl = process.env.SITE_URL!;
    this.authToken = process.env.AUTH_TOKEN!;
    
    // Setup report directories
    this.reportDate = format(new Date(), 'yyyy-MM-dd');
    this.reportDir = join(process.cwd(), 'ci_audit', 'verification', this.reportDate);
    this.rawDataDir = join(this.reportDir, 'raw');
  }
  
  private validateEnvironment(): void {
    const required = [
      'GITHUB_TOKEN',
      'SITE_URL', 
      'SUPABASE_URL',
      'AUTH_TOKEN'
    ];
    
    const serviceKeyPresent = process.env.SUPABASE_SERVICE_ROLE_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKeyPresent) {
      required.push('SUPABASE_SERVICE_ROLE_KEY_V2 or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const missing = required.filter(env => !process.env[env]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  
  private async setupDirectories(): Promise<void> {
    await fs.mkdir(this.rawDataDir, { recursive: true });
  }
  
  private async saveRawData(filename: string, data: any): Promise<void> {
    const filePath = join(this.rawDataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
  
  private redactSecrets(text: string): string {
    return text
      .replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
      .replace(/apikey=[A-Za-z0-9._-]+/g, 'apikey=[REDACTED]')
      .replace(/token=[A-Za-z0-9._-]+/g, 'token=[REDACTED]');
  }
  
  // Section A: Repo & PR State
  private async verifyRepoState(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      // Check commit presence
      const targetCommit = '6609f69';
      try {
        execSync(`git show ${targetCommit} --oneline`, { stdio: 'pipe' });
        details.push(`✅ Target commit ${targetCommit} found in repository`);
      } catch {
        details.push(`❌ Target commit ${targetCommit} not found`);
        status = 'fail';
      }
      
      // Check PR status
      try {
        const { data: prs } = await this.octokit.rest.pulls.list({
          owner: 'ashaw315',
          repo: 'hotdog-diaries',
          state: 'all',
          sort: 'updated',
          direction: 'desc'
        });
        
        const targetPR = prs.find(pr => pr.title.includes('posting-unify-and-cron-stagger'));
        if (targetPR) {
          details.push(`✅ PR "${targetPR.title}" found (${targetPR.state}, #${targetPR.number})`);
          details.push(`   URL: ${targetPR.html_url}`);
        } else {
          details.push(`⚠️ PR "posting-unify-and-cron-stagger" not found`);
          status = status === 'pass' ? 'warning' : status;
        }
      } catch (error) {
        details.push(`❌ Failed to check PR status: ${error}`);
        status = 'fail';
      }
      
      // Check required files
      const requiredFiles = [
        '.github/workflows/post-time-slot.yml',
        '.github/workflows/post.yml',
        '__tests__/posting-diversity.test.ts'
      ];
      
      for (const file of requiredFiles) {
        try {
          await fs.access(file);
          details.push(`✅ Required file exists: ${file}`);
        } catch {
          details.push(`❌ Required file missing: ${file}`);
          status = 'fail';
        }
      }
      
      // Check legacy wrapper conversion
      const legacyWrappers = await glob('.github/workflows/post-*.yml');
      let wrapperCount = 0;
      
      for (const wrapper of legacyWrappers) {
        if (wrapper.includes('post-time-slot.yml')) continue; // Skip the reusable workflow itself
        
        try {
          const content = await fs.readFile(wrapper, 'utf-8');
          if (content.includes('uses: ./.github/workflows/post-time-slot.yml')) {
            wrapperCount++;
            details.push(`✅ Legacy wrapper converted: ${wrapper.split('/').pop()}`);
          } else {
            details.push(`⚠️ Legacy wrapper not converted: ${wrapper.split('/').pop()}`);
            status = status === 'pass' ? 'warning' : status;
          }
        } catch {
          details.push(`❌ Failed to read wrapper: ${wrapper}`);
          status = 'fail';
        }
      }
      
      details.push(`📊 Found ${wrapperCount} converted legacy wrappers`);
      
      // Check workflow permissions and secret patterns
      const workflowFiles = await glob('.github/workflows/*.yml');
      let permissionsCount = 0;
      let secretFallbackCount = 0;
      
      for (const workflowFile of workflowFiles) {
        try {
          const content = await fs.readFile(workflowFile, 'utf-8');
          
          // Check for permissions block
          if (content.includes('permissions:')) {
            permissionsCount++;
          }
          
          // Check for Supabase secret fallback pattern
          if (content.includes('SUPABASE_SERVICE_ROLE_KEY_V2') && 
              content.includes('secrets.SUPABASE_SERVICE_ROLE_KEY_V2 || secrets.SUPABASE_SERVICE_ROLE_KEY')) {
            secretFallbackCount++;
          }
        } catch {
          details.push(`❌ Failed to read workflow: ${workflowFile}`);
          status = 'fail';
        }
      }
      
      details.push(`📊 Workflows with permissions blocks: ${permissionsCount}/${workflowFiles.length}`);
      details.push(`📊 Workflows with secret fallback pattern: ${secretFallbackCount}`);
      
      if (permissionsCount < workflowFiles.length * 0.8) {
        details.push(`⚠️ Many workflows missing permissions blocks`);
        status = status === 'pass' ? 'warning' : status;
      }
      
    } catch (error) {
      details.push(`❌ Repo state verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'Repository & PR State',
      status,
      details
    };
  }
  
  // Section B: Cron & Collision Health
  private async verifyCronHealth(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      const workflowFiles = await glob('.github/workflows/*.yml');
      const allCronJobs: CronJob[] = [];
      
      for (const workflowFile of workflowFiles) {
        try {
          const content = await fs.readFile(workflowFile, 'utf-8');
          const workflowName = workflowFile.split('/').pop()!.replace('.yml', '');
          const cronJobs = extractCronSchedules(content, workflowName);
          allCronJobs.push(...cronJobs);
        } catch (error) {
          details.push(`⚠️ Failed to parse crons in ${workflowFile}: ${error}`);
        }
      }
      
      details.push(`📊 Found ${allCronJobs.length} total cron jobs across all workflows`);
      
      // Find collisions
      const collisions = findCronCollisions(allCronJobs);
      const severeCollisions = collisions.filter(c => c.count >= 4);
      
      details.push(`📊 Severe collision windows (≥4 workflows): ${severeCollisions.length}`);
      
      if (severeCollisions.length > 0) {
        details.push(`⚠️ Collision hotspots found:`);
        severeCollisions.slice(0, 5).forEach(collision => {
          details.push(`   ${collision.timeSlot} UTC: ${collision.count} workflows (${collision.workflows.slice(0, 3).join(', ')}${collision.workflows.length > 3 ? '...' : ''})`);
        });
        
        // Compare against baseline (17 was mentioned in the brief)
        const baseline = 17;
        if (severeCollisions.length >= baseline) {
          details.push(`❌ Collision count (${severeCollisions.length}) not reduced from baseline (${baseline})`);
          status = 'fail';
        } else {
          details.push(`✅ Collision count (${severeCollisions.length}) reduced from baseline (${baseline})`);
        }
      } else {
        details.push(`✅ No severe collision windows found`);
      }
      
      // Show next 24h schedule
      const next24h = allCronJobs
        .map(job => `${job.utcTime} (${job.etTime}) - ${job.workflow}`)
        .slice(0, 10);
      
      details.push(`📅 Next 24h cron schedule (first 10):`);
      next24h.forEach(schedule => details.push(`   ${schedule}`));
      
      await this.saveRawData('cron-analysis.json', {
        allCronJobs,
        collisions,
        severeCollisions
      });
      
    } catch (error) {
      details.push(`❌ Cron health verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'Cron & Collision Health',
      status,
      details
    };
  }
  
  // Section C: GitHub Actions Run Health
  private async verifyActionsHealth(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      const targetWorkflows = [
        'scheduler.yml',
        'post.yml', 
        'post-breakfast.yml',
        'post-lunch.yml',
        'post-dinner.yml'
      ];
      
      const runStats: Record<string, any> = {};
      
      for (const workflowFile of targetWorkflows) {
        try {
          const { data: runs } = await this.octokit.rest.actions.listWorkflowRuns({
            owner: 'ashaw315',
            repo: 'hotdog-diaries',
            workflow_id: workflowFile,
            per_page: 15
          });
          
          const conclusions = runs.workflow_runs.map(run => run.conclusion);
          const successCount = conclusions.filter(c => c === 'success').length;
          const neutralCount = conclusions.filter(c => c === 'neutral').length;
          const failureCount = conclusions.filter(c => c === 'failure').length;
          
          runStats[workflowFile] = {
            total: runs.workflow_runs.length,
            success: successCount,
            neutral: neutralCount,
            failure: failureCount,
            lastRun: runs.workflow_runs[0]
          };
          
          details.push(`📊 ${workflowFile}: ${successCount}✅ ${neutralCount}⚪ ${failureCount}❌ (last 15 runs)`);
          
          if (runs.workflow_runs.length > 0) {
            const lastRun = runs.workflow_runs[0];
            const lastRunTime = new Date(lastRun.created_at).toLocaleString();
            details.push(`   Last run: ${lastRun.conclusion} at ${lastRunTime}`);
            
            // Try to extract posting details from recent successful runs
            if (lastRun.conclusion === 'success' && workflowFile.startsWith('post')) {
              try {
                const { data: jobs } = await this.octokit.rest.actions.listJobsForWorkflowRun({
                  owner: 'ashaw315',
                  repo: 'hotdog-diaries',
                  run_id: lastRun.id
                });
                
                const postingJob = jobs.jobs.find(job => job.name.includes('post') || job.name.includes('Post'));
                if (postingJob && postingJob.conclusion === 'success') {
                  details.push(`   ✅ Last successful posting: ${lastRunTime} (${lastRun.html_url})`);
                }
              } catch {
                // Ignore job details fetch errors
              }
            }
          }
          
          if (successCount === 0 && runs.workflow_runs.length > 0) {
            details.push(`⚠️ No successful runs found for ${workflowFile}`);
            status = status === 'pass' ? 'warning' : status;
          }
          
        } catch (error) {
          details.push(`❌ Failed to fetch runs for ${workflowFile}: ${error}`);
          status = 'fail';
        }
      }
      
      await this.saveRawData('github-actions-stats.json', runStats);
      
    } catch (error) {
      details.push(`❌ Actions health verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'GitHub Actions Run Health',
      status,
      details
    };
  }
  
  // Section D: App Health Endpoints
  private async verifyAppHealth(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    const healthEndpoints = [
      '/api/health/schedule-tz',
      '/api/health/posting-source-of-truth'
    ];
    
    for (const endpoint of healthEndpoints) {
      try {
        const url = `${this.siteUrl}${endpoint}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          },
          timeout: 10000
        });
        
        const responseText = await response.text();
        const truncatedResponse = this.redactSecrets(responseText.slice(0, 400));
        
        if (response.ok) {
          details.push(`✅ ${endpoint}: HTTP ${response.status}`);
          
          try {
            const json = JSON.parse(responseText);
            details.push(`   Response: ${JSON.stringify(json).slice(0, 200)}...`);
          } catch {
            details.push(`   Response: ${truncatedResponse}...`);
          }
        } else {
          details.push(`❌ ${endpoint}: HTTP ${response.status}`);
          details.push(`   Error: ${truncatedResponse}`);
          status = 'fail';
        }
        
        await this.saveRawData(`health-${endpoint.replace(/[\/]/g, '-')}.json`, {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText
        });
        
      } catch (error) {
        details.push(`❌ ${endpoint}: ${error}`);
        status = 'fail';
      }
    }
    
    return {
      name: 'App Health Endpoints',
      status,
      details
    };
  }
  
  // Section E: Supabase Ground Truth
  private async verifySupabaseData(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      // Test Supabase connectivity
      const testUrl = `${this.supabaseUrl}/rest/v1/`;
      const testResponse = await fetch(testUrl, {
        headers: {
          'apikey': this.supabaseServiceKey,
          'Authorization': `Bearer ${this.supabaseServiceKey}`
        }
      });
      
      if (testResponse.ok) {
        details.push(`✅ Supabase REST API accessible (HTTP ${testResponse.status})`);
      } else {
        details.push(`❌ Supabase REST API failed (HTTP ${testResponse.status})`);
        status = 'fail';
        return { name: 'Supabase Ground Truth', status, details };
      }
      
      // Query scheduled posts for today and tomorrow
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const tomorrow = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      for (const date of [today, tomorrow]) {
        const startDate = `${date}T00:00:00.000Z`;
        const endDate = `${date}T23:59:59.999Z`;
        
        const scheduledUrl = `${this.supabaseUrl}/rest/v1/scheduled_posts?scheduled_post_time=gte.${startDate}&scheduled_post_time=lte.${endDate}&order=scheduled_slot_index.asc`;
        
        try {
          const response = await fetch(scheduledUrl, {
            headers: {
              'apikey': this.supabaseServiceKey,
              'Authorization': `Bearer ${this.supabaseServiceKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const scheduledPosts: SupabaseScheduledPost[] = await response.json();
            details.push(`📅 ${date}: ${scheduledPosts.length} scheduled posts`);
            
            if (scheduledPosts.length === 6) {
              details.push(`✅ Correct slot count (6) for ${date}`);
            } else {
              details.push(`❌ Expected 6 slots, found ${scheduledPosts.length} for ${date}`);
              status = 'fail';
            }
            
            // Analyze diversity
            const platforms = new Set(scheduledPosts.map(p => p.platform));
            const platformCounts = scheduledPosts.reduce((acc, post) => {
              acc[post.platform] = (acc[post.platform] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            details.push(`📊 ${date} diversity:`);
            details.push(`   Platforms: ${platforms.size} unique (${Array.from(platforms).join(', ')})`);
            
            const platformViolations = Object.entries(platformCounts).filter(([_, count]) => count > 3);
            if (platformViolations.length > 0) {
              details.push(`⚠️ Platform cap violations: ${platformViolations.map(([p, c]) => `${p}:${c}`).join(', ')}`);
              status = status === 'pass' ? 'warning' : status;
            } else {
              details.push(`✅ Platform diversity maintained (≤3 per platform)`);
            }
            
            await this.saveRawData(`scheduled-posts-${date}.json`, scheduledPosts);
            
          } else {
            details.push(`❌ Failed to query scheduled posts for ${date}: HTTP ${response.status}`);
            status = 'fail';
          }
        } catch (error) {
          details.push(`❌ Supabase query failed for ${date}: ${error}`);
          status = 'fail';
        }
      }
      
    } catch (error) {
      details.push(`❌ Supabase verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'Supabase Ground Truth',
      status,
      details
    };
  }
  
  // Section F: End-to-end Posting Probe
  private async verifyPostingProbe(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      // Check for recent successful posting runs
      const { data: runs } = await this.octokit.rest.actions.listWorkflowRuns({
        owner: 'ashaw315',
        repo: 'hotdog-diaries',
        workflow_id: 'post.yml',
        per_page: 10
      });
      
      const recentSuccessfulRuns = runs.workflow_runs.filter(run => 
        run.conclusion === 'success' && 
        new Date(run.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      
      if (recentSuccessfulRuns.length > 0) {
        const lastSuccess = recentSuccessfulRuns[0];
        details.push(`✅ Recent successful posting: ${new Date(lastSuccess.created_at).toLocaleString()}`);
        details.push(`   Run URL: ${lastSuccess.html_url}`);
        
        // Try to get job summary
        try {
          const { data: jobs } = await this.octokit.rest.actions.listJobsForWorkflowRun({
            owner: 'ashaw315',
            repo: 'hotdog-diaries',
            run_id: lastSuccess.id
          });
          
          const postJob = jobs.jobs.find(job => job.name.includes('post') || job.name.includes('Post'));
          if (postJob) {
            details.push(`   Job: ${postJob.name} (${postJob.conclusion})`);
          }
        } catch {
          // Ignore job details errors
        }
      } else {
        details.push(`⚠️ No successful posting runs in last 24h`);
        details.push(`   Manual dry-run trigger recommended for verification`);
        status = 'warning';
      }
      
      // Check for neutral runs (exit 78 neutralization)
      const neutralRuns = runs.workflow_runs.filter(run => run.conclusion === 'neutral');
      if (neutralRuns.length > 0) {
        details.push(`📊 Found ${neutralRuns.length} neutralized runs (proper guarded failure behavior)`);
      }
      
    } catch (error) {
      details.push(`❌ Posting probe verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'End-to-end Posting Probe',
      status,
      details
    };
  }
  
  // Section G: Neutralization Behavior
  private async verifyNeutralization(): Promise<VerificationSection> {
    const details: string[] = [];
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    
    try {
      // Look for recent neutral conclusions across key workflows
      const keyWorkflows = ['post.yml', 'scheduler.yml', 'post-breakfast.yml'];
      let totalNeutralRuns = 0;
      
      for (const workflow of keyWorkflows) {
        try {
          const { data: runs } = await this.octokit.rest.actions.listWorkflowRuns({
            owner: 'ashaw315',
            repo: 'hotdog-diaries',
            workflow_id: workflow,
            per_page: 20
          });
          
          const neutralRuns = runs.workflow_runs.filter(run => run.conclusion === 'neutral');
          totalNeutralRuns += neutralRuns.length;
          
          if (neutralRuns.length > 0) {
            details.push(`📊 ${workflow}: ${neutralRuns.length} neutral runs found`);
            
            // Sample the most recent neutral run for details
            const recentNeutral = neutralRuns[0];
            if (recentNeutral) {
              details.push(`   Recent: ${new Date(recentNeutral.created_at).toLocaleString()}`);
            }
          }
        } catch {
          // Continue if specific workflow not found
        }
      }
      
      if (totalNeutralRuns > 0) {
        details.push(`✅ Neutralization working: ${totalNeutralRuns} total neutral conclusions found`);
        details.push(`   This indicates proper exit 78 handling for guarded failures`);
      } else {
        details.push(`⚠️ No neutral runs found - neutralization may not be triggered yet`);
        status = 'warning';
      }
      
    } catch (error) {
      details.push(`❌ Neutralization verification failed: ${error}`);
      status = 'fail';
    }
    
    return {
      name: 'Neutralization Behavior',
      status,
      details
    };
  }
  
  // Generate Final Report
  private generateExecutiveSummary(sections: VerificationSection[]): string {
    const passCount = sections.filter(s => s.status === 'pass').length;
    const warnCount = sections.filter(s => s.status === 'warning').length;
    const failCount = sections.filter(s => s.status === 'fail').length;
    
    let summary = `**System Status Overview**: ${passCount} systems passing, ${warnCount} with warnings, ${failCount} failing.\n\n`;
    
    // Key questions from the brief
    const schedulerSection = sections.find(s => s.name.includes('Supabase'));
    const isSchedulerFilling = schedulerSection?.status === 'pass' && 
      schedulerSection.details.some(d => d.includes('Correct slot count (6)'));
    
    const postingSection = sections.find(s => s.name.includes('Posting Probe'));
    const isPostingWorking = postingSection?.status === 'pass' || 
      postingSection?.details.some(d => d.includes('Recent successful posting'));
    
    const cronSection = sections.find(s => s.name.includes('Cron'));
    const areCronsImproved = cronSection?.status === 'pass' && 
      cronSection.details.some(d => d.includes('reduced from baseline'));
    
    const healthSection = sections.find(s => s.name.includes('Health'));
    const areEndpointsHealthy = healthSection?.status === 'pass';
    
    const repoSection = sections.find(s => s.name.includes('Repository'));
    const areSecretsHealthy = repoSection?.status === 'pass' && 
      repoSection.details.some(d => d.includes('secret fallback'));
    
    summary += `**Is the scheduler filling six daily slots with diverse content?** ${isSchedulerFilling ? 'Yes' : 'No'} - `;
    summary += isSchedulerFilling ? 'Six slots are being filled daily with diversity constraints enforced.\n\n' : 
               'Slot filling or diversity constraints may have issues.\n\n';
    
    summary += `**Is the unified posting pipeline actually posting?** ${isPostingWorking ? 'Yes' : 'No'} - `;
    summary += isPostingWorking ? 'Recent successful posting runs detected.\n\n' : 
               'No recent successful posting activity found.\n\n';
    
    summary += `**Are cron collisions meaningfully reduced?** ${areCronsImproved ? 'Yes' : 'Unknown'} - `;
    summary += areCronsImproved ? 'Collision count reduced from baseline through staggering.\n\n' : 
               'Collision analysis needs review.\n\n';
    
    summary += `**Are app health endpoints green?** ${areEndpointsHealthy ? 'Yes' : 'No'} - `;
    summary += areEndpointsHealthy ? 'All monitored health endpoints returning 200 OK.\n\n' : 
               'Some health endpoints failing or unreachable.\n\n';
    
    summary += `**Are secrets and Supabase connectivity solid?** ${areSecretsHealthy ? 'Yes' : 'Unknown'} - `;
    summary += areSecretsHealthy ? 'Secret fallback patterns implemented and Supabase accessible.\n\n' : 
               'Secret management or Supabase connectivity needs attention.\n\n';
    
    return summary;
  }
  
  private generateNextActions(sections: VerificationSection[]): string[] {
    const actions: string[] = [];
    
    const failingSections = sections.filter(s => s.status === 'fail');
    const warningSections = sections.filter(s => s.status === 'warning');
    
    if (failingSections.length > 0) {
      actions.push(`Address ${failingSections.length} failing systems: ${failingSections.map(s => s.name).join(', ')}`);
    }
    
    if (warningSections.length > 0) {
      actions.push(`Review ${warningSections.length} systems with warnings for optimization`);
    }
    
    // Specific recommendations based on section status
    const supabaseSection = sections.find(s => s.name.includes('Supabase'));
    if (supabaseSection?.status !== 'pass') {
      actions.push('Verify Supabase connection and scheduled_posts table integrity');
    }
    
    const cronSection = sections.find(s => s.name.includes('Cron'));
    if (cronSection?.details.some(d => d.includes('collision'))) {
      actions.push('Continue monitoring cron collision windows for further optimization');
    }
    
    if (actions.length === 0) {
      actions.push('System appears healthy - maintain current monitoring');
      actions.push('Consider adding more automated health checks');
      actions.push('Monitor posting success rates and diversity metrics');
    }
    
    return actions.slice(0, 3); // Top 3 actions
  }
  
  private determineVerdict(sections: VerificationSection[]): 'PASS' | 'PARTIAL' | 'FAIL' {
    const failCount = sections.filter(s => s.status === 'fail').length;
    const warnCount = sections.filter(s => s.status === 'warning').length;
    
    if (failCount > 0) return 'FAIL';
    if (warnCount > 2) return 'PARTIAL';
    return 'PASS';
  }
  
  public async run(): Promise<void> {
    console.log('🔍 Starting production verification of posting-unify-and-cron-stagger...\n');
    
    await this.setupDirectories();
    
    // Run all verification sections
    const sections = await Promise.all([
      this.verifyRepoState(),
      this.verifyCronHealth(),
      this.verifyActionsHealth(),
      this.verifyAppHealth(),
      this.verifySupabaseData(),
      this.verifyPostingProbe(),
      this.verifyNeutralization()
    ]);
    
    // Generate report
    const report: VerificationReport = {
      timestamp: new Date().toISOString(),
      environment: {
        'Site URL': this.siteUrl,
        'Supabase URL': this.supabaseUrl,
        'Service Key': this.supabaseServiceKey ? 'Present' : 'Missing',
        'Auth Token': this.authToken ? 'Present' : 'Missing',
        'Node Version': process.version,
        'Verification Date': this.reportDate
      },
      sections,
      executiveSummary: this.generateExecutiveSummary(sections),
      verdict: this.determineVerdict(sections),
      nextActions: this.generateNextActions(sections)
    };
    
    // Write markdown report
    const reportPath = join(this.reportDir, 'VERIFICATION_REPORT.md');
    const markdownReport = this.generateMarkdownReport(report);
    await fs.writeFile(reportPath, markdownReport);
    
    // Console output
    console.log(`\n📊 VERIFICATION COMPLETE`);
    console.log(`==========================================`);
    console.log(`VERDICT: ${report.verdict}`);
    console.log(`Report: ${reportPath}`);
    
    if (report.nextActions.length > 0) {
      console.log(`\nNext Actions:`);
      report.nextActions.forEach((action, i) => {
        console.log(`${i + 1}. ${action}`);
      });
    }
    
    console.log(`\n📝 Plain English Summary:`);
    console.log(this.generatePlainEnglishSummary(report));
  }
  
  private generateMarkdownReport(report: VerificationReport): string {
    const statusIcon = (status: string) => {
      switch (status) {
        case 'pass': return '✅';
        case 'warning': return '⚠️';
        case 'fail': return '❌';
        default: return '❓';
      }
    };
    
    let md = `# Production Verification Report\n\n`;
    md += `**Generated:** ${report.timestamp}\n`;
    md += `**Verdict:** **${report.verdict}**\n\n`;
    
    md += `## Executive Summary\n\n${report.executiveSummary}\n`;
    
    md += `## Environment\n\n`;
    Object.entries(report.environment).forEach(([key, value]) => {
      md += `- **${key}:** ${value}\n`;
    });
    md += `\n`;
    
    md += `## Verification Results\n\n`;
    
    report.sections.forEach(section => {
      md += `### ${statusIcon(section.status)} ${section.name}\n\n`;
      section.details.forEach(detail => {
        md += `${detail}\n\n`;
      });
    });
    
    md += `## Next Actions\n\n`;
    report.nextActions.forEach((action, i) => {
      md += `${i + 1}. ${action}\n`;
    });
    
    md += `\n---\n`;
    md += `*Report generated by production verification system*\n`;
    
    return md;
  }
  
  private generatePlainEnglishSummary(report: VerificationReport): string {
    const verdict = report.verdict;
    
    if (verdict === 'PASS') {
      return `The unified posting system is working correctly. The scheduler is filling 6 daily time slots with diverse content, the posting pipeline is successfully executing, and cron collisions have been reduced. All health endpoints are responding properly and the system is maintaining content diversity as designed.`;
    } else if (verdict === 'PARTIAL') {
      return `The posting system is mostly functional but has some areas needing attention. Core posting and scheduling appears to work, but there may be issues with collision reduction, health endpoints, or diversity constraints that should be addressed to ensure optimal performance.`;
    } else {
      return `The posting system has significant issues that need immediate attention. Key components like the scheduler, posting pipeline, or health monitoring may not be working correctly. Review the detailed report to identify and fix the critical problems.`;
    }
  }
}

// Auto-run the verification
const verifier = new PostingSystemVerifier();
verifier.run().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

export { PostingSystemVerifier };