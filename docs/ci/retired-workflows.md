# Retired CI Workflows

This document tracks workflows that have been retired from the CI pipeline and their replacement paths.

## 🗑️ Retired Workflows

### old-scanner.yml
**Retired:** 2025-10-19  
**Reason:** Superseded by individual platform scanners with better error handling and preflight checks

**Replacement Path:**
- YouTube content scanning: `.github/workflows/scan-youtube.yml`
- Reddit content scanning: `.github/workflows/scan-reddit.yml`
- Other platforms: See individual `scan-*.yml` workflows

**Migration Notes:**
- All functionality has been migrated to individual platform scanners
- New scanners include preflight secret validation
- Improved error handling with neutral conclusions when secrets are missing
- Better retry logic for API rate limits

## 📋 Retirement Process

When retiring a workflow:

1. **Document the retirement** in this file with:
   - Retirement date
   - Reason for retirement
   - Clear replacement path
   - Migration notes

2. **Update secret validation** to move secrets used only by retired workflows to optional list

3. **Archive workflow file** rather than deleting to preserve history

4. **Update runbook references** to point to new workflows

## 🔄 Replacement Guidelines

- Individual platform scanners provide better isolation
- Each scanner includes preflight checks for required secrets
- Failed secret checks result in neutral conclusions, not failures
- Scanners include proper retry logic for transient failures
- Concurrency controls prevent overlapping scans