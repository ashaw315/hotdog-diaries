import { NextResponse } from 'next/server';
import { redditScanningService } from '@/lib/services/reddit-scanning';

export async function GET() {
  const debugLog = [];
  
  function log(stage: string, message: string, data?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      stage,
      message,
      data: data || null
    };
    debugLog.push(entry);
    console.log(`[${stage}] ${message}`, data || '');
  }

  try {
    log('INIT', '🔍 Starting Reddit scan debug');
    
    // Test 1: Get scan configuration
    log('CONFIG', '⚙️ Getting Reddit scan configuration');
    const config = await redditScanningService.getScanConfig();
    log('CONFIG_RESULT', 'Scan configuration retrieved', {
      isEnabled: config.isEnabled,
      maxPostsPerScan: config.maxPostsPerScan,
      targetSubreddits: config.targetSubreddits,
      searchTerms: config.searchTerms,
      minScore: config.minScore
    });

    if (!config.isEnabled) {
      log('CONFIG_DISABLED', '❌ Reddit scanning is DISABLED!');
      return NextResponse.json({ 
        error: 'Reddit scanning disabled', 
        debugLog,
        recommendation: 'Enable Reddit scanning in configuration'
      });
    }

    // Test 2: Test connection
    log('CONNECTION', '🔗 Testing Reddit connection');
    const connectionTest = await redditScanningService.testConnection();
    log('CONNECTION_RESULT', `Connection test: ${connectionTest.success ? 'SUCCESS' : 'FAILED'}`, connectionTest);

    // Test 3: Perform actual scan with detailed logging
    log('SCAN_START', '🤖 Starting Reddit scan with debug mode');
    
    try {
      const scanResult = await redditScanningService.performScan({ maxPosts: 5 });
      
      log('SCAN_COMPLETE', '✅ Reddit scan completed', {
        scanId: scanResult.scanId,
        postsFound: scanResult.postsFound,
        postsProcessed: scanResult.postsProcessed,
        postsApproved: scanResult.postsApproved,
        postsRejected: scanResult.postsRejected,
        duplicatesFound: scanResult.duplicatesFound,
        errors: scanResult.errors,
        duration: scanResult.endTime.getTime() - scanResult.startTime.getTime()
      });

      // Analyze the results
      const analysis = {
        scanWorking: true,
        postsFound: scanResult.postsFound,
        processingRate: scanResult.postsFound > 0 ? (scanResult.postsProcessed / scanResult.postsFound) * 100 : 0,
        approvalRate: scanResult.postsProcessed > 0 ? (scanResult.postsApproved / scanResult.postsProcessed) * 100 : 0,
        issues: [],
        recommendations: []
      };

      if (scanResult.postsFound === 0) {
        analysis.issues.push('No posts found by Reddit API');
        analysis.recommendations.push('Check Reddit HTTP service and search terms');
      }

      if (scanResult.postsProcessed === 0 && scanResult.postsFound > 0) {
        analysis.issues.push('Posts found but none processed');
        analysis.recommendations.push('Check content processing pipeline');
      }

      if (scanResult.postsApproved === 0 && scanResult.postsProcessed > 0) {
        analysis.issues.push('Posts processed but none approved');
        analysis.recommendations.push('Check filtering and approval criteria');
      }

      if (scanResult.errors.length > 0) {
        analysis.issues.push(`${scanResult.errors.length} errors occurred`);
        analysis.recommendations.push('Review error messages in scan result');
      }

      log('ANALYSIS', 'Scan analysis complete', analysis);

      return NextResponse.json({
        success: true,
        scanResult,
        analysis,
        debugLog
      });

    } catch (scanError) {
      log('SCAN_ERROR', '❌ Reddit scan failed', { 
        error: scanError.message,
        stack: scanError.stack 
      });
      
      return NextResponse.json({
        success: false,
        error: `Reddit scan failed: ${scanError.message}`,
        debugLog
      }, { status: 500 });
    }

  } catch (error) {
    log('FATAL_ERROR', '💥 Debug failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      debugLog
    }, { status: 500 });
  }
}