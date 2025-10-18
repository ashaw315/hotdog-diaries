#!/usr/bin/env node

/**
 * SECURITY AUDIT: Check for Exposed Secrets in Repository
 * 
 * This script scans the repository for exposed secrets that need to be
 * removed from Git history.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface ExposedSecret {
  file: string;
  commit: string;
  type: 'JWT_TOKEN' | 'SUPABASE_KEY' | 'API_KEY' | 'PASSWORD' | 'OTHER';
  pattern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

class SecurityAuditor {
  private exposedSecrets: ExposedSecret[] = [];

  constructor() {
    console.log('🔍 SECURITY AUDIT: Scanning for Exposed Secrets');
    console.log('===============================================');
  }

  /**
   * Scan Git history for exposed secrets
   */
  async scanGitHistory(): Promise<void> {
    console.log('📜 Scanning Git history for exposed secrets...');

    const dangerousPatterns = [
      {
        pattern: 'eyJ[A-Za-z0-9_-]{100,}',
        type: 'JWT_TOKEN' as const,
        severity: 'CRITICAL' as const,
        description: 'JWT tokens (Base64 encoded)'
      },
      {
        pattern: 'sk-[A-Za-z0-9]{40,}',
        type: 'API_KEY' as const,
        severity: 'CRITICAL' as const,
        description: 'OpenAI API keys'
      },
      {
        pattern: 'SUPABASE_SERVICE_ROLE_KEY.*[A-Za-z0-9_-]{100,}',
        type: 'SUPABASE_KEY' as const,
        severity: 'CRITICAL' as const,
        description: 'Supabase service role keys'
      },
      {
        pattern: 'AUTH_TOKEN.*eyJ[A-Za-z0-9_-]{100,}',
        type: 'JWT_TOKEN' as const,
        severity: 'CRITICAL' as const,
        description: 'Auth tokens in environment files'
      },
      {
        pattern: 'JWT_SECRET.*[A-Fa-f0-9]{64,}',
        type: 'OTHER' as const,
        severity: 'HIGH' as const,
        description: 'JWT secrets (hex encoded)'
      },
      {
        pattern: 'password.*[A-Za-z0-9!@#$%^&*]{8,}',
        type: 'PASSWORD' as const,
        severity: 'MEDIUM' as const,
        description: 'Passwords in config files'
      }
    ];

    for (const pattern of dangerousPatterns) {
      try {
        const cmd = `git log --all --full-history -p -S"${pattern.pattern.split('.*')[0]}" --grep="${pattern.pattern.split('.*')[0]}" | head -100`;
        const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).toString();
        
        if (result.includes('commit ')) {
          console.log(`⚠️  Found potential ${pattern.description} in Git history`);
          
          // Extract commit hashes
          const commits = result.match(/commit [a-f0-9]{40}/g) || [];
          commits.forEach(commit => {
            this.exposedSecrets.push({
              file: 'git-history',
              commit: commit.replace('commit ', ''),
              type: pattern.type,
              pattern: pattern.pattern,
              severity: pattern.severity
            });
          });
        }
      } catch (error) {
        // Continue scanning even if one pattern fails
      }
    }
  }

  /**
   * Check current files for secrets
   */
  async scanCurrentFiles(): Promise<void> {
    console.log('📁 Scanning current files for secrets...');

    const sensitiveFiles = [
      '.env',
      '.env.local', 
      '.env.production',
      '.env.development',
      'package.json',
      'vercel.json'
    ];

    for (const file of sensitiveFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for JWT tokens
        if (content.match(/eyJ[A-Za-z0-9_-]{100,}/)) {
          this.exposedSecrets.push({
            file,
            commit: 'current',
            type: 'JWT_TOKEN',
            pattern: 'JWT token in file',
            severity: 'CRITICAL'
          });
        }
        
        // Check for long secrets
        if (content.match(/[A-Fa-f0-9]{64,}/)) {
          this.exposedSecrets.push({
            file,
            commit: 'current',
            type: 'OTHER',
            pattern: 'Long hex secret in file',
            severity: 'HIGH'
          });
        }
      }
    }
  }

  /**
   * Generate .env.example template
   */
  generateEnvExample(): void {
    console.log('📝 Generating .env.example template...');

    const envExample = `# Hotdog Diaries Environment Variables Template
# Copy this file to .env.local and fill in your actual values
# NEVER commit .env files with real secrets

# Authentication
AUTH_TOKEN="your-jwt-auth-token-here"
JWT_SECRET="your-256-bit-jwt-secret-here"
JWT_REFRESH_SECRET="your-256-bit-refresh-secret-here"

# Admin User Configuration
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-strong-admin-password"
ADMIN_EMAIL="admin@example.com"
ADMIN_FULL_NAME="Administrator"

# Database Configuration (Development)
DATABASE_USER="your-db-user"
DATABASE_PASSWORD="your-db-password"
DATABASE_URL_SQLITE="./hotdog_diaries_dev.db"

# Database Configuration (Production)
POSTGRES_URL="postgres://user:password@host:port/database"
POSTGRES_PRISMA_URL="postgres://user:password@host:port/database?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://user:password@host:port/database"

# Supabase Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Social Media API Keys
REDDIT_CLIENT_ID="your-reddit-client-id"
REDDIT_CLIENT_SECRET="your-reddit-client-secret"
REDDIT_USERNAME="your-reddit-username"
REDDIT_PASSWORD="your-reddit-password"
REDDIT_USER_AGENT="YourApp/1.0"

YOUTUBE_API_KEY="your-youtube-api-key"
GIPHY_API_KEY="your-giphy-api-key"
PIXABAY_API_KEY="your-pixabay-api-key"
IMGUR_CLIENT_ID="your-imgur-client-id"

BLUESKY_IDENTIFIER="your-bluesky-handle"
BLUESKY_APP_PASSWORD="your-bluesky-app-password"

TUMBLR_API_KEY="your-tumblr-api-key"
TUMBLR_API_SECRET="your-tumblr-api-secret"

# Security
CRON_SECRET="your-cron-secret"

# Feature Flags
ENABLE_AUTO_SCANNING="true"
ENABLE_AUTO_POSTING="true"
`;

    fs.writeFileSync('.env.example', envExample);
    console.log('✅ Created .env.example template');
  }

  /**
   * Update .gitignore to exclude sensitive files
   */
  updateGitignore(): void {
    console.log('🔒 Updating .gitignore for sensitive files...');

    const gitignoreAdditions = `
# Environment variables (SECURITY)
.env
.env.local
.env.development
.env.test
.env.production
.env.*.local

# Secrets and credentials
*.key
*.pem
*.p12
*.pfx
secrets/
credentials/

# Database files
*.db
*.sqlite
*.sqlite3

# Temporary files that might contain secrets
*.tmp
*.temp
.DS_Store
`;

    let gitignoreContent = '';
    if (fs.existsSync('.gitignore')) {
      gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
    }

    if (!gitignoreContent.includes('# Environment variables (SECURITY)')) {
      fs.appendFileSync('.gitignore', gitignoreAdditions);
      console.log('✅ Updated .gitignore with security exclusions');
    } else {
      console.log('✅ .gitignore already contains security exclusions');
    }
  }

  /**
   * Generate Git history cleanup instructions
   */
  generateCleanupInstructions(): void {
    console.log('🧹 Generating Git history cleanup instructions...');

    const instructions = `# GIT HISTORY CLEANUP INSTRUCTIONS
# ===================================

## CRITICAL: Remove exposed secrets from Git history

### Method 1: BFG Repo-Cleaner (Recommended)

1. **Install BFG Repo-Cleaner:**
   \`\`\`bash
   # macOS with Homebrew
   brew install bfg
   
   # Or download from: https://github.com/rtyley/bfg-repo-cleaner
   \`\`\`

2. **Create a fresh clone:**
   \`\`\`bash
   git clone --mirror https://github.com/your-username/hotdog-diaries.git
   cd hotdog-diaries.git
   \`\`\`

3. **Remove exposed secrets:**
   \`\`\`bash
   # Remove JWT tokens
   bfg --replace-text <(echo 'eyJ*==[REMOVED-JWT-TOKEN]') .
   
   # Remove long hex secrets
   bfg --replace-text <(echo '*{64,}==[REMOVED-SECRET]') .
   
   # Clean up specific commits if needed
   bfg --delete-files '*.env.production' .
   \`\`\`

4. **Clean up Git history:**
   \`\`\`bash
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   \`\`\`

5. **Force push cleaned history:**
   \`\`\`bash
   git push --force
   \`\`\`

### Method 2: Git Filter-Branch (Alternative)

\`\`\`bash
git filter-branch --force --index-filter \\
  'git rm --cached --ignore-unmatch .env.production' \\
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
git push origin --force --tags
\`\`\`

### IMPORTANT NOTES:

⚠️  **This will rewrite Git history - coordinate with team members**
⚠️  **All contributors must re-clone the repository after cleanup**
⚠️  **Update any CI/CD systems that reference old commit hashes**

### Verify Cleanup:

\`\`\`bash
# Check that secrets are removed
git log --all --full-history -p -S"eyJ" | head -50
git log --all --full-history -p -S"AUTH_TOKEN" | head -50
\`\`\`

### Post-Cleanup Steps:

1. **Update environment variables in Vercel dashboard**
2. **Rotate all exposed secrets**
3. **Notify team to re-clone repository**
4. **Update CI/CD configurations**
`;

    fs.writeFileSync('GIT-CLEANUP-INSTRUCTIONS.md', instructions);
    console.log('✅ Created GIT-CLEANUP-INSTRUCTIONS.md');
  }

  /**
   * Display security audit results
   */
  displayResults(): void {
    console.log('');
    console.log('🚨 SECURITY AUDIT RESULTS');
    console.log('=========================');

    if (this.exposedSecrets.length === 0) {
      console.log('✅ No exposed secrets detected in current scan');
      return;
    }

    console.log(`❌ Found ${this.exposedSecrets.length} potential security issues:`);
    console.log('');

    const criticalIssues = this.exposedSecrets.filter(s => s.severity === 'CRITICAL');
    const highIssues = this.exposedSecrets.filter(s => s.severity === 'HIGH');
    const mediumIssues = this.exposedSecrets.filter(s => s.severity === 'MEDIUM');

    if (criticalIssues.length > 0) {
      console.log('🔴 CRITICAL Issues (require immediate action):');
      criticalIssues.forEach(issue => {
        console.log(`   - ${issue.type} in ${issue.file} (commit: ${issue.commit.substring(0, 8)})`);
      });
      console.log('');
    }

    if (highIssues.length > 0) {
      console.log('🟠 HIGH Priority Issues:');
      highIssues.forEach(issue => {
        console.log(`   - ${issue.type} in ${issue.file} (commit: ${issue.commit.substring(0, 8)})`);
      });
      console.log('');
    }

    if (mediumIssues.length > 0) {
      console.log('🟡 MEDIUM Priority Issues:');
      mediumIssues.forEach(issue => {
        console.log(`   - ${issue.type} in ${issue.file} (commit: ${issue.commit.substring(0, 8)})`);
      });
      console.log('');
    }

    console.log('📋 REQUIRED ACTIONS:');
    console.log('1. Rotate all exposed secrets immediately');
    console.log('2. Update environment variables in production');
    console.log('3. Clean Git history using BFG Repo-Cleaner');
    console.log('4. Force push cleaned repository');
    console.log('5. Notify team to re-clone repository');
  }
}

async function main() {
  const auditor = new SecurityAuditor();
  
  try {
    await auditor.scanGitHistory();
    await auditor.scanCurrentFiles();
    auditor.generateEnvExample();
    auditor.updateGitignore();
    auditor.generateCleanupInstructions();
    auditor.displayResults();
    
    console.log('');
    console.log('✅ Security audit completed');
    console.log('📁 Generated files: .env.example, GIT-CLEANUP-INSTRUCTIONS.md');
    console.log('⚠️  Review GIT-CLEANUP-INSTRUCTIONS.md for next steps');
    
  } catch (error) {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  }
}

// Run the audit if called directly
if (require.main === module) {
  main();
}

export default SecurityAuditor;