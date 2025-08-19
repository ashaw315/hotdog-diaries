import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check for Vercel-specific environment variables that might cause authentication
    const vercelEnvs = {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_REGION: process.env.VERCEL_REGION,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      NODE_ENV: process.env.NODE_ENV,
      
      // These could trigger team/org authentication
      VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID ? 'SET' : undefined,
      VERCEL_ORG_ID: process.env.VERCEL_ORG_ID ? 'SET' : undefined,
      VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID ? 'SET' : undefined,
      VERCEL_TOKEN: process.env.VERCEL_TOKEN ? 'SET' : undefined,
      
      // Check if this looks like a team deployment
      isTeamDeployment: !!(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID),
      isPreview: process.env.VERCEL_ENV === 'preview',
      
      // Domain info
      hostname: process.env.VERCEL_URL,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Environment variables checked',
      environment: vercelEnvs,
      // Add analysis
      analysis: {
        likelyIssue: vercelEnvs.isTeamDeployment ? 
          'Team deployment with SSO enabled' : 
          vercelEnvs.isPreview ? 
            'Preview deployment with authentication' : 
            'Unknown authentication source',
        
        recommendations: vercelEnvs.isTeamDeployment ? [
          'Check team SSO settings in Vercel dashboard',
          'Deploy from personal account instead of team',
          'Disable team authentication for this project'
        ] : vercelEnvs.isPreview ? [
          'Deploy to production branch',
          'Set up custom domain',
          'Access via Vercel dashboard instead of direct URL'
        ] : [
          'Check project settings in Vercel dashboard',
          'Verify deployment type and permissions'
        ]
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}