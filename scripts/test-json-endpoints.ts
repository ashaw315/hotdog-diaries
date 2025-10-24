#!/usr/bin/env tsx
/**
 * Integration Test: JSON Endpoints
 * 
 * Tests that both /api/admin/debug/db-info and /api/health/posting-source-of-truth 
 * reliably return JSON responses with proper content-type and cache-control headers.
 */

interface TestResult {
  endpoint: string;
  passed: boolean;
  contentType: string | null;
  cacheControl: string | null;
  status: number;
  hasJsonKeys: boolean;
  responseTime: number;
  error?: string;
  authTest?: {
    withoutAuth: { status: number; hasJsonResponse: boolean };
    withAuth: { status: number; hasJsonResponse: boolean };
  };
}

class JsonEndpointTester {
  private baseUrl: string;
  private authToken: string | null;

  constructor(baseUrl = 'http://localhost:3000', authToken: string | null = null) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  private async testEndpoint(
    path: string, 
    requiresAuth = false, 
    expectedKeys: string[] = []
  ): Promise<TestResult> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();
    
    const result: TestResult = {
      endpoint: path,
      passed: false,
      contentType: null,
      cacheControl: null,
      status: 0,
      hasJsonKeys: false,
      responseTime: 0
    };

    try {
      // Test without auth first (if requires auth)
      if (requiresAuth) {
        result.authTest = {
          withoutAuth: await this.makeRequest(url),
          withAuth: { status: 0, hasJsonResponse: false }
        };

        // Test with auth if token provided
        if (this.authToken) {
          result.authTest.withAuth = await this.makeRequest(url, this.authToken);
        }
      }

      // Main test (with auth if required and available)
      const headers = requiresAuth && this.authToken 
        ? { 'Authorization': `Bearer ${this.authToken}` }
        : {};

      const response = await fetch(url, { 
        method: 'GET',
        headers
      });

      result.status = response.status;
      result.contentType = response.headers.get('content-type');
      result.cacheControl = response.headers.get('cache-control');
      result.responseTime = Date.now() - startTime;

      // Parse response as JSON
      const responseText = await response.text();
      let responseJson: any = null;

      try {
        responseJson = JSON.parse(responseText);
        
        // Check for expected keys
        if (expectedKeys.length > 0) {
          result.hasJsonKeys = expectedKeys.every(key => key in responseJson);
        } else {
          result.hasJsonKeys = typeof responseJson === 'object' && responseJson !== null;
        }
      } catch {
        result.hasJsonKeys = false;
        result.error = 'Response is not valid JSON';
      }

      // Determine if test passed
      const hasJsonContentType = result.contentType?.includes('application/json') ?? false;
      const hasNoCacheHeader = result.cacheControl?.includes('no-store') ?? false;
      
      result.passed = hasJsonContentType && hasNoCacheHeader && result.hasJsonKeys && 
                     (requiresAuth ? (this.authToken ? result.status === 200 : result.status === 401) : result.status === 200);

    } catch (error: any) {
      result.error = error.message;
      result.responseTime = Date.now() - startTime;
    }

    return result;
  }

  private async makeRequest(url: string, authToken?: string): Promise<{ status: number; hasJsonResponse: boolean }> {
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      const response = await fetch(url, { method: 'GET', headers });
      
      const responseText = await response.text();
      let hasJsonResponse = false;
      
      try {
        JSON.parse(responseText);
        hasJsonResponse = true;
      } catch {
        hasJsonResponse = false;
      }

      return { status: response.status, hasJsonResponse };
    } catch {
      return { status: 0, hasJsonResponse: false };
    }
  }

  async runTests(): Promise<TestResult[]> {
    console.log('🧪 JSON Endpoint Integration Tests');
    console.log('===================================');
    console.log(`🎯 Base URL: ${this.baseUrl}`);
    console.log(`🔑 Auth Token: ${this.authToken ? 'PROVIDED' : 'NOT PROVIDED'}`);
    console.log('');

    const tests = [
      {
        path: '/api/health/posting-source-of-truth',
        requiresAuth: false,
        expectedKeys: ['status', 'metadata', 'issues', 'recommendations']
      },
      {
        path: '/api/admin/debug/db-info',
        requiresAuth: true,
        expectedKeys: ['timestamp', 'connection_test', 'posted_content_schema', 'sample_data']
      }
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      console.log(`🔍 Testing ${test.path}...`);
      const result = await this.testEndpoint(test.path, test.requiresAuth, test.expectedKeys);
      results.push(result);

      const statusIcon = result.passed ? '✅' : '❌';
      console.log(`  ${statusIcon} ${test.path} (${result.status}) [${result.responseTime}ms]`);
      console.log(`     Content-Type: ${result.contentType || 'MISSING'}`);
      console.log(`     Cache-Control: ${result.cacheControl || 'MISSING'}`);
      console.log(`     JSON Keys: ${result.hasJsonKeys ? 'PRESENT' : 'MISSING'}`);
      
      if (result.authTest) {
        console.log(`     Auth Test - No Token: ${result.authTest.withoutAuth.status} (JSON: ${result.authTest.withoutAuth.hasJsonResponse})`);
        if (this.authToken) {
          console.log(`     Auth Test - With Token: ${result.authTest.withAuth.status} (JSON: ${result.authTest.withAuth.hasJsonResponse})`);
        }
      }
      
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
      console.log('');
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log('📊 SUMMARY');
    console.log('==========');
    console.log(`Total endpoints tested: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log('');

    if (passed === total) {
      console.log('🎉 All JSON endpoint tests passed!');
      console.log('✅ All endpoints return proper JSON with no-cache headers');
    } else {
      console.log('💥 Some JSON endpoint tests failed!');
      console.log('');
      console.log('Failed endpoints:');
      results.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.endpoint}: Status ${result.status}, JSON: ${result.hasJsonKeys}`);
      });
    }

    return results;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://localhost:3000';
  let authToken: string | null = null;

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base-url' && args[i + 1]) {
      baseUrl = args[i + 1];
      i++;
    } else if (args[i] === '--auth-token' && args[i + 1]) {
      authToken = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log('JSON Endpoint Integration Test');
      console.log('');
      console.log('Usage:');
      console.log('  npx tsx scripts/test-json-endpoints.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --base-url URL       Base URL to test (default: http://localhost:3000)');
      console.log('  --auth-token TOKEN   JWT token for admin endpoints');
      console.log('  --help               Show this help');
      console.log('');
      console.log('Examples:');
      console.log('  npx tsx scripts/test-json-endpoints.ts');
      console.log('  npx tsx scripts/test-json-endpoints.ts --base-url https://hotdog-diaries.vercel.app');
      console.log('  npx tsx scripts/test-json-endpoints.ts --auth-token eyJhbGciOi...');
      process.exit(0);
    }
  }

  try {
    const tester = new JsonEndpointTester(baseUrl, authToken);
    const results = await tester.runTests();
    
    // Exit with appropriate code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error: any) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { JsonEndpointTester, type TestResult };