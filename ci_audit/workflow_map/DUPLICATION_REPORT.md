# Workflow Duplication Analysis

**Generated:** 2025-10-21 19:56:03 UTC  
**Potential Reduction:** 4 workflows (~8%)  

## Summary

| Metric | Count |
|--------|-------|
| Workflow Pairs Analyzed | 1225 |
| High Similarity Matches | 10 |
| Redundant Patterns | 18 |
| Consolidation Opportunities | 14 |

## High Similarity Workflow Pairs

| Workflow A | Workflow B | Similarity | Consolidation Potential |
|------------|------------|------------|------------------------|
| Post Dinner Content | Post Evening Content | 70% | 🟢 high |
| Post Dinner Content | Post Late Night Content | 70% | 🟢 high |
| Post Dinner Content | Post Lunch Content | 70% | 🟢 high |
| Post Dinner Content | Post Afternoon Snack | 70% | 🟢 high |
| Post Evening Content | Post Late Night Content | 70% | 🟢 high |
| Post Evening Content | Post Lunch Content | 70% | 🟢 high |
| Post Evening Content | Post Afternoon Snack | 70% | 🟢 high |
| Post Late Night Content | Post Lunch Content | 70% | 🟢 high |
| Post Late Night Content | Post Afternoon Snack | 70% | 🟢 high |
| Post Lunch Content | Post Afternoon Snack | 70% | 🟢 high |
| Database Cleanup | Post Dinner Content | 60% | 🟡 medium |
| Database Cleanup | Post Evening Content | 60% | 🟡 medium |
| Database Cleanup | Post Late Night Content | 60% | 🟡 medium |
| Database Cleanup | Post Lunch Content | 60% | 🟡 medium |
| Database Cleanup | Post Afternoon Snack | 60% | 🟡 medium |
| Auto Queue Manager | Post Breakfast Content | 57% | 🟡 medium |
| Post Breakfast Content | Post Dinner Content | 57% | 🟡 medium |
| Post Breakfast Content | Post Evening Content | 57% | 🟡 medium |
| Post Breakfast Content | Post Late Night Content | 57% | 🟡 medium |
| Post Breakfast Content | Post Lunch Content | 57% | 🟡 medium |
| Post Breakfast Content | Post Afternoon Snack | 57% | 🟡 medium |

## Redundant Patterns

### 🔴 Same triggers: schedule,workflow_dispatch (high)

**Type:** trigger_duplication  
**Affected Workflows:** Auto-Approve Content, Auto Queue Manager, Database Cleanup, Daily Ingestion Balance Report, Daily Summary Report, Meta CI Audit, 📋 Planner Contract, Post Breakfast Content, Post Dinner Content, Post Evening Content, Post Late Night Content, Post Lunch Content, Post Afternoon Snack, Production Autonomy Watchdog, 🔍 Production Audit, Monitor Queue Health & Scan if Needed, Scan Bluesky for Content, Scan Giphy for Content, Scan Imgur for Content, Scan Lemmy for Content, Scan Niche Platforms, Scan Pixabay for Content, Scan Reddit for Content, Scan Social Platforms, Scan Tumblr for Content, Scan YouTube for Content, Schedule Reconciliation, 🔥 Weekly Smoke Test  
**Description:** 28 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🔴 Same triggers: schedule,workflow_call,workflow_dispatch (high)

**Type:** trigger_duplication  
**Affected Workflows:** Housekeeping, Content Posting, Content Scanners, Content Scheduler  
**Description:** 4 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🟠 Same triggers: workflow_call (medium)

**Type:** trigger_duplication  
**Affected Workflows:** Posting Guard (Reusable), Queue Monitor Hook, Token Refresh (Reusable)  
**Description:** 3 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🟠 Same triggers: workflow_dispatch (medium)

**Type:** trigger_duplication  
**Affected Workflows:** CI Failure Drilldown (Read-Only), Manual Operations  
**Description:** 2 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🟠 Same triggers: push (medium)

**Type:** trigger_duplication  
**Affected Workflows:** CI Test, CI Test  
**Description:** 2 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🟠 Same triggers: schedule (medium)

**Type:** trigger_duplication  
**Affected Workflows:** Queue Readiness, Scheduler SLA Guard  
**Description:** 2 workflows share identical trigger events  
**Suggestion:** Consider merging workflows or using different trigger conditions  

### 🟠 Similar job structure: guard (medium)

**Type:** job_similarity  
**Affected Workflows:** Posting Guard (Reusable), Scheduler SLA Guard  
**Description:** 2 workflows have identical job names  
**Suggestion:** Extract common jobs into reusable workflows  

### 🟠 Similar job structure: test (medium)

**Type:** job_similarity  
**Affected Workflows:** CI Test, CI Test  
**Description:** 2 workflows have identical job names  
**Suggestion:** Extract common jobs into reusable workflows  

### 🟠 Common step sequence (medium)

**Type:** step_similarity  
**Affected Workflows:** Posting Guard (Reusable), Queue Readiness, Scheduler SLA Guard  
**Description:** Common step pattern: actions/checkout@v4 -> actions/setup-node@v4 -> run:pnpm install --froze  
**Suggestion:** Extract common steps into composite action  

### 🟠 Common step sequence (medium)

**Type:** step_similarity  
**Affected Workflows:** Auto PR CI Shepherd, Deploy Gate, Production Autonomy Watchdog, Secret Validation, OpenAPI Spec Drift Detection  
**Description:** Common step pattern: actions/checkout@v4 -> pnpm/action-setup@v4 -> actions/setup-node@v4  
**Suggestion:** Extract common steps into composite action  

### 🟠 Common step sequence (medium)

**Type:** step_similarity  
**Affected Workflows:** Housekeeping, Content Posting, Content Scanners, Content Scheduler  
**Description:** Common step pattern: actions/checkout@v4 -> ./.github/actions/setup-node -> ./.github/actions/setup-supabase-rest  
**Suggestion:** Extract common steps into composite action  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Auto Queue Manager, Post Breakfast Content  
**Description:** 4 shared secrets (100% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Auto Queue Manager, Token Refresh (Reusable)  
**Description:** 4 shared secrets (100% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Post Breakfast Content, Token Refresh (Reusable)  
**Description:** 4 shared secrets (100% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Content Posting, Schedule Reconciliation  
**Description:** 4 shared secrets (80% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Content Posting, Content Scheduler  
**Description:** 5 shared secrets (100% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 High secret overlap (low)

**Type:** secret_overlap  
**Affected Workflows:** Schedule Reconciliation, Content Scheduler  
**Description:** 4 shared secrets (80% overlap)  
**Suggestion:** Consider consolidating workflows or reviewing secret usage  

### 🟡 Common step sequence (low)

**Type:** step_similarity  
**Affected Workflows:** Daily Ingestion Balance Report, Meta CI Audit  
**Description:** Common step pattern: actions/checkout@v4 -> actions/setup-node@v4 -> run:npm ci  
**Suggestion:** Extract common steps into composite action  

## Consolidation Opportunities

### 🟡 Merge similar workflows: Post Dinner Content & Post Evening Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Dinner Content, Post Evening Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Dinner Content & Post Late Night Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Dinner Content, Post Late Night Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Dinner Content & Post Lunch Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Dinner Content, Post Lunch Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Dinner Content & Post Afternoon Snack

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Dinner Content, Post Afternoon Snack  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Evening Content & Post Late Night Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Evening Content, Post Late Night Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Evening Content & Post Lunch Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Evening Content, Post Lunch Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Evening Content & Post Afternoon Snack

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Evening Content, Post Afternoon Snack  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Late Night Content & Post Lunch Content

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Late Night Content, Post Lunch Content  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Late Night Content & Post Afternoon Snack

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Late Night Content, Post Afternoon Snack  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟡 Merge similar workflows: Post Lunch Content & Post Afternoon Snack

**Type:** merge_workflows  
**Complexity:** medium  
**Affected Workflows:** Post Lunch Content, Post Afternoon Snack  
**Description:** These workflows have 70% similarity and could potentially be merged  
**Potential Savings:** Reduce maintenance overhead, consolidate CI/CD logic  
**Implementation Steps:**
1. Analyze trigger differences and create conditional logic
1. Merge job definitions and add workflow inputs
1. Consolidate environment variables and secrets
1. Update any dependent workflows or documentation
1. Test merged workflow thoroughly before removing originals

### 🟢 Create composite action for common steps

**Type:** create_composite  
**Complexity:** low  
**Affected Workflows:** Posting Guard (Reusable), Queue Readiness, Scheduler SLA Guard  
**Description:** Common step sequences found across 3 workflows  
**Potential Savings:** Reduce step duplication, easier maintenance  
**Implementation Steps:**
1. Create new composite action in .github/actions/
1. Define action inputs and outputs
1. Move common steps to composite action
1. Update workflows to use new composite action
1. Test composite action across all workflows

### 🟢 Create composite action for common steps

**Type:** create_composite  
**Complexity:** low  
**Affected Workflows:** Auto PR CI Shepherd, Deploy Gate, Production Autonomy Watchdog, Secret Validation, OpenAPI Spec Drift Detection  
**Description:** Common step sequences found across 5 workflows  
**Potential Savings:** Reduce step duplication, easier maintenance  
**Implementation Steps:**
1. Create new composite action in .github/actions/
1. Define action inputs and outputs
1. Move common steps to composite action
1. Update workflows to use new composite action
1. Test composite action across all workflows

### 🟢 Create composite action for common steps

**Type:** create_composite  
**Complexity:** low  
**Affected Workflows:** Housekeeping, Content Posting, Content Scanners, Content Scheduler  
**Description:** Common step sequences found across 4 workflows  
**Potential Savings:** Reduce step duplication, easier maintenance  
**Implementation Steps:**
1. Create new composite action in .github/actions/
1. Define action inputs and outputs
1. Move common steps to composite action
1. Update workflows to use new composite action
1. Test composite action across all workflows

### 🟢 Optimize workflow scheduling

**Type:** schedule_optimization  
**Complexity:** low  
**Affected Workflows:** Auto-Approve Content, Auto Queue Manager, Database Cleanup, Daily Ingestion Balance Report, Daily Summary Report, Meta CI Audit, 📋 Planner Contract, Post Breakfast Content, Post Dinner Content, Post Evening Content, Post Late Night Content, Post Lunch Content, Post Afternoon Snack, Production Autonomy Watchdog, 🔍 Production Audit, Monitor Queue Health & Scan if Needed, Scan Bluesky for Content, Scan Giphy for Content, Scan Imgur for Content, Scan Lemmy for Content, Scan Niche Platforms, Scan Pixabay for Content, Scan Reddit for Content, Scan Social Platforms, Scan Tumblr for Content, Scan YouTube for Content, Schedule Reconciliation, 🔥 Weekly Smoke Test, Housekeeping, Content Posting, Content Scanners, Content Scheduler, Queue Readiness, Scheduler SLA Guard  
**Description:** Multiple workflows with identical or overlapping schedules detected  
**Potential Savings:** Reduce GitHub Actions usage, prevent resource conflicts  
**Implementation Steps:**
1. Review cron expressions for conflicts
1. Stagger execution times by 2-5 minutes
1. Consider consolidating similar scheduled workflows
1. Update cron expressions to distribute load
1. Monitor for scheduling conflicts after changes

## Golden Path Recommendation

- 📊 Current state: 50 workflows, 14 consolidation opportunities
- 🎯 Target: Reduce to 46 workflows (~8% reduction)
- 🔒 Preserve core workflows: Auto PR CI Shepherd, CI Failure Drilldown (Read-Only), CI Test, CI Test, CI, Deploy Gate, 🚪 Deployment Gate, Meta CI Audit, Phase 3 CI Auto-Healing: Security & Build Diagnostics, Scan Social Platforms, Schedule Reconciliation, 🔥 Weekly Smoke Test
- ⚡ Start with 4 low-complexity consolidations
- 🔄 Consider merging 10 highly similar workflow pairs
- 📋 Implement changes incrementally with thorough testing
- 🔍 Monitor CI/CD performance after each consolidation

