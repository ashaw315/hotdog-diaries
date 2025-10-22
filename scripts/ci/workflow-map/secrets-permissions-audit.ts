#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

interface SecretUsage {
  secret_name: string;
  workflows: string[];
  workflow_count: number;
  is_critical: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  classification: 'api_key' | 'database' | 'auth' | 'deployment' | 'external_service' | 'unknown';
}

interface PermissionUsage {
  permission: string;
  scope: string;
  workflows: string[];
  workflow_count: number;
  risk_level: 'low' | 'medium' | 'high';
  is_write_permission: boolean;
}

interface SecurityIssue {
  type: 'overprivileged' | 'unused_secret' | 'weak_permissions' | 'missing_permission' | 'secret_exposure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  workflow: string;
  description: string;
  recommendation: string;
}

interface SecurityAuditData {
  generated_at: string;
  secret_usage: SecretUsage[];
  permission_usage: PermissionUsage[];
  security_issues: SecurityIssue[];
  summary: {
    total_secrets_referenced: number;
    total_unique_permissions: number;
    high_risk_secrets: number;
    overprivileged_workflows: number;
    security_score: number;
    recommendations: string[];
  };
}

function classifySecret(secretName: string): { classification: SecretUsage['classification'], isCritical: boolean, riskLevel: SecretUsage['risk_level'] } {
  const name = secretName.toLowerCase();
  
  // Database secrets - critical
  if (name.includes('database') || name.includes('supabase') || name.includes('postgres')) {
    return { classification: 'database', isCritical: true, riskLevel: 'critical' };
  }
  
  // Authentication secrets - critical
  if (name.includes('auth') || name.includes('jwt') || name.includes('token') && !name.includes('github')) {
    return { classification: 'auth', isCritical: true, riskLevel: 'critical' };
  }
  
  // Deployment secrets - high risk
  if (name.includes('deploy') || name.includes('vercel') || name.includes('github_token')) {
    return { classification: 'deployment', isCritical: true, riskLevel: 'high' };
  }
  
  // API keys - medium to high risk
  if (name.includes('api') || name.includes('key') || name.includes('client')) {
    return { classification: 'api_key', isCritical: false, riskLevel: 'medium' };
  }
  
  // External services - medium risk
  if (name.includes('youtube') || name.includes('reddit') || name.includes('giphy') || 
      name.includes('pixabay') || name.includes('bluesky') || name.includes('imgur') ||
      name.includes('tumblr') || name.includes('lemmy')) {
    return { classification: 'external_service', isCritical: false, riskLevel: 'medium' };
  }
  
  // Unknown - low risk unless proven otherwise
  return { classification: 'unknown', isCritical: false, riskLevel: 'low' };
}

function analyzePermissionRisk(permission: string, scope: string): { riskLevel: PermissionUsage['risk_level'], isWrite: boolean } {
  const isWrite = scope === 'write' || scope === 'admin';
  
  // High-risk write permissions
  if (isWrite && (permission === 'contents' || permission === 'actions' || permission === 'security-events')) {
    return { riskLevel: 'high', isWrite };
  }
  
  // Medium-risk write permissions
  if (isWrite && (permission === 'issues' || permission === 'pull-requests' || permission === 'checks')) {
    return { riskLevel: 'medium', isWrite };
  }
  
  // Low-risk write permissions
  if (isWrite) {
    return { riskLevel: 'medium', isWrite };
  }
  
  // Read permissions are generally low risk
  return { riskLevel: 'low', isWrite };
}

function detectSecurityIssues(workflows: any[], secretUsage: SecretUsage[], permissionUsage: PermissionUsage[]): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  for (const workflow of workflows) {
    // Check for overprivileged workflows
    const workflowPermissions = workflow.permissions || {};
    const writePermissions = Object.entries(workflowPermissions)
      .filter(([_, scope]) => scope === 'write' || scope === 'admin')
      .map(([perm, _]) => perm);
    
    if (writePermissions.length > 3) {
      issues.push({
        type: 'overprivileged',
        severity: 'medium',
        workflow: workflow.name,
        description: `Workflow has ${writePermissions.length} write permissions: ${writePermissions.join(', ')}`,
        recommendation: 'Review if all write permissions are necessary. Consider using more specific permissions or splitting workflow.'
      });
    }
    
    // Check for workflows with admin-level permissions
    const adminPermissions = Object.entries(workflowPermissions)
      .filter(([_, scope]) => scope === 'admin')
      .map(([perm, _]) => perm);
    
    if (adminPermissions.length > 0) {
      issues.push({
        type: 'overprivileged',
        severity: 'high',
        workflow: workflow.name,
        description: `Workflow uses admin-level permissions: ${adminPermissions.join(', ')}`,
        recommendation: 'Admin permissions should be rare. Consider if write permissions are sufficient.'
      });
    }
    
    // Check for critical secrets in non-production workflows
    const criticalSecrets = workflow.secrets_refs.filter((secret: string) => {
      const { isCritical } = classifySecret(secret);
      return isCritical;
    });
    
    const isProductionWorkflow = workflow.name.toLowerCase().includes('prod') || 
                               workflow.name.toLowerCase().includes('deploy') ||
                               workflow.triggers.some((t: any) => t.event === 'push' && t.config?.branches?.includes('main'));
    
    if (criticalSecrets.length > 0 && !isProductionWorkflow) {
      issues.push({
        type: 'secret_exposure',
        severity: 'medium',
        workflow: workflow.name,
        description: `Non-production workflow accesses critical secrets: ${criticalSecrets.join(', ')}`,
        recommendation: 'Limit critical secret access to production workflows only. Use less privileged secrets for testing.'
      });
    }
    
    // Check for workflows without any permissions specified
    if (!workflow.permissions && workflow.job_count > 0) {
      issues.push({
        type: 'missing_permission',
        severity: 'low',
        workflow: workflow.name,
        description: 'Workflow does not specify explicit permissions (inherits repo defaults)',
        recommendation: 'Add explicit permissions block to follow principle of least privilege.'
      });
    }
  }
  
  // Check for unused secrets (referenced in fewer than 2 workflows)
  for (const secret of secretUsage) {
    if (secret.workflow_count === 1 && !secret.is_critical) {
      issues.push({
        type: 'unused_secret',
        severity: 'low',
        workflow: secret.workflows[0],
        description: `Secret ${secret.secret_name} is only used by one workflow`,
        recommendation: 'Consider if this secret is necessary or if it could be consolidated with others.'
      });
    }
  }
  
  return issues.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

function calculateSecurityScore(secretUsage: SecretUsage[], permissionUsage: PermissionUsage[], issues: SecurityIssue[]): number {
  let score = 100;
  
  // Deduct points for high-risk secrets
  const highRiskSecrets = secretUsage.filter(s => s.risk_level === 'high' || s.risk_level === 'critical');
  score -= highRiskSecrets.length * 5;
  
  // Deduct points for high-risk permissions
  const highRiskPermissions = permissionUsage.filter(p => p.risk_level === 'high');
  score -= highRiskPermissions.length * 3;
  
  // Deduct points for security issues
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(issues: SecurityIssue[], securityScore: number): string[] {
  const recommendations: string[] = [];
  
  if (securityScore < 70) {
    recommendations.push('🚨 Security score is below 70%. Immediate attention required.');
  }
  
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push(`🔴 Address ${criticalIssues.length} critical security issues immediately.`);
  }
  
  const highIssues = issues.filter(i => i.severity === 'high');
  if (highIssues.length > 0) {
    recommendations.push(`🟠 Review ${highIssues.length} high-severity security issues.`);
  }
  
  const overprivilegedCount = issues.filter(i => i.type === 'overprivileged').length;
  if (overprivilegedCount > 0) {
    recommendations.push(`🔒 Review permissions for ${overprivilegedCount} overprivileged workflows.`);
  }
  
  const secretExposureCount = issues.filter(i => i.type === 'secret_exposure').length;
  if (secretExposureCount > 0) {
    recommendations.push(`🔐 Limit critical secret access in ${secretExposureCount} workflows.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Security posture is good. Continue monitoring.');
  }
  
  recommendations.push('📋 Regularly audit secret usage and permissions.');
  recommendations.push('🔄 Rotate secrets according to your security policy.');
  
  return recommendations;
}

async function main() {
  console.log('🔒 Performing security audit of secrets and permissions...');
  
  try {
    // Read workflow data
    const workflowData = JSON.parse(readFileSync('ci_audit/workflow_map/data/workflows.json', 'utf8'));
    
    // Aggregate secret usage
    const secretMap = new Map<string, Set<string>>();
    for (const workflow of workflowData.workflows) {
      for (const secret of workflow.secrets_refs) {
        if (!secretMap.has(secret)) {
          secretMap.set(secret, new Set());
        }
        secretMap.get(secret)!.add(workflow.name);
      }
    }
    
    const secretUsage: SecretUsage[] = Array.from(secretMap.entries()).map(([secret, workflows]) => {
      const { classification, isCritical, riskLevel } = classifySecret(secret);
      return {
        secret_name: secret,
        workflows: Array.from(workflows),
        workflow_count: workflows.size,
        is_critical: isCritical,
        risk_level: riskLevel,
        classification,
      };
    });
    
    // Aggregate permission usage
    const permissionMap = new Map<string, Set<string>>();
    for (const workflow of workflowData.workflows) {
      if (workflow.permissions) {
        for (const [permission, scope] of Object.entries(workflow.permissions)) {
          const key = `${permission}:${scope}`;
          if (!permissionMap.has(key)) {
            permissionMap.set(key, new Set());
          }
          permissionMap.get(key)!.add(workflow.name);
        }
      }
    }
    
    const permissionUsage: PermissionUsage[] = Array.from(permissionMap.entries()).map(([permScope, workflows]) => {
      const [permission, scope] = permScope.split(':');
      const { riskLevel, isWrite } = analyzePermissionRisk(permission, scope);
      return {
        permission,
        scope,
        workflows: Array.from(workflows),
        workflow_count: workflows.size,
        risk_level: riskLevel,
        is_write_permission: isWrite,
      };
    });
    
    // Detect security issues
    const securityIssues = detectSecurityIssues(workflowData.workflows, secretUsage, permissionUsage);
    
    // Calculate security score
    const securityScore = calculateSecurityScore(secretUsage, permissionUsage, securityIssues);
    
    // Generate recommendations
    const recommendations = generateRecommendations(securityIssues, securityScore);
    
    const auditData: SecurityAuditData = {
      generated_at: new Date().toISOString(),
      secret_usage: secretUsage.sort((a, b) => b.workflow_count - a.workflow_count),
      permission_usage: permissionUsage.sort((a, b) => b.workflow_count - a.workflow_count),
      security_issues: securityIssues,
      summary: {
        total_secrets_referenced: secretUsage.length,
        total_unique_permissions: permissionUsage.length,
        high_risk_secrets: secretUsage.filter(s => s.risk_level === 'high' || s.risk_level === 'critical').length,
        overprivileged_workflows: securityIssues.filter(i => i.type === 'overprivileged').length,
        security_score: securityScore,
        recommendations,
      },
    };
    
    const outputPath = 'ci_audit/workflow_map/data/security_audit.json';
    writeFileSync(outputPath, JSON.stringify(auditData, null, 2));
    
    console.log(`✅ Security audit completed`);
    console.log(`📊 Summary:`);
    console.log(`   - Secrets referenced: ${auditData.summary.total_secrets_referenced}`);
    console.log(`   - Unique permissions: ${auditData.summary.total_unique_permissions}`);
    console.log(`   - High-risk secrets: ${auditData.summary.high_risk_secrets}`);
    console.log(`   - Security issues: ${auditData.security_issues.length}`);
    console.log(`   - Security score: ${auditData.summary.security_score}/100`);
    console.log(`📁 Data saved to: ${outputPath}`);
    
    if (auditData.security_issues.length > 0) {
      console.log(`\n🔍 Top security issues:`);
      auditData.security_issues.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.severity.toUpperCase()}: ${issue.description}`);
      });
    }
    
    if (auditData.summary.security_score < 80) {
      console.log(`\n⚠️  Security score is ${auditData.summary.security_score}/100. Review recommendations.`);
    }
    
  } catch (error) {
    console.error('❌ Failed to perform security audit:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}