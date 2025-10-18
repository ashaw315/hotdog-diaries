#!/usr/bin/env node

/**
 * VERCEL DEPLOYMENT VERIFICATION SCRIPT
 * 
 * This script verifies that the Vercel deployment has the correct AUTH_TOKEN
 * and that the posting endpoints are working properly after security breach recovery.
 * 
 * USAGE:
 * - Production: SITE_URL=https://hotdog-diaries.vercel.app AUTH_TOKEN=your_token npx tsx scripts/verify-deployment.ts
 * - Development: npx tsx scripts/verify-deployment.ts (uses localhost)
 */

interface DeploymentVerificationResult {
  authTokenValid: boolean;
  authTokenLength: number;
  apiEndpointReachable: boolean;
  postingEndpointWorking: boolean;
  systemVerificationWorking: boolean;
  databaseConnected: boolean;
  overallStatus: 'PASS' | 'FAIL';
  issues: string[];
  recommendations: string[];
}

class DeploymentVerifier {
  private siteUrl: string;
  private authToken: string;
  private isDevelopment: boolean;

  constructor() {
    this.siteUrl = process.env.SITE_URL || 'http://localhost:3001';
    this.authToken = process.env.AUTH_TOKEN || '';
    this.isDevelopment = this.siteUrl.includes('localhost');
    
    console.log('🔍 VERCEL DEPLOYMENT VERIFICATION');
    console.log('==================================');
    console.log(`🌐 Site URL: ${this.siteUrl}`);
    console.log(`🔐 Token provided: ${this.authToken ? 'Yes' : 'No'}`);
    console.log(`📍 Environment: ${this.isDevelopment ? 'Development' : 'Production'}`);
    console.log('');
  }

  /**
   * Make HTTP request with proper error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<{ 
    success: boolean; 
    data?: any; 
    status?: number; 
    error?: string 
  }> {
    try {
      const url = `${this.siteUrl}${endpoint}`;
      console.log(`📡 Testing: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
          ...options.headers
        }
      });

      const text = await response.text();
      let data = null;
      
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        success: response.ok,
        data,
        status: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test basic API connectivity
   */
  async testApiConnectivity(): Promise<{ reachable: boolean; error?: string }> {
    console.log('🌐 Testing basic API connectivity...');
    
    const result = await this.makeRequest('/api/health');
    
    if (result.success) {
      console.log('✅ API is reachable');
      return { reachable: true };
    } else {
      console.log(`❌ API unreachable: ${result.error}`);
      return { reachable: false, error: result.error };
    }
  }

  /**
   * Test system verification endpoint (checks AUTH_TOKEN)
   */
  async testSystemVerification(): Promise<{ 
    working: boolean; 
    tokenLength?: number; 
    databaseConnected?: boolean;
    error?: string 
  }> {
    console.log('🔐 Testing system verification endpoint...');
    
    if (!this.authToken) {
      console.log('❌ No AUTH_TOKEN provided for system verification');
      return { working: false, error: 'No AUTH_TOKEN provided' };
    }

    const result = await this.makeRequest('/api/admin/system-verification');
    
    if (result.success && result.data) {
      const tokenLength = result.data.tokenLength || 0;
      const dbConnected = result.data.databaseConnected || false;
      
      console.log(`✅ System verification successful`);
      console.log(`   Token length: ${tokenLength} chars`);
      console.log(`   Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
      
      return { 
        working: true, 
        tokenLength, 
        databaseConnected: dbConnected 
      };
    } else {
      console.log(`❌ System verification failed: ${result.error}`);
      return { working: false, error: result.error };
    }
  }

  /**
   * Test posting endpoint functionality
   */
  async testPostingEndpoint(): Promise<{ working: boolean; error?: string; data?: any }> {
    console.log('🚀 Testing posting endpoint...');
    
    if (!this.authToken) {
      console.log('❌ No AUTH_TOKEN provided for posting test');
      return { working: false, error: 'No AUTH_TOKEN provided' };
    }

    // Use GET first to check availability
    const getResult = await this.makeRequest('/api/admin/posting/post-now');
    
    if (getResult.success) {
      console.log('✅ Posting endpoint is accessible');
      console.log(`   Ready to post: ${getResult.data?.readyToPost || 0} items`);
      
      return { working: true, data: getResult.data };
    } else if (getResult.status === 401) {
      console.log('❌ Posting endpoint authentication failed - AUTH_TOKEN is invalid');
      return { working: false, error: 'Authentication failed - invalid AUTH_TOKEN' };
    } else {
      console.log(`❌ Posting endpoint failed: ${getResult.error}`);
      return { working: false, error: getResult.error };
    }
  }

  /**
   * Run comprehensive deployment verification
   */
  async verify(): Promise<DeploymentVerificationResult> {
    console.log('🔍 Starting comprehensive deployment verification...\n');
    
    const result: DeploymentVerificationResult = {
      authTokenValid: false,
      authTokenLength: this.authToken.length,
      apiEndpointReachable: false,
      postingEndpointWorking: false,
      systemVerificationWorking: false,
      databaseConnected: false,
      overallStatus: 'FAIL',
      issues: [],
      recommendations: []
    };

    // 1. Test basic connectivity
    const connectivityTest = await this.testApiConnectivity();
    result.apiEndpointReachable = connectivityTest.reachable;
    
    if (!result.apiEndpointReachable) {
      result.issues.push('API endpoint unreachable');
      result.recommendations.push('Check Vercel deployment status and DNS configuration');
    }

    // 2. Test system verification (AUTH_TOKEN validation)
    if (this.authToken) {
      const systemTest = await this.testSystemVerification();
      result.systemVerificationWorking = systemTest.working;
      result.databaseConnected = systemTest.databaseConnected || false;
      
      if (systemTest.working && systemTest.tokenLength) {
        result.authTokenValid = systemTest.tokenLength > 100; // JWT tokens should be long
        
        if (!result.authTokenValid) {
          result.issues.push(`AUTH_TOKEN is too short (${systemTest.tokenLength} chars) - should be 200+ chars`);
          result.recommendations.push('Update AUTH_TOKEN in Vercel environment variables with a proper JWT token');
        }
      } else {
        result.issues.push('System verification endpoint failed');
        result.recommendations.push('Check AUTH_TOKEN in Vercel environment variables');
      }

      if (!result.databaseConnected) {
        result.issues.push('Database connection failed');
        result.recommendations.push('Check database credentials and connection strings');
      }
    } else {
      result.issues.push('No AUTH_TOKEN provided');
      result.recommendations.push('Set AUTH_TOKEN environment variable for testing');
    }

    // 3. Test posting functionality
    const postingTest = await this.testPostingEndpoint();
    result.postingEndpointWorking = postingTest.working;
    
    if (!result.postingEndpointWorking) {
      result.issues.push('Posting endpoint not working');
      result.recommendations.push('Check AUTH_TOKEN and ensure content queue has approved posts');
    }

    // Determine overall status
    const criticalTests = [
      result.apiEndpointReachable,
      result.authTokenValid,
      result.postingEndpointWorking,
      result.databaseConnected
    ];
    
    result.overallStatus = criticalTests.every(test => test) ? 'PASS' : 'FAIL';

    return result;
  }

  /**
   * Display verification results
   */
  displayResults(result: DeploymentVerificationResult): void {
    console.log('\n📊 DEPLOYMENT VERIFICATION RESULTS');
    console.log('===================================');
    
    // Status indicators
    const statusIcon = (status: boolean) => status ? '✅' : '❌';
    
    console.log(`${statusIcon(result.apiEndpointReachable)} API Endpoint Reachable`);
    console.log(`${statusIcon(result.authTokenValid)} AUTH_TOKEN Valid (${result.authTokenLength} chars)`);
    console.log(`${statusIcon(result.systemVerificationWorking)} System Verification Working`);
    console.log(`${statusIcon(result.databaseConnected)} Database Connected`);
    console.log(`${statusIcon(result.postingEndpointWorking)} Posting Endpoint Working`);
    
    console.log('\n🎯 OVERALL STATUS');
    console.log('=================');
    
    if (result.overallStatus === 'PASS') {
      console.log('🎉 PASS - Deployment is working correctly!');
      console.log('✅ AUTH_TOKEN is properly configured');
      console.log('✅ All endpoints are functional');
      console.log('✅ Ready for automated posting');
    } else {
      console.log('🚨 FAIL - Deployment has issues that need fixing');
      
      if (result.issues.length > 0) {
        console.log('\n❌ CRITICAL ISSUES:');
        result.issues.forEach((issue, i) => {
          console.log(`  ${i + 1}. ${issue}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log('\n🔧 RECOMMENDED ACTIONS:');
        result.recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec}`);
        });
      }
    }

    // Additional guidance for common issues
    if (!result.authTokenValid) {
      console.log('\n🚨 AUTH_TOKEN ISSUE DETECTED:');
      console.log('The current AUTH_TOKEN appears to be invalid or expired.');
      console.log('This is likely the cause of the 28+ hour posting outage.');
      console.log('\nIMMEDIATE ACTIONS:');
      console.log('1. Run: npx tsx scripts/rotate-secrets-emergency.ts');
      console.log('2. Update AUTH_TOKEN in Vercel environment variables');
      console.log('3. Update AUTH_TOKEN in GitHub Actions secrets');
      console.log('4. Re-run this verification script');
    }

    if (!result.databaseConnected && !this.isDevelopment) {
      console.log('\n🚨 DATABASE CONNECTION ISSUE:');
      console.log('Database connection failed in production.');
      console.log('Check Supabase credentials and connection strings.');
    }

    console.log('\n📋 NEXT STEPS:');
    if (result.overallStatus === 'PASS') {
      console.log('✅ Deployment verified - no action needed');
      console.log('✅ GitHub Actions should now work properly');
      console.log('✅ Posting schedule restored');
    } else {
      console.log('🔄 Fix the issues listed above');
      console.log('🔄 Re-run this script to verify fixes');
      console.log('🔄 Test a manual post to confirm functionality');
    }
  }
}

async function main() {
  const verifier = new DeploymentVerifier();
  
  try {
    const results = await verifier.verify();
    verifier.displayResults(results);
    
    // Exit with appropriate code
    process.exit(results.overallStatus === 'PASS' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error('This indicates a critical deployment issue');
    process.exit(1);
  }
}

// Run verification if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('verify-deployment')
if (isMainModule) {
  main();
}

export default DeploymentVerifier;