# CI/CD Documentation

## Overview
The Hotdog Diaries project uses a streamlined GitHub Actions workflow architecture with 7 core workflows and 3 composite actions. This system is designed for efficiency, maintainability, and minimal toil.

## Workflow Architecture

### Consolidated Workflows (7 Core)

#### 1. CI Pipeline (`ci.yml`)
**Purpose:** Continuous integration with lint, typecheck, test, build, and security validation  
**Triggers:** Push to main/develop, Pull requests  
**Duration:** ~8-15 minutes  
**Jobs:** lint, typecheck, test, security, build, auto-healing, summary

[![CI Status](https://github.com/anthropics/hotdog-diaries/workflows/CI/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/ci.yml)

```yaml
# Manual trigger example
gh workflow run ci.yml --ref main
```

#### 2. E2E Testing (`e2e.yml`)
**Purpose:** End-to-end testing with smart triggering  
**Triggers:** Nightly schedule, PR with `e2e` label, Manual dispatch  
**Duration:** ~15-25 minutes  
**Features:** Multi-browser matrix, build caching, conditional execution

[![E2E Tests](https://github.com/anthropics/hotdog-diaries/workflows/E2E%20Tests/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/e2e.yml)

```yaml
# Run E2E for specific browser
gh workflow run e2e.yml --ref main -f browser=firefox

# Run full browser matrix
gh workflow run e2e.yml --ref main -f browser=all
```

#### 3. Content Scanners (`scanners.yml`)  
**Purpose:** Automated content discovery across social platforms  
**Triggers:** Staggered schedule (every 4-8 hours), Manual dispatch  
**Duration:** ~8-15 minutes  
**Platforms:** Reddit, YouTube, Giphy, Imgur, Bluesky, Tumblr, Lemmy, Pixabay

[![Content Scanners](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Scanners/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/scanners.yml)

```yaml
# Scan specific platforms
gh workflow run scanners.yml --ref main -f platforms="reddit,youtube" -f max-posts=25

# Scan all platforms  
gh workflow run scanners.yml --ref main -f platforms=all -f max-posts=50
```

#### 4. Content Scheduler (`scheduler.yml`)
**Purpose:** Content schedule management and forecasting  
**Triggers:** Daily schedule (1 AM, 12 PM), Weekly reconcile (Sunday), Manual dispatch  
**Duration:** ~5-15 minutes  
**Operations:** refill, forecast, reconcile, twoDays

[![Content Scheduler](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Scheduler/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/scheduler.yml)

```yaml
# Refill next 2 days
gh workflow run scheduler.yml --ref main -f operation=refill -f days=2

# Generate forecast
gh workflow run scheduler.yml --ref main -f operation=forecast -f days=3

# Weekly reconciliation  
gh workflow run scheduler.yml --ref main -f operation=reconcile -f days=7
```

#### 5. Content Posting (`post.yml`)
**Purpose:** Automated content posting at scheduled times  
**Triggers:** 6 daily schedules (8 AM, 12 PM, 3 PM, 6 PM, 9 PM, 11:30 PM ET), Manual dispatch  
**Duration:** ~3-8 minutes  
**Features:** Dry-run mode, pre-post validation, post-validation

[![Content Posting](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Posting/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/post.yml)

```yaml
# Manual post for specific slot
gh workflow run post.yml --ref main -f slot=breakfast -f dry-run=false

# Dry run test
gh workflow run post.yml --ref main -f slot=manual -f dry-run=true
```

#### 6. Housekeeping (`housekeeping.yml`)
**Purpose:** System maintenance, cleanup, and health monitoring  
**Triggers:** Weekly comprehensive (Monday 3 AM), Daily light (6 AM), Manual dispatch  
**Duration:** ~8-20 minutes  
**Tasks:** cleanup, dead-links, licenses, audit, queue-monitor, secrets

[![Housekeeping](https://github.com/anthropics/hotdog-diaries/workflows/Housekeeping/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/housekeeping.yml)

```yaml
# Run specific tasks
gh workflow run housekeeping.yml --ref main -f tasks="cleanup,dead-links" -f force-cleanup=true

# Full housekeeping
gh workflow run housekeeping.yml --ref main -f tasks=all -f force-cleanup=false
```

#### 7. Post-Deploy Check (`post-deploy-check.yml`)
**Purpose:** Deployment validation and health verification  
**Triggers:** Deployment status, Push to main, Vercel deployment completion  
**Duration:** ~5-10 minutes  
**Features:** Health validation, refill verification, metrics collection

[![Post-Deploy Check](https://github.com/anthropics/hotdog-diaries/workflows/Post-Deploy%20Check/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/post-deploy-check.yml)

```yaml
# Manual deploy check
gh workflow run post-deploy-check.yml --ref main -f skip_refill_check=false

# Check alternative environment
gh workflow run post-deploy-check.yml --ref main -f target_url="https://staging.example.com"
```

### Composite Actions (3 Reusable)

#### 1. Setup Node.js (`setup-node`)
**Purpose:** Standardized Node.js setup with optimized caching  
**Features:** Version selection, dependency installation, cache management  
**Usage:** Referenced in all workflows requiring Node.js

```yaml
- name: Setup Node.js with cache
  uses: ./.github/actions/setup-node
  with:
    node-version: '20'
    cache-key-suffix: 'workflow-name'
    install-dependencies: 'true'
```

#### 2. Setup Supabase REST (`setup-supabase-rest`)  
**Purpose:** Supabase connection configuration and verification  
**Features:** Environment setup, connection testing, database configuration  
**Usage:** Used by workflows requiring database access

```yaml
- name: Setup Supabase environment
  uses: ./.github/actions/setup-supabase-rest
  with:
    supabase-url: ${{ secrets.SUPABASE_URL }}
    supabase-service-key: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    database-url: ${{ secrets.DATABASE_URL }}
```

#### 3. Cache PNPM (`cache-pnpm`)
**Purpose:** Advanced PNPM dependency caching with fallback strategies  
**Features:** Multiple cache strategies, store path detection, fallback mechanisms  
**Usage:** Alternative to npm caching for projects using PNPM

```yaml
- name: Cache PNPM dependencies
  uses: ./.github/actions/cache-pnpm
  with:
    cache-strategy: 'aggressive'
    cache-key-prefix: 'pnpm'
```

## Workflow Features

### Concurrency Control
All workflows implement concurrency control to prevent resource conflicts:
```yaml
concurrency:
  group: workflow-name-${{ github.ref }}
  cancel-in-progress: true  # or false for critical operations
```

### Workflow Call Support
All workflows support `workflow_call` for reusability:
```yaml
on:
  workflow_call:
    inputs:
      parameter:
        description: 'Parameter description'
        type: string
        default: 'value'
```

### Smart Triggering
Workflows use intelligent triggering to minimize unnecessary runs:
- **Schedule-based logic:** Different tasks at different times
- **Conditional execution:** Skip steps based on conditions
- **Label-based triggers:** E2E tests only on labeled PRs
- **Event-driven:** React to deployment events

### Caching Strategy
Optimized caching reduces execution time:
- **Node.js dependencies:** Shared across workflows
- **Build artifacts:** Reused between jobs
- **Playwright browsers:** Cached for E2E tests  
- **Next.js build cache:** Persistent across builds

## Monitoring & Observability

### Badges
Add these badges to your README.md:

```markdown
[![CI](https://github.com/anthropics/hotdog-diaries/workflows/CI/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/anthropics/hotdog-diaries/workflows/E2E%20Tests/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/e2e.yml)
[![Content Scanners](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Scanners/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/scanners.yml)
[![Content Scheduler](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Scheduler/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/scheduler.yml)
[![Content Posting](https://github.com/anthropics/hotdog-diaries/workflows/Content%20Posting/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/post.yml)
[![Housekeeping](https://github.com/anthropics/hotdog-diaries/workflows/Housekeeping/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/housekeeping.yml)
[![Post-Deploy Check](https://github.com/anthropics/hotdog-diaries/workflows/Post-Deploy%20Check/badge.svg)](https://github.com/anthropics/hotdog-diaries/actions/workflows/post-deploy-check.yml)
```

### Artifacts & Reports
Workflows generate artifacts for troubleshooting:
- **Test results:** Coverage reports, test outputs
- **Build artifacts:** Next.js build, dependencies
- **Scan reports:** Content discovery logs, platform status
- **Health reports:** System metrics, deployment validation
- **Security reports:** Vulnerability scans, license audits

### Step Summaries
All workflows generate GitHub step summaries with:
- **Status overview:** Success/failure indicators
- **Key metrics:** Performance data, content counts
- **Next steps:** Actionable recommendations
- **Links:** Relevant artifacts and dashboards

## Environment Configuration

### Required Secrets
```
# Core Authentication
AUTH_TOKEN=<admin-jwt-token>
SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
DATABASE_URL=<postgres-connection-string>

# Platform API Keys
REDDIT_CLIENT_ID=<reddit-app-id>
REDDIT_CLIENT_SECRET=<reddit-app-secret>
YOUTUBE_API_KEY=<youtube-data-api-key>
GIPHY_API_KEY=<giphy-api-key>
IMGUR_CLIENT_ID=<imgur-app-id>
BLUESKY_IDENTIFIER=<bluesky-handle>
BLUESKY_APP_PASSWORD=<bluesky-app-password>
PIXABAY_API_KEY=<pixabay-api-key>
TUMBLR_API_KEY=<tumblr-api-key>

# Deployment
SITE_URL=<production-site-url>
```

### Environment Variables
```yaml
env:
  NODE_ENV: production
  CI: true
  DISABLE_EXTERNAL_INTEGRATIONS: true  # For tests
```

## Troubleshooting

### Common Issues

#### 1. Workflow Failures
- Check GitHub Actions logs for specific error messages
- Review step summaries for high-level status
- Download artifacts for detailed reports
- Verify secrets configuration

#### 2. Cache Issues
- Clear workflow caches via GitHub Actions UI
- Check cache key patterns in composite actions
- Verify cache restore-keys configuration

#### 3. API Rate Limits
- Review scanner workflow schedules  
- Check platform-specific error messages
- Adjust max-posts parameters for scanners

#### 4. Deployment Validation Failures
- Verify target URL accessibility
- Check authentication token validity
- Review health endpoint responses
- Validate database connectivity

### Manual Workflow Commands

```bash
# List all workflow runs
gh run list --workflow=ci.yml

# View specific run details  
gh run view <run-id>

# Download artifacts
gh run download <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed

# Cancel running workflow
gh run cancel <run-id>
```

## Performance Metrics

### Target Execution Times
- **CI Pipeline:** < 15 minutes
- **E2E Tests:** < 25 minutes  
- **Content Scanners:** < 15 minutes
- **Content Scheduler:** < 10 minutes
- **Content Posting:** < 8 minutes
- **Housekeeping:** < 20 minutes
- **Post-Deploy Check:** < 10 minutes

### Resource Optimization
- **Parallel execution:** Matrix strategies where possible
- **Conditional skips:** Avoid unnecessary work
- **Artifact reuse:** Share builds between jobs
- **Cache optimization:** Minimize download times

## Migration Notes

### Before (35 workflows)
- High maintenance overhead
- Duplicated setup code
- Inconsistent patterns
- Complex interdependencies

### After (7 workflows + 3 actions)
- **80% reduction** in workflow files
- **Standardized patterns** across all operations
- **Improved performance** through caching and optimization
- **Enhanced maintainability** with composite actions

### Breaking Changes
- Workflow names have changed (update any dependent automation)
- Some granular schedules are consolidated into smart scheduling
- Manual trigger parameters may differ from original workflows

## Future Enhancements

### Planned Improvements
- **Workflow templates:** Further standardization opportunities
- **Advanced caching:** Cross-workflow cache sharing
- **Notification integration:** Slack/Discord alerts for failures
- **Performance monitoring:** Workflow execution time tracking
- **Auto-scaling:** Dynamic resource allocation based on workload

### Monitoring Integration
- **Metrics collection:** Track workflow success rates
- **Alert configuration:** Notify on critical failures
- **Dashboard creation:** Centralized workflow monitoring
- **SLA monitoring:** Track against performance targets