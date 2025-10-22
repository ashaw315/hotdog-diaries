#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

interface WorkflowTrigger {
  event: string;
  config?: any;
  cron?: string[];
}

interface WorkflowJob {
  name: string;
  needs?: string[];
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  uses?: string;
  steps?: any[];
  'runs-on'?: string;
  'timeout-minutes'?: number;
  concurrency?: any;
}

interface WorkflowData {
  path: string;
  filename: string;
  name: string;
  triggers: WorkflowTrigger[];
  jobs: Record<string, WorkflowJob>;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  concurrency?: any;
  secrets_refs: string[];
  vars_refs: string[];
  composite_actions: string[];
  reusable_workflows: string[];
  job_count: number;
  error?: string;
}

function extractSecretVarRefs(obj: any): { secrets: string[], vars: string[] } {
  const secrets = new Set<string>();
  const vars = new Set<string>();
  
  function recurse(value: any) {
    if (typeof value === 'string') {
      // Match ${{ secrets.SECRET_NAME }} patterns
      const secretMatches = value.match(/\$\{\{\s*secrets\.([A-Z_0-9]+)/g);
      if (secretMatches) {
        secretMatches.forEach(match => {
          const name = match.replace(/\$\{\{\s*secrets\./, '').replace(/\s*\}\}/, '');
          secrets.add(name);
        });
      }
      
      // Match ${{ vars.VAR_NAME }} patterns
      const varMatches = value.match(/\$\{\{\s*vars\.([A-Z_0-9]+)/g);
      if (varMatches) {
        varMatches.forEach(match => {
          const name = match.replace(/\$\{\{\s*vars\./, '').replace(/\s*\}\}/, '');
          vars.add(name);
        });
      }
    } else if (Array.isArray(value)) {
      value.forEach(recurse);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(recurse);
    }
  }
  
  recurse(obj);
  return { secrets: Array.from(secrets), vars: Array.from(vars) };
}

function extractCompositeAndReusableRefs(workflow: any): { composite: string[], reusable: string[] } {
  const composite = new Set<string>();
  const reusable = new Set<string>();
  
  function scanSteps(steps: any[]) {
    if (!steps) return;
    
    for (const step of steps) {
      if (step.uses) {
        if (step.uses.startsWith('./.github/actions/')) {
          composite.add(step.uses);
        } else if (step.uses.startsWith('./.github/workflows/')) {
          reusable.add(step.uses);
        }
      }
    }
  }
  
  if (workflow.jobs) {
    for (const job of Object.values(workflow.jobs) as any[]) {
      if (job.uses && job.uses.startsWith('./.github/workflows/')) {
        reusable.add(job.uses);
      }
      if (job.steps) {
        scanSteps(job.steps);
      }
    }
  }
  
  return { composite: Array.from(composite), reusable: Array.from(reusable) };
}

function parseTriggers(on: any): WorkflowTrigger[] {
  const triggers: WorkflowTrigger[] = [];
  
  if (typeof on === 'string') {
    triggers.push({ event: on });
  } else if (Array.isArray(on)) {
    on.forEach(event => triggers.push({ event }));
  } else if (on && typeof on === 'object') {
    for (const [event, config] of Object.entries(on)) {
      if (event === 'schedule' && Array.isArray(config)) {
        const cron = config.map((c: any) => c.cron).filter(Boolean);
        triggers.push({ event, config, cron });
      } else {
        triggers.push({ event, config });
      }
    }
  }
  
  return triggers;
}

function scanWorkflows(): WorkflowData[] {
  const workflowsDir = '.github/workflows';
  const results: WorkflowData[] = [];
  
  try {
    const files = readdirSync(workflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .sort();
    
    for (const filename of files) {
      const path = join(workflowsDir, filename);
      
      try {
        const content = readFileSync(path, 'utf8');
        const workflow = load(content) as any;
        
        if (!workflow) {
          results.push({
            path,
            filename,
            name: 'PARSE_ERROR',
            triggers: [],
            jobs: {},
            secrets_refs: [],
            vars_refs: [],
            composite_actions: [],
            reusable_workflows: [],
            job_count: 0,
            error: 'Failed to parse YAML'
          });
          continue;
        }
        
        const { secrets, vars } = extractSecretVarRefs(workflow);
        const { composite, reusable } = extractCompositeAndReusableRefs(workflow);
        
        results.push({
          path,
          filename,
          name: workflow.name || filename.replace(/\.(yml|yaml)$/, ''),
          triggers: parseTriggers(workflow.on),
          jobs: workflow.jobs || {},
          permissions: workflow.permissions,
          env: workflow.env,
          concurrency: workflow.concurrency,
          secrets_refs: secrets,
          vars_refs: vars,
          composite_actions: composite,
          reusable_workflows: reusable,
          job_count: Object.keys(workflow.jobs || {}).length
        });
        
      } catch (error) {
        results.push({
          path,
          filename,
          name: 'ERROR',
          triggers: [],
          jobs: {},
          secrets_refs: [],
          vars_refs: [],
          composite_actions: [],
          reusable_workflows: [],
          job_count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
  } catch (error) {
    console.error('Failed to read workflows directory:', error);
    process.exit(1);
  }
  
  return results;
}

function scanCompositeActions(): any[] {
  const actionsDir = '.github/actions';
  const results: any[] = [];
  
  try {
    const subdirs = readdirSync(actionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();
    
    for (const dirname of subdirs) {
      const actionPath = join(actionsDir, dirname, 'action.yml');
      const altActionPath = join(actionsDir, dirname, 'action.yaml');
      
      let content: string;
      let finalPath: string;
      
      try {
        content = readFileSync(actionPath, 'utf8');
        finalPath = actionPath;
      } catch {
        try {
          content = readFileSync(altActionPath, 'utf8');
          finalPath = altActionPath;
        } catch {
          results.push({
            path: `${actionsDir}/${dirname}`,
            name: dirname,
            error: 'No action.yml or action.yaml found'
          });
          continue;
        }
      }
      
      try {
        const action = load(content) as any;
        const { secrets, vars } = extractSecretVarRefs(action);
        
        results.push({
          path: finalPath,
          name: action.name || dirname,
          description: action.description,
          inputs: action.inputs,
          outputs: action.outputs,
          runs: action.runs,
          secrets_refs: secrets,
          vars_refs: vars
        });
        
      } catch (error) {
        results.push({
          path: finalPath,
          name: dirname,
          error: error instanceof Error ? error.message : 'Parse error'
        });
      }
    }
    
  } catch (error) {
    console.log('No .github/actions directory found or error reading it');
  }
  
  return results;
}

async function main() {
  console.log('🔍 Scanning GitHub Actions workflows and composite actions...');
  
  const workflows = scanWorkflows();
  const compositeActions = scanCompositeActions();
  
  const output = {
    scan_timestamp: new Date().toISOString(),
    workflows,
    composite_actions: compositeActions,
    summary: {
      workflow_count: workflows.length,
      composite_action_count: compositeActions.length,
      total_jobs: workflows.reduce((sum, w) => sum + w.job_count, 0),
      workflows_with_schedule: workflows.filter(w => 
        w.triggers.some(t => t.event === 'schedule')
      ).length,
      workflows_with_errors: workflows.filter(w => w.error).length
    }
  };
  
  // Write to data directory
  const outputPath = 'ci_audit/workflow_map/data/workflows.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Workflow scan complete`);
  console.log(`📊 Summary:`);
  console.log(`   - Workflows: ${output.summary.workflow_count}`);
  console.log(`   - Composite Actions: ${output.summary.composite_action_count}`);
  console.log(`   - Total Jobs: ${output.summary.total_jobs}`);
  console.log(`   - Scheduled Workflows: ${output.summary.workflows_with_schedule}`);
  console.log(`   - Parse Errors: ${output.summary.workflows_with_errors}`);
  console.log(`📁 Data saved to: ${outputPath}`);
  
  if (output.summary.workflows_with_errors > 0) {
    console.log('\n⚠️  Workflows with errors:');
    workflows.filter(w => w.error).forEach(w => {
      console.log(`   - ${w.filename}: ${w.error}`);
    });
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}