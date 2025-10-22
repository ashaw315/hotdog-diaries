#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

interface TopologyData {
  generated_at: string;
  mermaid_content: string;
  summary: {
    workflow_nodes: number;
    composite_action_nodes: number;
    reusable_workflow_nodes: number;
    total_edges: number;
    key_workflows_with_job_dag: string[];
  };
}

function generateWorkflowTopology(): TopologyData {
  const workflowData = JSON.parse(readFileSync('ci_audit/workflow_map/data/workflows.json', 'utf8'));
  
  let mermaidContent = 'graph TB\n';
  let edgeCount = 0;
  
  // Define key workflows that need detailed job DAGs
  const keyWorkflows = ['scheduler', 'prod-watchdog', 'deploy-gate', 'post-deploy-check', 'posting'];
  const keyWorkflowsFound: string[] = [];
  
  // Add workflow nodes
  mermaidContent += '\n    %% Workflows\n';
  for (const workflow of workflowData.workflows) {
    const safeId = workflow.filename.replace(/[^a-zA-Z0-9]/g, '_');
    const displayName = workflow.name.length > 20 ? workflow.name.substring(0, 17) + '...' : workflow.name;
    mermaidContent += `    ${safeId}["🔄 ${displayName}"]\n`;
    
    // Mark as key workflow if it matches
    if (keyWorkflows.some(key => workflow.name.toLowerCase().includes(key) || workflow.filename.includes(key))) {
      keyWorkflowsFound.push(workflow.name);
      mermaidContent += `    ${safeId} --> ${safeId}_jobs["📋 Jobs"]\n`;
      edgeCount++;
    }
  }
  
  // Add composite action nodes
  mermaidContent += '\n    %% Composite Actions\n';
  const compositeActions = new Set<string>();
  for (const action of workflowData.composite_actions) {
    if (action.name && !action.error) {
      const safeId = action.name.replace(/[^a-zA-Z0-9]/g, '_') + '_action';
      const displayName = action.name.length > 15 ? action.name.substring(0, 12) + '...' : action.name;
      mermaidContent += `    ${safeId}["⚙️ ${displayName}"]\n`;
      compositeActions.add(safeId);
    }
  }
  
  // Add reusable workflow nodes
  mermaidContent += '\n    %% Reusable Workflows\n';
  const reusableWorkflows = new Set<string>();
  
  // Add workflow -> composite action edges
  mermaidContent += '\n    %% Workflow to Composite Action Dependencies\n';
  for (const workflow of workflowData.workflows) {
    const workflowId = workflow.filename.replace(/[^a-zA-Z0-9]/g, '_');
    
    for (const compositeRef of workflow.composite_actions) {
      const actionName = compositeRef.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_');
      if (actionName) {
        const actionId = actionName + '_action';
        mermaidContent += `    ${workflowId} --> ${actionId}\n`;
        edgeCount++;
      }
    }
    
    for (const reusableRef of workflow.reusable_workflows) {
      const reusableName = reusableRef.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_');
      if (reusableName) {
        const reusableId = reusableName + '_reusable';
        if (!reusableWorkflows.has(reusableId)) {
          const displayName = reusableName.length > 15 ? reusableName.substring(0, 12) + '...' : reusableName;
          mermaidContent += `    ${reusableId}["🔄 ${displayName} (reusable)"]\n`;
          reusableWorkflows.add(reusableId);
        }
        mermaidContent += `    ${workflowId} --> ${reusableId}\n`;
        edgeCount++;
      }
    }
  }
  
  // Add job-level DAGs for key workflows
  mermaidContent += '\n    %% Job Dependencies for Key Workflows\n';
  for (const workflow of workflowData.workflows) {
    if (keyWorkflows.some(key => workflow.name.toLowerCase().includes(key) || workflow.filename.includes(key))) {
      const workflowId = workflow.filename.replace(/[^a-zA-Z0-9]/g, '_');
      const jobIds: string[] = [];
      
      // Add job nodes
      for (const [jobName, jobData] of Object.entries(workflow.jobs)) {
        const jobId = `${workflowId}_${jobName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const displayName = jobName.length > 12 ? jobName.substring(0, 9) + '...' : jobName;
        mermaidContent += `    ${jobId}["📝 ${displayName}"]\n`;
        jobIds.push(jobId);
        
        // Connect to workflow jobs container
        mermaidContent += `    ${workflowId}_jobs --> ${jobId}\n`;
        edgeCount++;
      }
      
      // Add job dependency edges
      for (const [jobName, jobData] of Object.entries(workflow.jobs) as [string, any][]) {
        const jobId = `${workflowId}_${jobName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        if (jobData.needs) {
          const needs = Array.isArray(jobData.needs) ? jobData.needs : [jobData.needs];
          for (const dependency of needs) {
            const depJobId = `${workflowId}_${dependency.replace(/[^a-zA-Z0-9]/g, '_')}`;
            mermaidContent += `    ${depJobId} --> ${jobId}\n`;
            edgeCount++;
          }
        }
      }
    }
  }
  
  // Add styling
  mermaidContent += '\n    %% Styling\n';
  mermaidContent += '    classDef workflow fill:#e1f5fe,stroke:#01579b,stroke-width:2px\n';
  mermaidContent += '    classDef action fill:#f3e5f5,stroke:#4a148c,stroke-width:2px\n';
  mermaidContent += '    classDef job fill:#e8f5e8,stroke:#1b5e20,stroke-width:1px\n';
  mermaidContent += '    classDef reusable fill:#fff3e0,stroke:#e65100,stroke-width:2px\n';
  
  // Apply classes
  for (const workflow of workflowData.workflows) {
    const safeId = workflow.filename.replace(/[^a-zA-Z0-9]/g, '_');
    mermaidContent += `    class ${safeId} workflow\n`;
  }
  
  return {
    generated_at: new Date().toISOString(),
    mermaid_content: mermaidContent,
    summary: {
      workflow_nodes: workflowData.workflows.length,
      composite_action_nodes: compositeActions.size,
      reusable_workflow_nodes: reusableWorkflows.size,
      total_edges: edgeCount,
      key_workflows_with_job_dag: keyWorkflowsFound,
    },
  };
}

async function main() {
  console.log('🌐 Generating workflow topology graph...');
  
  try {
    const topology = generateWorkflowTopology();
    
    // Save data
    const dataPath = 'ci_audit/workflow_map/data/topology.json';
    writeFileSync(dataPath, JSON.stringify(topology, null, 2));
    
    // Save Mermaid file
    const mermaidPath = 'ci_audit/workflow_map/TOPOLOGY.mmd';
    writeFileSync(mermaidPath, topology.mermaid_content);
    
    console.log(`✅ Topology graph generated`);
    console.log(`📊 Summary:`);
    console.log(`   - Workflow nodes: ${topology.summary.workflow_nodes}`);
    console.log(`   - Composite action nodes: ${topology.summary.composite_action_nodes}`);
    console.log(`   - Reusable workflow nodes: ${topology.summary.reusable_workflow_nodes}`);
    console.log(`   - Total edges: ${topology.summary.total_edges}`);
    console.log(`   - Key workflows with job DAG: ${topology.summary.key_workflows_with_job_dag.join(', ')}`);
    console.log(`📁 Data saved to: ${dataPath}`);
    console.log(`📁 Mermaid graph saved to: ${mermaidPath}`);
    
  } catch (error) {
    console.error('❌ Failed to generate topology:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}