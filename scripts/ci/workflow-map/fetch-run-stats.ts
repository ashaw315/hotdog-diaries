#!/usr/bin/env tsx

import { Octokit } from '@octokit/rest';
import { readFileSync, writeFileSync } from 'fs';

interface WorkflowRunStat {
  workflow_name: string;
  workflow_id: number;
  last_7_days: {
    total_runs: number;
    success: number;
    failure: number;
    cancelled: number;
    skipped: number;
    neutral: number;
    timed_out: number;
    action_required: number;
    stale: number;
  };
  last_non_success_runs: Array<{
    run_id: number;
    conclusion: string;
    status: string;
    created_at: string;
    html_url: string;
    head_branch: string;
    event: string;
  }>;
  most_common_failing_job?: string;
  last_success_date?: string;
  staleness_days: number;
}

interface RunStatsData {
  generated_at: string;
  repo: string;
  stats: WorkflowRunStat[];
  summary: {
    total_workflows_tracked: number;
    workflows_with_recent_failures: number;
    workflows_stale_30d: number;
    workflows_stale_60d: number;
    workflows_stale_90d: number;
  };
}

async function fetchWorkflowRuns(): Promise<RunStatsData> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  
  const owner = 'ashaw315';
  const repo = 'hotdog-diaries';
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  console.log('📊 Fetching workflow run statistics...');
  
  // First, get all workflows
  const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({
    owner,
    repo,
  });
  
  const stats: WorkflowRunStat[] = [];
  
  for (const workflow of workflows.workflows) {
    console.log(`   Analyzing: ${workflow.name}`);
    
    try {
      // Get runs for this workflow from the last 30 days (to check staleness)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflow.id,
        created: `>=${thirtyDaysAgo.toISOString().split('T')[0]}`,
        per_page: 100,
      });
      
      // Filter runs from last 7 days
      const recentRuns = runs.workflow_runs.filter(run => 
        new Date(run.created_at) >= sevenDaysAgo
      );
      
      // Count by conclusion
      const conclusionCounts = {
        total_runs: recentRuns.length,
        success: 0,
        failure: 0,
        cancelled: 0,
        skipped: 0,
        neutral: 0,
        timed_out: 0,
        action_required: 0,
        stale: 0,
      };
      
      for (const run of recentRuns) {
        const conclusion = run.conclusion || 'stale';
        if (conclusion in conclusionCounts) {
          (conclusionCounts as any)[conclusion]++;
        } else {
          conclusionCounts.stale++;
        }
      }
      
      // Find last 3 non-success runs
      const nonSuccessRuns = runs.workflow_runs
        .filter(run => run.conclusion !== 'success' && run.conclusion !== 'skipped')
        .slice(0, 3)
        .map(run => ({
          run_id: run.id,
          conclusion: run.conclusion || 'unknown',
          status: run.status,
          created_at: run.created_at,
          html_url: run.html_url,
          head_branch: run.head_branch || 'unknown',
          event: run.event,
        }));
      
      // Find last success date
      const lastSuccess = runs.workflow_runs.find(run => run.conclusion === 'success');
      const lastSuccessDate = lastSuccess?.created_at;
      
      // Calculate staleness
      const staleness = lastSuccessDate 
        ? Math.floor((Date.now() - new Date(lastSuccessDate).getTime()) / (1000 * 60 * 60 * 24))
        : runs.workflow_runs.length > 0 
          ? Math.floor((Date.now() - new Date(runs.workflow_runs[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999; // No runs at all
      
      stats.push({
        workflow_name: workflow.name,
        workflow_id: workflow.id,
        last_7_days: conclusionCounts,
        last_non_success_runs: nonSuccessRuns,
        last_success_date: lastSuccessDate,
        staleness_days: staleness,
      });
      
    } catch (error) {
      console.error(`   ❌ Error fetching runs for ${workflow.name}:`, error);
      
      // Add placeholder entry for failed workflows
      stats.push({
        workflow_name: workflow.name,
        workflow_id: workflow.id,
        last_7_days: {
          total_runs: 0,
          success: 0,
          failure: 0,
          cancelled: 0,
          skipped: 0,
          neutral: 0,
          timed_out: 0,
          action_required: 0,
          stale: 0,
        },
        last_non_success_runs: [],
        staleness_days: 999,
      });
    }
  }
  
  // Generate summary
  const summary = {
    total_workflows_tracked: stats.length,
    workflows_with_recent_failures: stats.filter(s => s.last_7_days.failure > 0).length,
    workflows_stale_30d: stats.filter(s => s.staleness_days >= 30).length,
    workflows_stale_60d: stats.filter(s => s.staleness_days >= 60).length,
    workflows_stale_90d: stats.filter(s => s.staleness_days >= 90).length,
  };
  
  return {
    generated_at: new Date().toISOString(),
    repo: `${owner}/${repo}`,
    stats,
    summary,
  };
}

async function main() {
  console.log('📈 Fetching GitHub Actions run statistics...');
  
  try {
    const runStats = await fetchWorkflowRuns();
    
    const outputPath = 'ci_audit/workflow_map/data/run_stats.json';
    writeFileSync(outputPath, JSON.stringify(runStats, null, 2));
    
    console.log(`✅ Run statistics collected`);
    console.log(`📊 Summary:`);
    console.log(`   - Total workflows: ${runStats.summary.total_workflows_tracked}`);
    console.log(`   - With recent failures: ${runStats.summary.workflows_with_recent_failures}`);
    console.log(`   - Stale 30+ days: ${runStats.summary.workflows_stale_30d}`);
    console.log(`   - Stale 60+ days: ${runStats.summary.workflows_stale_60d}`);
    console.log(`   - Stale 90+ days: ${runStats.summary.workflows_stale_90d}`);
    console.log(`📁 Data saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Failed to fetch run statistics:', error);
    
    // Create a minimal placeholder file
    const placeholder = {
      generated_at: new Date().toISOString(),
      repo: 'ashaw315/hotdog-diaries',
      stats: [],
      summary: {
        total_workflows_tracked: 0,
        workflows_with_recent_failures: 0,
        workflows_stale_30d: 0,
        workflows_stale_60d: 0,
        workflows_stale_90d: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    const outputPath = 'ci_audit/workflow_map/data/run_stats.json';
    writeFileSync(outputPath, JSON.stringify(placeholder, null, 2));
    console.log(`📁 Placeholder data saved to: ${outputPath}`);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}