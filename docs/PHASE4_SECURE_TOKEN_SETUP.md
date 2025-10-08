# 🔑 Phase 4: Secure Token Setup Guide

## Overview

Phase 4 of the CI Auto-Healing system requires a Personal Access Token (PAT) to trigger repository dispatch events after successful remediation. The default `GITHUB_TOKEN` has limited permissions and cannot trigger `repository_dispatch` events, resulting in 403 errors.

## 🔧 Step 1: Generate Personal Access Token

### For GitHub.com (Classic Personal Access Token)

1. **Navigate to GitHub Settings**
   - Go to [GitHub.com](https://github.com)
   - Click your profile picture → Settings
   - In the left sidebar, click "Developer settings"
   - Click "Personal access tokens" → "Tokens (classic)"

2. **Generate New Token**
   - Click "Generate new token" → "Generate new token (classic)"
   - **Note**: Name it `CI_REDISPATCH_TOKEN - Hotdog Diaries Auto-Healing`
   - **Expiration**: Set to 90 days (or custom as needed)

3. **Required Scopes**
   ```
   ✅ repo (Full control of private repositories)
     ✅ repo:status (Access commit status)
     ✅ repo_deployment (Access deployment status)
     ✅ public_repo (Access public repositories)
   
   ✅ workflow (Update GitHub Action workflows)
   ```

4. **Security Considerations**
   - ⚠️ **Minimum Scope Principle**: Only select the scopes listed above
   - 🔒 **Repository Access**: If using fine-grained tokens, limit to this repository only
   - ⏰ **Expiration**: Set reasonable expiration (90-365 days)
   - 📝 **Documentation**: Record when token expires for renewal

### For GitHub Enterprise (if applicable)

Follow the same process but navigate to your enterprise GitHub instance.

## 🏗️ Step 2: Configure Repository Secret

1. **Navigate to Repository Settings**
   - Go to your repository: `https://github.com/[username]/hotdog-diaries`
   - Click "Settings" tab
   - In left sidebar, click "Secrets and variables" → "Actions"

2. **Add Repository Secret**
   - Click "New repository secret"
   - **Name**: `CI_REDISPATCH_TOKEN`
   - **Secret**: Paste the Personal Access Token generated above
   - Click "Add secret"

3. **Verify Secret Configuration**
   ```yaml
   # The secret should be accessible in workflows as:
   ${{ secrets.CI_REDISPATCH_TOKEN }}
   ```

## 🔐 Security Best Practices

### Token Management
- **Rotation Schedule**: Plan to rotate the token every 90 days
- **Access Monitoring**: Regularly review token usage in GitHub audit logs
- **Revocation Plan**: Immediately revoke if compromised

### Repository Access
- **Scope Limitation**: Token only has access to necessary permissions
- **Environment Separation**: Consider different tokens for different environments
- **Team Access**: Document who has access to regenerate the token

## 🧪 Step 3: Verify Token Works

### Test API Access
```bash
# Test repository access (replace [token] and [repo])
curl -H "Authorization: Bearer [token]" \
     https://api.github.com/repos/[username]/hotdog-diaries

# Test dispatch event (what Phase 4 will use)
curl -X POST \
     -H "Accept: application/vnd.github.v3+json" \
     -H "Authorization: Bearer [token]" \
     https://api.github.com/repos/[username]/hotdog-diaries/dispatches \
     -d '{"event_type": "test-dispatch"}'
```

### Expected Responses
- **200 OK**: Token works correctly
- **401 Unauthorized**: Token is invalid or expired
- **403 Forbidden**: Token lacks required permissions
- **404 Not Found**: Repository path is incorrect

## 📋 Troubleshooting

### Common Issues

1. **403 "Resource not accessible by integration"**
   - ✅ **Solution**: Use PAT instead of `GITHUB_TOKEN`
   - ✅ **Verify**: Token has `repo` and `workflow` scopes

2. **401 "Bad credentials"**
   - ✅ **Check**: Token is correctly copied to repository secrets
   - ✅ **Verify**: Token hasn't expired
   - ✅ **Regenerate**: Create new token if needed

3. **Token Expiration**
   - ✅ **Monitor**: Set calendar reminder 1 week before expiration
   - ✅ **Rotate**: Generate new token and update secret
   - ✅ **Test**: Verify new token works before old one expires

### Debugging Steps
```bash
# Check if secret is accessible in workflow
echo "Token exists: ${{ secrets.CI_REDISPATCH_TOKEN != '' }}"

# Test API call in workflow
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${{ secrets.CI_REDISPATCH_TOKEN }}" \
  https://api.github.com/repos/${{ github.repository }}
```

## 🔄 Step 4: Token Rotation Process

### When to Rotate
- **Scheduled**: Every 90 days (recommended)
- **Security Event**: If token might be compromised
- **Team Changes**: When team members with access leave

### Rotation Steps
1. Generate new PAT with same scopes
2. Update repository secret `CI_REDISPATCH_TOKEN`
3. Test Phase 4 workflow execution
4. Revoke old token
5. Update documentation with new expiration date

## 📊 Monitoring and Maintenance

### Success Metrics
- **Dispatch Success Rate**: 99%+ successful repository dispatches
- **Token Uptime**: No authentication failures due to token issues
- **Security Compliance**: No security violations or unauthorized access

### Monthly Checklist
- [ ] Verify token expiration date
- [ ] Check GitHub audit logs for token usage
- [ ] Test dispatch functionality
- [ ] Review and update documentation if needed

## 🚀 Integration with Phase 4

Once the token is configured, Phase 4 workflows will:

1. **Use Secure Authentication**
   ```yaml
   env:
     GH_TOKEN: ${{ secrets.CI_REDISPATCH_TOKEN }}
   ```

2. **Trigger Repository Dispatches**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $GH_TOKEN" \
     https://api.github.com/repos/${{ github.repository }}/dispatches \
     -d '{"event_type": "post-remediation-check"}'
   ```

3. **Enable Automated Re-runs**
   - Post-remediation validation
   - Health score re-evaluation
   - Rollback triggers if needed

---

**Security Note**: This token provides elevated permissions. Follow your organization's security policies and consider additional restrictions if needed.