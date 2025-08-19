import { NextResponse } from 'next/server';

export async function GET() {
  const steps = [];
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  try {
    console.log('🚀 Starting production setup...');
    
    // Step 1: Initialize database
    console.log('Step 1: Initializing database...');
    const dbResponse = await fetch(`${baseUrl}/api/init-db`);
    const dbResult = await dbResponse.json();
    steps.push({ step: 'Database Initialization', ...dbResult });
    
    if (!dbResult.success) {
      throw new Error(`Database initialization failed: ${dbResult.error}`);
    }
    
    // Step 2: Check if daily scan route exists and trigger it
    console.log('Step 2: Triggering initial content scan...');
    try {
      const scanResponse = await fetch(`${baseUrl}/api/cron/daily`, {
        method: 'GET'
      });
      const scanResult = await scanResponse.json();
      steps.push({ step: 'Content Scanning', success: true, message: 'Scan triggered', ...scanResult });
    } catch (scanError) {
      steps.push({ 
        step: 'Content Scanning', 
        success: false, 
        message: 'Scan route not available or failed',
        error: scanError.message 
      });
    }
    
    // Step 3: Health check
    console.log('Step 3: Performing health check...');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      const healthResult = await healthResponse.json();
      steps.push({ step: 'Health Check', ...healthResult });
    } catch (healthError) {
      steps.push({ 
        step: 'Health Check', 
        success: false, 
        message: 'Health check failed',
        error: healthError.message 
      });
    }
    
    return NextResponse.json({
      success: true,
      message: '🎉 Production setup completed!',
      baseUrl,
      steps,
      nextSteps: [
        '1. Visit /admin to access the admin login',
        '2. Username: admin',
        '3. Password: StrongAdminPass123!',
        '4. Content will appear in the main feed after scanning completes',
        '5. Check /api/health for system status'
      ],
      adminCredentials: {
        loginUrl: `${baseUrl}/admin`,
        username: 'admin',
        password: 'StrongAdminPass123!',
        note: 'Please change this password after first login'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      steps,
      partialSetup: steps.length > 0,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}