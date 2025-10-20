# CI Workflow Documentation

## ⚠️ Repository Permissions Note

**Important**: Secret Validation may comment on issues. To enable this functionality:
- Repository **Settings** → **Actions** → **Workflow permissions** should be set to **Read and write**
- This allows workflows to create issue comments for tracking validation failures

## 🗑️ Retired Workflows

_This section will track workflows that have been retired from the CI pipeline._

### Currently Active Workflows

All workflows are currently active. This document will be updated as workflows are retired or replaced.

## 📋 Workflow Maintenance

When retiring a workflow:

1. **Document the retirement** in this file with:
   - Retirement date
   - Reason for retirement
   - Clear replacement path (if applicable)
   - Migration notes

2. **Update secret validation** to remove secrets used only by retired workflows

3. **Archive workflow file** rather than deleting to preserve history

4. **Update runbook references** to point to new workflows

## 🔄 Replacement Guidelines

- Individual workflows provide better isolation and debugging
- Each workflow should include proper error handling
- Failed checks should provide clear actionable feedback
- Consider using non-blocking comment steps for tracking issues