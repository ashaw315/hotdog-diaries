# Workflow Analysis Overview

Generated: 2025-10-19T11:40:10.271Z
Total workflows: 50

## Trigger Distribution

| Trigger | Count |
|---------|-------|
| workflow_dispatch | 40 |
| schedule | 36 |
| workflow_call | 11 |
| push | 9 |
| pull_request | 3 |
| deployment_status | 3 |
| workflow_run | 2 |
| repository_dispatch | 1 |

## Complexity Distribution

| Complexity | Count |
|------------|-------|
| Low (0-10) | 18 |
| Medium (11-25) | 22 |
| High (26-50) | 5 |
| Very High (50+) | 5 |

## Deployment-Related Workflows

| Workflow | Deployment Status | Environment Usage | Triggers |
|----------|------------------|-------------------|----------|
| Deploy Gate | ✅ | ❌ | deployment_status, push, workflow_run |
| 🚪 Deployment Gate | ✅ | ✅ | workflow_dispatch, deployment_status, workflow_call |
| Post-Deploy Check | ✅ | ❌ | deployment_status, push, workflow_run, workflow_dispatch, workflow_call |

## High-Complexity Workflows

| Workflow | Complexity Score | Jobs | Triggers | Secrets |
|----------|-----------------|------|----------|---------|
| CI | 86 | 8 | push, pull_request, workflow_call | 1 |
| Housekeeping | 77 | 8 | schedule, workflow_dispatch, workflow_call | 8 |
| Content Scanners | 64 | 6 | schedule, workflow_dispatch, workflow_call | 14 |
| Content Scheduler | 62 | 6 | schedule, workflow_dispatch, workflow_call | 5 |
| Post-Deploy Check | 53 | 5 | deployment_status, push, workflow_run, workflow_dispatch, workflow_call | 1 |
| Content Posting | 45 | 5 | schedule, workflow_dispatch, workflow_call | 5 |
| OpenAPI Spec Drift Detection | 36 | 4 | pull_request, push, workflow_dispatch, schedule | 0 |
| Deploy Gate | 34 | 3 | deployment_status, push, workflow_run | 1 |
| Secret Validation | 32 | 3 | push, pull_request, schedule | 4 |
| Phase 3 CI Auto-Healing: Security & Build Diagnostics | 28 | 2 | workflow_call, workflow_dispatch | 2 |