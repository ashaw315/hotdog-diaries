#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

interface SimilarityMatch {
  workflow_a: string;
  workflow_b: string;
  similarity_score: number;
  common_elements: {
    triggers: string[];
    jobs: string[];
    secrets: string[];
    permissions: string[];
    steps: string[];
  };
  differences: {
    trigger_differences: string[];
    job_differences: string[];
    step_differences: string[];
  };
  consolidation_potential: 'high' | 'medium' | 'low';
}

interface RedundantPattern {
  pattern_type: 'trigger_duplication' | 'job_similarity' | 'step_similarity' | 'secret_overlap';
  pattern_name: string;
  affected_workflows: string[];
  description: string;
  consolidation_suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

interface ConsolidationOpportunity {
  opportunity_type: 'merge_workflows' | 'extract_reusable' | 'create_composite' | 'schedule_optimization';
  title: string;
  affected_workflows: string[];
  description: string;
  estimated_complexity: 'low' | 'medium' | 'high';
  potential_savings: string;
  implementation_steps: string[];
}

interface DuplicationReport {
  generated_at: string;
  similarity_matches: SimilarityMatch[];
  redundant_patterns: RedundantPattern[];
  consolidation_opportunities: ConsolidationOpportunity[];
  summary: {
    total_workflow_pairs_analyzed: number;
    high_similarity_matches: number;
    redundant_patterns_found: number;
    consolidation_opportunities: number;
    potential_workflow_reduction: string;
    golden_path_recommendation: string[];
  };
}

function calculateWorkflowSimilarity(workflowA: any, workflowB: any): SimilarityMatch {
  // Extract comparable elements
  const triggersA = new Set(workflowA.triggers.map((t: any) => t.event));
  const triggersB = new Set(workflowB.triggers.map((t: any) => t.event));
  
  const jobsA = new Set(Object.keys(workflowA.jobs));
  const jobsB = new Set(Object.keys(workflowB.jobs));
  
  const secretsA = new Set(workflowA.secrets_refs);
  const secretsB = new Set(workflowB.secrets_refs);
  
  const permissionsA = new Set(Object.keys(workflowA.permissions || {}));
  const permissionsB = new Set(Object.keys(workflowB.permissions || {}));
  
  // Extract step patterns
  const stepsA = new Set<string>();
  const stepsB = new Set<string>();
  
  for (const job of Object.values(workflowA.jobs) as any[]) {
    if (job.steps) {
      job.steps.forEach((step: any) => {
        if (step.uses) stepsA.add(step.uses);
        if (step.run) {
          // Normalize run commands for comparison
          const normalized = step.run.replace(/\$\{\{[^}]+\}\}/g, '{{VAR}}').trim();
          stepsA.add(`run:${normalized.substring(0, 50)}`);
        }
      });
    }
  }
  
  for (const job of Object.values(workflowB.jobs) as any[]) {
    if (job.steps) {
      job.steps.forEach((step: any) => {
        if (step.uses) stepsB.add(step.uses);
        if (step.run) {
          const normalized = step.run.replace(/\$\{\{[^}]+\}\}/g, '{{VAR}}').trim();
          stepsB.add(`run:${normalized.substring(0, 50)}`);
        }
      });
    }
  }
  
  // Calculate intersections
  const commonTriggers = Array.from(triggersA).filter(x => triggersB.has(x));
  const commonJobs = Array.from(jobsA).filter(x => jobsB.has(x));
  const commonSecrets = Array.from(secretsA).filter(x => secretsB.has(x));
  const commonPermissions = Array.from(permissionsA).filter(x => permissionsB.has(x));
  const commonSteps = Array.from(stepsA).filter(x => stepsB.has(x));
  
  // Calculate similarity score (weighted)
  const triggerSimilarity = commonTriggers.length / Math.max(triggersA.size, triggersB.size) * 0.3;
  const jobSimilarity = commonJobs.length / Math.max(jobsA.size, jobsB.size) * 0.2;
  const secretSimilarity = commonSecrets.length / Math.max(secretsA.size, secretsB.size) * 0.2;
  const permissionSimilarity = commonPermissions.length / Math.max(permissionsA.size, permissionsB.size) * 0.1;
  const stepSimilarity = commonSteps.length / Math.max(stepsA.size, stepsB.size) * 0.2;
  
  const similarityScore = triggerSimilarity + jobSimilarity + secretSimilarity + permissionSimilarity + stepSimilarity;
  
  // Determine consolidation potential
  let consolidationPotential: 'high' | 'medium' | 'low' = 'low';
  if (similarityScore > 0.7) consolidationPotential = 'high';
  else if (similarityScore > 0.4) consolidationPotential = 'medium';
  
  // Calculate differences
  const triggerDifferences = [
    ...Array.from(triggersA).filter(x => !triggersB.has(x)).map(x => `A: ${x}`),
    ...Array.from(triggersB).filter(x => !triggersA.has(x)).map(x => `B: ${x}`)
  ];
  
  const jobDifferences = [
    ...Array.from(jobsA).filter(x => !jobsB.has(x)).map(x => `A: ${x}`),
    ...Array.from(jobsB).filter(x => !jobsA.has(x)).map(x => `B: ${x}`)
  ];
  
  const stepDifferences = [
    ...Array.from(stepsA).filter(x => !stepsB.has(x)).map(x => `A: ${x}`),
    ...Array.from(stepsB).filter(x => !stepsA.has(x)).map(x => `B: ${x}`)
  ];
  
  return {
    workflow_a: workflowA.name,
    workflow_b: workflowB.name,
    similarity_score: Math.round(similarityScore * 100) / 100,
    common_elements: {
      triggers: commonTriggers,
      jobs: commonJobs,
      secrets: commonSecrets,
      permissions: commonPermissions,
      steps: commonSteps,
    },
    differences: {
      trigger_differences: triggerDifferences,
      job_differences: jobDifferences,
      step_differences: stepDifferences,
    },
    consolidation_potential: consolidationPotential,
  };
}

function detectRedundantPatterns(workflows: any[]): RedundantPattern[] {
  const patterns: RedundantPattern[] = [];
  
  // Pattern 1: Multiple workflows with same trigger events
  const triggerGroups = new Map<string, string[]>();
  for (const workflow of workflows) {
    const triggerEvents = workflow.triggers.map((t: any) => t.event).sort().join(',');
    if (!triggerGroups.has(triggerEvents)) {
      triggerGroups.set(triggerEvents, []);
    }
    triggerGroups.get(triggerEvents)!.push(workflow.name);
  }
  
  for (const [triggerEvents, workflowNames] of triggerGroups.entries()) {
    if (workflowNames.length > 1) {
      patterns.push({
        pattern_type: 'trigger_duplication',
        pattern_name: `Same triggers: ${triggerEvents}`,
        affected_workflows: workflowNames,
        description: `${workflowNames.length} workflows share identical trigger events`,
        consolidation_suggestion: 'Consider merging workflows or using different trigger conditions',
        priority: workflowNames.length > 3 ? 'high' : 'medium',
      });
    }
  }
  
  // Pattern 2: Similar job structures
  const jobPatterns = new Map<string, string[]>();
  for (const workflow of workflows) {
    const jobNames = Object.keys(workflow.jobs).sort().join(',');
    if (jobNames && !jobPatterns.has(jobNames)) {
      jobPatterns.set(jobNames, []);
    }
    if (jobNames) {
      jobPatterns.get(jobNames)!.push(workflow.name);
    }
  }
  
  for (const [jobNames, workflowNames] of jobPatterns.entries()) {
    if (workflowNames.length > 1) {
      patterns.push({
        pattern_type: 'job_similarity',
        pattern_name: `Similar job structure: ${jobNames}`,
        affected_workflows: workflowNames,
        description: `${workflowNames.length} workflows have identical job names`,
        consolidation_suggestion: 'Extract common jobs into reusable workflows',
        priority: 'medium',
      });
    }
  }
  
  // Pattern 3: Excessive secret overlap
  for (let i = 0; i < workflows.length; i++) {
    for (let j = i + 1; j < workflows.length; j++) {
      const workflowA = workflows[i];
      const workflowB = workflows[j];
      
      const secretsA = new Set(workflowA.secrets_refs);
      const secretsB = new Set(workflowB.secrets_refs);
      const commonSecrets = Array.from(secretsA).filter(x => secretsB.has(x));
      
      if (commonSecrets.length > 3 && commonSecrets.length / Math.max(secretsA.size, secretsB.size) > 0.7) {
        patterns.push({
          pattern_type: 'secret_overlap',
          pattern_name: `High secret overlap`,
          affected_workflows: [workflowA.name, workflowB.name],
          description: `${commonSecrets.length} shared secrets (${Math.round(commonSecrets.length / Math.max(secretsA.size, secretsB.size) * 100)}% overlap)`,
          consolidation_suggestion: 'Consider consolidating workflows or reviewing secret usage',
          priority: 'low',
        });
      }
    }
  }
  
  // Pattern 4: Common step sequences
  const stepSequences = new Map<string, string[]>();
  for (const workflow of workflows) {
    for (const job of Object.values(workflow.jobs) as any[]) {
      if (job.steps && job.steps.length > 2) {
        const stepSequence = job.steps
          .map((step: any) => step.uses || `run:${step.run?.substring(0, 20)}`)
          .filter(Boolean)
          .slice(0, 3)
          .join(' -> ');
        
        if (stepSequence.length > 10) {
          if (!stepSequences.has(stepSequence)) {
            stepSequences.set(stepSequence, []);
          }
          stepSequences.get(stepSequence)!.push(workflow.name);
        }
      }
    }
  }
  
  for (const [sequence, workflowNames] of stepSequences.entries()) {
    if (workflowNames.length > 1) {
      const uniqueWorkflows = [...new Set(workflowNames)];
      if (uniqueWorkflows.length > 1) {
        patterns.push({
          pattern_type: 'step_similarity',
          pattern_name: `Common step sequence`,
          affected_workflows: uniqueWorkflows,
          description: `Common step pattern: ${sequence}`,
          consolidation_suggestion: 'Extract common steps into composite action',
          priority: uniqueWorkflows.length > 2 ? 'medium' : 'low',
        });
      }
    }
  }
  
  return patterns.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function generateConsolidationOpportunities(similarities: SimilarityMatch[], patterns: RedundantPattern[]): ConsolidationOpportunity[] {
  const opportunities: ConsolidationOpportunity[] = [];
  
  // Opportunity 1: Merge highly similar workflows
  const highSimilarityPairs = similarities.filter(s => s.similarity_score > 0.6);
  for (const pair of highSimilarityPairs) {
    opportunities.push({
      opportunity_type: 'merge_workflows',
      title: `Merge similar workflows: ${pair.workflow_a} & ${pair.workflow_b}`,
      affected_workflows: [pair.workflow_a, pair.workflow_b],
      description: `These workflows have ${Math.round(pair.similarity_score * 100)}% similarity and could potentially be merged`,
      estimated_complexity: pair.similarity_score > 0.8 ? 'low' : 'medium',
      potential_savings: 'Reduce maintenance overhead, consolidate CI/CD logic',
      implementation_steps: [
        'Analyze trigger differences and create conditional logic',
        'Merge job definitions and add workflow inputs',
        'Consolidate environment variables and secrets',
        'Update any dependent workflows or documentation',
        'Test merged workflow thoroughly before removing originals'
      ],
    });
  }
  
  // Opportunity 2: Extract reusable workflows
  const jobSimilarityPatterns = patterns.filter(p => p.pattern_type === 'job_similarity');
  for (const pattern of jobSimilarityPatterns) {
    if (pattern.affected_workflows.length > 2) {
      opportunities.push({
        opportunity_type: 'extract_reusable',
        title: `Extract reusable workflow for common jobs`,
        affected_workflows: pattern.affected_workflows,
        description: `${pattern.affected_workflows.length} workflows share similar job structures`,
        estimated_complexity: 'medium',
        potential_savings: 'Reduce code duplication, improve consistency',
        implementation_steps: [
          'Create new reusable workflow in .github/workflows/',
          'Define inputs for workflow customization',
          'Extract common job definitions',
          'Update calling workflows to use reusable workflow',
          'Remove duplicated job definitions'
        ],
      });
    }
  }
  
  // Opportunity 3: Create composite actions
  const stepSimilarityPatterns = patterns.filter(p => p.pattern_type === 'step_similarity');
  for (const pattern of stepSimilarityPatterns) {
    if (pattern.affected_workflows.length > 2) {
      opportunities.push({
        opportunity_type: 'create_composite',
        title: `Create composite action for common steps`,
        affected_workflows: pattern.affected_workflows,
        description: `Common step sequences found across ${pattern.affected_workflows.length} workflows`,
        estimated_complexity: 'low',
        potential_savings: 'Reduce step duplication, easier maintenance',
        implementation_steps: [
          'Create new composite action in .github/actions/',
          'Define action inputs and outputs',
          'Move common steps to composite action',
          'Update workflows to use new composite action',
          'Test composite action across all workflows'
        ],
      });
    }
  }
  
  // Opportunity 4: Schedule optimization
  const triggerDuplicationPatterns = patterns.filter(p => p.pattern_type === 'trigger_duplication');
  const scheduledDuplicates = triggerDuplicationPatterns.filter(p => p.pattern_name.includes('schedule'));
  
  if (scheduledDuplicates.length > 0) {
    opportunities.push({
      opportunity_type: 'schedule_optimization',
      title: 'Optimize workflow scheduling',
      affected_workflows: scheduledDuplicates.flatMap(p => p.affected_workflows),
      description: 'Multiple workflows with identical or overlapping schedules detected',
      estimated_complexity: 'low',
      potential_savings: 'Reduce GitHub Actions usage, prevent resource conflicts',
      implementation_steps: [
        'Review cron expressions for conflicts',
        'Stagger execution times by 2-5 minutes',
        'Consider consolidating similar scheduled workflows',
        'Update cron expressions to distribute load',
        'Monitor for scheduling conflicts after changes'
      ],
    });
  }
  
  return opportunities.sort((a, b) => {
    const complexityOrder = { low: 3, medium: 2, high: 1 };
    return complexityOrder[a.estimated_complexity] - complexityOrder[b.estimated_complexity];
  });
}

function generateGoldenPathRecommendation(workflows: any[], opportunities: ConsolidationOpportunity[]): string[] {
  const recommendations: string[] = [];
  
  // Identify core workflows that should be preserved
  const coreWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes('deploy') ||
    w.name.toLowerCase().includes('ci') ||
    w.name.toLowerCase().includes('build') ||
    w.name.toLowerCase().includes('test')
  );
  
  const totalWorkflows = workflows.length;
  const potentialReduction = Math.floor(opportunities.length * 0.3); // Conservative estimate
  
  recommendations.push(`📊 Current state: ${totalWorkflows} workflows, ${opportunities.length} consolidation opportunities`);
  recommendations.push(`🎯 Target: Reduce to ${totalWorkflows - potentialReduction} workflows (~${Math.round(potentialReduction/totalWorkflows*100)}% reduction)`);
  
  if (coreWorkflows.length > 0) {
    recommendations.push(`🔒 Preserve core workflows: ${coreWorkflows.map(w => w.name).join(', ')}`);
  }
  
  // Priority-based recommendations
  const highPriorityOpportunities = opportunities.filter(o => o.estimated_complexity === 'low');
  if (highPriorityOpportunities.length > 0) {
    recommendations.push(`⚡ Start with ${highPriorityOpportunities.length} low-complexity consolidations`);
  }
  
  const mergeOpportunities = opportunities.filter(o => o.opportunity_type === 'merge_workflows');
  if (mergeOpportunities.length > 0) {
    recommendations.push(`🔄 Consider merging ${mergeOpportunities.length} highly similar workflow pairs`);
  }
  
  const reusableOpportunities = opportunities.filter(o => o.opportunity_type === 'extract_reusable');
  if (reusableOpportunities.length > 0) {
    recommendations.push(`♻️  Extract ${reusableOpportunities.length} reusable workflow patterns`);
  }
  
  recommendations.push('📋 Implement changes incrementally with thorough testing');
  recommendations.push('🔍 Monitor CI/CD performance after each consolidation');
  
  return recommendations;
}

async function main() {
  console.log('🔍 Detecting workflow duplication and redundancy...');
  
  try {
    // Read workflow data
    const workflowData = JSON.parse(readFileSync('ci_audit/workflow_map/data/workflows.json', 'utf8'));
    const workflows = workflowData.workflows.filter((w: any) => !w.error); // Only analyze valid workflows
    
    console.log(`   Analyzing ${workflows.length} workflows for similarities...`);
    
    // Calculate pairwise similarities
    const similarities: SimilarityMatch[] = [];
    for (let i = 0; i < workflows.length; i++) {
      for (let j = i + 1; j < workflows.length; j++) {
        const similarity = calculateWorkflowSimilarity(workflows[i], workflows[j]);
        if (similarity.similarity_score > 0.2) { // Only include meaningful similarities
          similarities.push(similarity);
        }
      }
    }
    
    console.log(`   Found ${similarities.length} workflow pairs with similarity > 20%`);
    
    // Detect redundant patterns
    const redundantPatterns = detectRedundantPatterns(workflows);
    console.log(`   Detected ${redundantPatterns.length} redundant patterns`);
    
    // Generate consolidation opportunities
    const consolidationOpportunities = generateConsolidationOpportunities(similarities, redundantPatterns);
    console.log(`   Identified ${consolidationOpportunities.length} consolidation opportunities`);
    
    // Generate golden path recommendation
    const goldenPathRecommendation = generateGoldenPathRecommendation(workflows, consolidationOpportunities);
    
    const report: DuplicationReport = {
      generated_at: new Date().toISOString(),
      similarity_matches: similarities.sort((a, b) => b.similarity_score - a.similarity_score),
      redundant_patterns: redundantPatterns,
      consolidation_opportunities: consolidationOpportunities,
      summary: {
        total_workflow_pairs_analyzed: (workflows.length * (workflows.length - 1)) / 2,
        high_similarity_matches: similarities.filter(s => s.similarity_score > 0.6).length,
        redundant_patterns_found: redundantPatterns.length,
        consolidation_opportunities: consolidationOpportunities.length,
        potential_workflow_reduction: `${Math.floor(consolidationOpportunities.length * 0.3)} workflows (~${Math.round(Math.floor(consolidationOpportunities.length * 0.3)/workflows.length*100)}%)`,
        golden_path_recommendation: goldenPathRecommendation,
      },
    };
    
    const outputPath = 'ci_audit/workflow_map/data/duplication_report.json';
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    
    console.log(`✅ Duplication analysis completed`);
    console.log(`📊 Summary:`);
    console.log(`   - Workflow pairs analyzed: ${report.summary.total_workflow_pairs_analyzed}`);
    console.log(`   - High similarity matches: ${report.summary.high_similarity_matches}`);
    console.log(`   - Redundant patterns: ${report.summary.redundant_patterns_found}`);
    console.log(`   - Consolidation opportunities: ${report.summary.consolidation_opportunities}`);
    console.log(`   - Potential reduction: ${report.summary.potential_workflow_reduction}`);
    console.log(`📁 Data saved to: ${outputPath}`);
    
    if (report.summary.high_similarity_matches > 0) {
      console.log(`\n🎯 Top consolidation opportunities:`);
      report.consolidation_opportunities.slice(0, 3).forEach(opp => {
        console.log(`   - ${opp.title} (${opp.estimated_complexity} complexity)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to detect duplication:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}