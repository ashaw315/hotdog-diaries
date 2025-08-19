import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    POSTGRES_USER: !!process.env.POSTGRES_USER,
    POSTGRES_HOST: !!process.env.POSTGRES_HOST,
    POSTGRES_PASSWORD: !!process.env.POSTGRES_PASSWORD,
    POSTGRES_DATABASE: !!process.env.POSTGRES_DATABASE,
    DATABASE_URL: !!process.env.DATABASE_URL,
    VERCEL: !!process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV
  };

  const hasDatabase = envVars.POSTGRES_URL || envVars.DATABASE_URL;
  
  let connectionTest = { success: false, message: 'No database configured' };
  
  if (hasDatabase) {
    try {
      const { sql } = await import('@vercel/postgres');
      const result = await sql`SELECT 1 as test`;
      connectionTest = { 
        success: true, 
        message: 'Database connected successfully',
        test: result.rows[0]
      };
    } catch (error) {
      connectionTest = { 
        success: false, 
        message: 'Database configured but connection failed',
        error: error.message 
      };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envVars,
    databaseConfigured: hasDatabase,
    connectionTest,
    instructions: !hasDatabase ? {
      message: 'Database not configured. Please follow these steps:',
      steps: [
        '1. Go to your Vercel Dashboard',
        '2. Select your hotdog-diaries project', 
        '3. Click on the Storage tab',
        '4. Create a new Postgres database',
        '5. Connect it to your project',
        '6. Redeploy your application',
        '7. Visit /api/setup again to initialize tables'
      ],
      alternativeOptions: [
        'Use Supabase: https://supabase.com (free tier)',
        'Use Neon: https://neon.tech (free tier)',
        'Use ElephantSQL: https://elephantsql.com (free tier)'
      ]
    } : null
  });
}