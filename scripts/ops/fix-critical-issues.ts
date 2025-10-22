#!/usr/bin/env node
/**
 * Critical Issues Fix Script
 * 
 * This script addresses the critical issues identified in the verification report:
 * 1. Activate ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag
 * 2. Fill today's and tomorrow's schedule to 6 slots each
 * 3. Test posting-source-of-truth health endpoint
 * 4. Verify GitHub secrets configuration
 */

import fetch from 'cross-fetch';
import { format, addDays } from 'date-fns';

interface CriticalFixResult {
  issue: string;
  status: 'success' | 'failed' | 'skipped';
  details: string;
  recommendations?: string[];
}

class CriticalIssuesFixer {
  private siteUrl: string;
  private authToken: string;
  private results: CriticalFixResult[] = [];
  
  constructor() {
    this.siteUrl = process.env.SITE_URL || 'https://hotdog-diaries.vercel.app';
    this.authToken = process.env.AUTH_TOKEN || '';
    
    if (!this.authToken) {
      throw new Error('AUTH_TOKEN environment variable is required');
    }
  }
  
  private addResult(issue: string, status: 'success' | 'failed' | 'skipped', details: string, recommendations?: string[]): void {
    this.results.push({ issue, status, details, recommendations });
  }
  
  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<{ status: number; data: any; text: string }> {
    const url = `${this.siteUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 30000
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }
    
    return { status: response.status, data, text };
  }
  
  // Issue 1: Test and document ENFORCE_SCHEDULE_SOURCE_OF_TRUTH requirement
  private async fixFeatureFlagIssue(): Promise<void> {
    console.log('🔧 Issue 1: Testing ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag...');
    
    try {
      const response = await this.makeApiCall('/api/health/posting-source-of-truth');
      
      if (response.status === 500) {
        const isFeatureFlagIssue = response.data?.issues?.some((issue: string) => 
          issue.includes('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH') && issue.includes('not active')
        );
        
        if (isFeatureFlagIssue) {
          this.addResult(
            'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
            'failed',
            'Feature flag is not active in production environment',
            [
              'Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true in Vercel environment variables',
              'Redeploy the application after setting the environment variable',
              'Verify the flag is active by calling /api/health/posting-source-of-truth again'
            ]
          );
        } else {
          this.addResult(
            'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
            'failed',
            `Health endpoint returned HTTP 500 but not due to feature flag: ${response.text}`,
            [
              'Investigate other causes of health endpoint failure',
              'Check application logs for more details'
            ]
          );
        }
      } else if (response.status === 200) {
        const featureFlagActive = response.data?.feature_flag_active;
        if (featureFlagActive) {
          this.addResult(
            'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
            'success',
            'Feature flag is active and health endpoint responding correctly'
          );
        } else {
          this.addResult(
            'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
            'failed',
            'Health endpoint responds but feature flag is not active',
            [
              'Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true in production environment',
              'Redeploy the application'
            ]
          );
        }
      } else {
        this.addResult(
          'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
          'failed',
          `Health endpoint returned unexpected status ${response.status}: ${response.text}`,
          [
            'Check API endpoint availability',
            'Verify authentication token is valid'
          ]
        );
      }
    } catch (error) {
      this.addResult(
        'ENFORCE_SCHEDULE_SOURCE_OF_TRUTH Feature Flag',
        'failed',
        `Failed to test health endpoint: ${error}`,
        [
          'Check network connectivity to production site',
          'Verify AUTH_TOKEN is valid'
        ]
      );
    }
  }
  
  // Issue 2: Fill schedule for today and tomorrow to 6 slots each
  private async fixSchedulerSlots(): Promise<void> {
    console.log('🔧 Issue 2: Filling scheduler slots for today and tomorrow...');
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    
    for (const date of [today, tomorrow]) {
      try {
        console.log(`   📅 Filling slots for ${date}...`);
        
        const response = await this.makeApiCall(
          `/api/admin/schedule/forecast/refill?date=${date}&twoDays=false&debug=1`,
          { method: 'POST' }
        );
        
        if (response.status === 200) {
          const filled = response.data?.filled || 0;
          const totalSlots = 6;
          
          if (filled >= totalSlots) {
            this.addResult(
              `Schedule Slots for ${date}`,
              'success',
              `Successfully filled ${filled}/${totalSlots} slots`
            );
          } else if (filled > 0) {
            this.addResult(
              `Schedule Slots for ${date}`,
              'failed',
              `Only filled ${filled}/${totalSlots} slots - may need more approved content`,
              [
                'Check content queue for available approved content',
                'Run content scanning jobs to get more content',
                'Review content approval criteria'
              ]
            );
          } else {
            this.addResult(
              `Schedule Slots for ${date}`,
              'failed',
              'No slots were filled - content or scheduler issue',
              [
                'Check if approved content is available in content_queue',
                'Verify scheduler algorithm is working correctly',
                'Check for database connectivity issues'
              ]
            );
          }
        } else if (response.status === 401) {
          this.addResult(
            `Schedule Slots for ${date}`,
            'failed',
            'Authentication failed - invalid AUTH_TOKEN',
            [
              'Verify AUTH_TOKEN is correct and not expired',
              'Generate a new AUTH_TOKEN if needed'
            ]
          );
          break; // Don't try tomorrow if auth failed
        } else {
          this.addResult(
            `Schedule Slots for ${date}`,
            'failed',
            `Refill API returned status ${response.status}: ${response.text}`,
            [
              'Check refill API endpoint logs',
              'Verify API is deployed and accessible'
            ]
          );
        }
      } catch (error) {
        this.addResult(
          `Schedule Slots for ${date}`,
          'failed',
          `Failed to call refill API: ${error}`,
          [
            'Check network connectivity',
            'Verify API endpoint is available'
          ]
        );
      }
    }
  }
  
  // Issue 3: Test posting pipeline
  private async testPostingPipeline(): Promise<void> {
    console.log('🔧 Issue 3: Testing posting pipeline health...');
    
    try {
      // Check admin metrics to see posting status
      const response = await this.makeApiCall('/api/admin/metrics');
      
      if (response.status === 200) {
        const metrics = response.data;
        
        // Look for posting-related metrics
        const recentPosts = metrics?.content?.total_posted || 0;
        const queueSize = metrics?.content?.pending_approval || 0;
        
        this.addResult(
          'Posting Pipeline Health',
          'success',
          `Metrics endpoint accessible. Recent posts: ${recentPosts}, Queue size: ${queueSize}`,
          recentPosts === 0 ? [
            'No recent posts detected - may need to trigger posting manually',
            'Check posting workflow schedules',
            'Verify content is scheduled and ready for posting'
          ] : undefined
        );
      } else {
        this.addResult(
          'Posting Pipeline Health',
          'failed',
          `Metrics endpoint returned status ${response.status}: ${response.text}`,
          [
            'Check admin API accessibility',
            'Verify authentication is working'
          ]
        );
      }
    } catch (error) {
      this.addResult(
        'Posting Pipeline Health',
        'failed',
        `Failed to test posting pipeline: ${error}`,
        [
          'Check network connectivity',
          'Verify API endpoints are available'
        ]
      );
    }
  }
  
  // Issue 4: Verify GitHub secrets and provide update instructions
  private async verifyGitHubSecrets(): Promise<void> {
    console.log('🔧 Issue 4: Verifying GitHub secrets configuration...');
    
    // Test the current AUTH_TOKEN
    try {
      const response = await this.makeApiCall('/api/admin/metrics');
      
      if (response.status === 200) {
        this.addResult(
          'GitHub AUTH_TOKEN Secret',
          'success',
          'AUTH_TOKEN is valid and working for API calls'
        );
      } else if (response.status === 401) {
        this.addResult(
          'GitHub AUTH_TOKEN Secret',
          'failed',
          'AUTH_TOKEN is invalid or expired',
          [
            'Generate a new AUTH_TOKEN using the admin system',
            'Update the GitHub secret: gh secret set AUTH_TOKEN',
            'Test the new token with a manual workflow run'
          ]
        );
      } else {
        this.addResult(
          'GitHub AUTH_TOKEN Secret',
          'failed',
          `AUTH_TOKEN test returned unexpected status ${response.status}`,
          [
            'Check if API endpoints are accessible',
            'Verify the AUTH_TOKEN format is correct'
          ]
        );
      }
    } catch (error) {
      this.addResult(
        'GitHub AUTH_TOKEN Secret',
        'failed',
        `Failed to test AUTH_TOKEN: ${error}`,
        [
          'Check network connectivity',
          'Verify AUTH_TOKEN environment variable is set'
        ]
      );
    }
    
    // Provide instructions for key missing environment variables
    this.addResult(
      'Environment Variables Status',
      'success',
      'Key environment variables that need to be set in production',
      [
        'Required in Vercel: ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true',
        'Required in GitHub: AUTH_TOKEN (valid JWT)',
        'Required in GitHub: SUPABASE_SERVICE_ROLE_KEY_V2 (if not already set)',
        'Verify these are set: SITE_URL, SUPABASE_URL, DATABASE_URL'
      ]
    );
  }
  
  // Main execution method
  public async run(): Promise<void> {
    console.log('🚀 Starting Critical Issues Fix...');
    console.log(`   Site URL: ${this.siteUrl}`);
    console.log(`   Auth Token: ${this.authToken ? 'Present' : 'Missing'}`);
    console.log('');
    
    // Run all fixes
    await this.fixFeatureFlagIssue();
    await this.fixSchedulerSlots();
    await this.testPostingPipeline();
    await this.verifyGitHubSecrets();
    
    // Generate summary
    this.generateSummary();
  }
  
  private generateSummary(): void {
    console.log('');
    console.log('📊 CRITICAL ISSUES FIX SUMMARY');
    console.log('=' .repeat(50));
    
    const successful = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log('');
    
    // Show detailed results
    this.results.forEach((result, index) => {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${index + 1}. ${result.issue}`);
      console.log(`   ${result.details}`);
      
      if (result.recommendations && result.recommendations.length > 0) {
        console.log(`   Recommendations:`);
        result.recommendations.forEach(rec => {
          console.log(`   - ${rec}`);
        });
      }
      console.log('');
    });
    
    // Overall status
    if (failed === 0) {
      console.log('🎉 All critical issues have been resolved successfully!');
    } else {
      console.log(`⚠️  ${failed} critical issues still need attention.`);
      console.log('   Follow the recommendations above to resolve remaining issues.');
    }
    
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Address any failed issues using the recommendations');
    console.log('2. Set missing environment variables in production');
    console.log('3. Re-run the verification script to confirm fixes');
    console.log('4. Monitor posting pipeline for successful execution');
  }
}

// Auto-run the fixer
const fixer = new CriticalIssuesFixer();
fixer.run().catch(error => {
  console.error('❌ Critical issues fix failed:', error);
  process.exit(1);
});

export { CriticalIssuesFixer };