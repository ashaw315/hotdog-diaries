# GIT HISTORY CLEANUP INSTRUCTIONS
# ===================================

## CRITICAL: Remove exposed secrets from Git history

### Method 1: BFG Repo-Cleaner (Recommended)

1. **Install BFG Repo-Cleaner:**
   ```bash
   # macOS with Homebrew
   brew install bfg
   
   # Or download from: https://github.com/rtyley/bfg-repo-cleaner
   ```

2. **Create a fresh clone:**
   ```bash
   git clone --mirror https://github.com/your-username/hotdog-diaries.git
   cd hotdog-diaries.git
   ```

3. **Remove exposed secrets:**
   ```bash
   # Remove JWT tokens
   bfg --replace-text <(echo 'eyJ*==[REMOVED-JWT-TOKEN]') .
   
   # Remove long hex secrets
   bfg --replace-text <(echo '*{64,}==[REMOVED-SECRET]') .
   
   # Clean up specific commits if needed
   bfg --delete-files '*.env.production' .
   ```

4. **Clean up Git history:**
   ```bash
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```

5. **Force push cleaned history:**
   ```bash
   git push --force
   ```

### Method 2: Git Filter-Branch (Alternative)

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.production' \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
git push origin --force --tags
```

### IMPORTANT NOTES:

⚠️  **This will rewrite Git history - coordinate with team members**
⚠️  **All contributors must re-clone the repository after cleanup**
⚠️  **Update any CI/CD systems that reference old commit hashes**

### Verify Cleanup:

```bash
# Check that secrets are removed
git log --all --full-history -p -S"eyJ" | head -50
git log --all --full-history -p -S"AUTH_TOKEN" | head -50
```

### Post-Cleanup Steps:

1. **Update environment variables in Vercel dashboard**
2. **Rotate all exposed secrets**
3. **Notify team to re-clone repository**
4. **Update CI/CD configurations**
