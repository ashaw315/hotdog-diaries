#!/usr/bin/env tsx
/**
 * Wait for GitHub checks to complete
 * Usage: tsx wait-for-checks.ts --sha <SHA> --targets "check1" "check2" --timeout 12m
 */

import { Octokit } from '@octokit/rest';
import { Command } from 'commander';

const program = new Command();

program
  .requiredOption('--sha <sha>', 'Git SHA to check')
  .requiredOption('--targets <targets...>', 'Check name patterns to wait for')
  .option('--timeout <timeout>', 'Timeout duration (e.g., 12m, 600s)', '12m')
  .option('--repo <repo>', 'Repository in format owner/repo', process.env.GITHUB_REPOSITORY || 'ashaw315/hotdog-diaries')
  .option('--interval <interval>', 'Poll interval in seconds', '15')
  .parse();

const options = program.opts();

// Parse timeout to milliseconds
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)([sm])$/);
  if (!match) throw new Error(`Invalid timeout format: ${timeout}`);
  const value = parseInt(match[1]);
  const unit = match[2];
  return unit === 'm' ? value * 60 * 1000 : value * 1000;
}

// Format date for display
function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toISOString().replace('T', ' ').slice(0, 19);
}

// Check status colors for terminal
function getStatusColor(conclusion: string | null): string {
  switch (conclusion) {
    case 'success': return '\x1b[32m'; // green
    case 'failure': return '\x1b[31m'; // red
    case 'cancelled': return '\x1b[33m'; // yellow
    case 'neutral': return '\x1b[36m'; // cyan
    case 'skipped': return '\x1b[90m'; // gray
    default: return '\x1b[0m'; // reset
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  const [owner, repo] = options.repo.split('/');
  const targets = Array.isArray(options.targets) ? options.targets : [options.targets];
  const timeout = parseTimeout(options.timeout);
  const pollInterval = parseInt(options.interval) * 1000;
  const startTime = Date.now();

  console.log(`\n📊 Waiting for checks on SHA: ${options.sha}`);
  console.log(`⏱️  Timeout: ${options.timeout}`);
  console.log(`🎯 Target checks: ${targets.join(', ')}\n`);

  // Track check states
  const checkStates = new Map<string, any>();

  while (Date.now() - startTime < timeout) {
    try {
      // Fetch all check runs for the commit
      const { data: checkRuns } = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: options.sha,
        per_page: 100
      });

      // Update check states for matching targets
      for (const target of targets) {
        const matchingChecks = checkRuns.check_runs.filter(check =>
          check.name.includes(target) || target.includes(check.name)
        );

        for (const check of matchingChecks) {
          checkStates.set(check.name, {
            name: check.name,
            conclusion: check.conclusion,
            status: check.status,
            started_at: check.started_at,
            completed_at: check.completed_at,
            html_url: check.html_url
          });
        }
      }

      // Print status table
      console.clear();
      console.log(`\n📊 Check Status Report (SHA: ${options.sha.slice(0, 8)})`);
      console.log(`⏱️  Elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s / ${options.timeout}\n`);
      console.log('═'.repeat(120));
      console.log('Name'.padEnd(50) + 'Conclusion'.padEnd(15) + 'Started'.padEnd(22) + 'Completed'.padEnd(22) + 'URL');
      console.log('─'.repeat(120));

      let allCompleted = true;
      let anyFailed = false;

      for (const target of targets) {
        let found = false;
        for (const [name, state] of checkStates.entries()) {
          if (name.includes(target) || target.includes(name)) {
            found = true;
            const color = getStatusColor(state.conclusion);
            const reset = '\x1b[0m';
            
            console.log(
              name.slice(0, 49).padEnd(50) +
              (color + (state.conclusion || state.status).padEnd(15) + reset) +
              formatDate(state.started_at).padEnd(22) +
              formatDate(state.completed_at).padEnd(22) +
              (state.html_url || 'N/A')
            );

            if (!state.conclusion || state.status === 'in_progress' || state.status === 'queued') {
              allCompleted = false;
            }
            if (state.conclusion === 'failure') {
              anyFailed = true;
            }
          }
        }

        if (!found) {
          console.log(
            target.slice(0, 49).padEnd(50) +
            '\x1b[90mNot found\x1b[0m'.padEnd(15 + 9) + // +9 for color codes
            'N/A'.padEnd(22) +
            'N/A'.padEnd(22) +
            'N/A'
          );
          allCompleted = false;
        }
      }

      console.log('═'.repeat(120));

      // Check if all targets are completed
      if (allCompleted) {
        const foundTargets = targets.filter(target => 
          Array.from(checkStates.keys()).some(name => 
            name.includes(target) || target.includes(name)
          )
        );

        if (foundTargets.length === targets.length) {
          // All targets found and completed
          if (anyFailed) {
            console.log('\n❌ Some checks failed\n');
            process.exit(1);
          } else {
            // Check if all are success or neutral
            const allGood = Array.from(checkStates.values()).every(state =>
              state.conclusion === 'success' || state.conclusion === 'neutral' || state.conclusion === 'skipped'
            );
            
            if (allGood) {
              console.log('\n✅ All checks passed or are neutral\n');
              process.exit(0);
            } else {
              console.log('\n⚠️ Some checks have non-success conclusions\n');
              process.exit(1);
            }
          }
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error: any) {
      console.error(`Error fetching check runs: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout reached
  console.log('\n⏱️ Timeout reached. Final status:');
  
  let exitCode = 1;
  for (const [name, state] of checkStates.entries()) {
    if (state.conclusion === 'failure' || !state.conclusion) {
      console.log(`  ❌ ${name}: ${state.conclusion || 'incomplete'}`);
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});