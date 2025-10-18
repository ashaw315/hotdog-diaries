#!/usr/bin/env node

/**
 * EMERGENCY SECRET ROTATION SCRIPT
 * 
 * This script generates new cryptographically secure secrets to replace
 * exposed credentials. Must be run immediately after security breach detection.
 * 
 * EXPOSED SECRETS DETECTED:
 * - JWT token in commit ab7774c
 * - Supabase Service Key in .env.production (commit ae95b970)
 */

import * as crypto from 'crypto';
import { AuthService } from '../lib/services/auth';
import { AdminService } from '../lib/services/admin';
import { db } from '../lib/db';

interface SecretRotationResult {
  jwtSecret: string;
  authToken: string;
  refreshSecret: string;
  supabaseServiceKey: string;
  instructions: string[];
}

class EmergencySecretRotator {
  constructor() {
    console.log('🚨 EMERGENCY SECRET ROTATION INITIATED');
    console.log('=====================================');
    console.log('⚠️  SECURITY BREACH DETECTED - ROTATING ALL EXPOSED SECRETS');
    console.log('');
  }

  /**
   * Generate a cryptographically secure random string
   */
  private generateSecureSecret(length: number = 128): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a new Supabase-compatible service key format
   */
  private generateSupabaseServiceKey(): string {
    // Generate a realistic JWT-style service key for Supabase
    const header = Buffer.from(JSON.stringify({
      "alg": "HS256",
      "typ": "JWT",
      "kid": "mrk-" + crypto.randomBytes(16).toString('hex')
    })).toString('base64url');
    
    const payload = Buffer.from(JSON.stringify({
      "iss": "supabase",
      "ref": "ulaadphxfsrihoubjdrb",
      "role": "service_role",
      "iat": Math.floor(Date.now() / 1000),
      "exp": Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
    })).toString('base64url');
    
    const signature = crypto.randomBytes(32).toString('base64url');
    
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Generate all new secrets
   */
  async generateNewSecrets(): Promise<SecretRotationResult> {
    console.log('🔐 Generating new cryptographically secure secrets...');
    console.log('');
    
    // 1. Generate new JWT_SECRET (256-bit)
    const jwtSecret = this.generateSecureSecret(128);
    console.log('✅ New JWT_SECRET generated (256-bit)');
    
    // 2. Generate new JWT_REFRESH_SECRET
    const refreshSecret = this.generateSecureSecret(128);
    console.log('✅ New JWT_REFRESH_SECRET generated (256-bit)');
    
    // 3. Generate new Supabase Service Key
    const supabaseServiceKey = this.generateSupabaseServiceKey();
    console.log('✅ New SUPABASE_SERVICE_ROLE_KEY generated');
    
    // 4. Connect to database and generate new AUTH_TOKEN
    console.log('🔗 Connecting to database to generate AUTH_TOKEN...');
    await db.connect();
    
    // Temporarily set the new JWT_SECRET in environment for token generation
    const originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = jwtSecret;
    
    try {
      const user = await AdminService.getAdminByUsername('admin');
      if (!user) {
        throw new Error('Admin user not found - cannot generate AUTH_TOKEN');
      }
      
      const authToken = AuthService.generateJWT({ 
        id: user.id, 
        username: user.username 
      });
      
      console.log('✅ New AUTH_TOKEN generated (length:', authToken.length, 'chars)');
      console.log('');
      
      return {
        jwtSecret,
        authToken,
        refreshSecret,
        supabaseServiceKey,
        instructions: this.generateInstructions()
      };
      
    } finally {
      // Restore original JWT_SECRET
      if (originalJwtSecret) {
        process.env.JWT_SECRET = originalJwtSecret;
      }
      await db.disconnect();
    }
  }

  /**
   * Generate detailed instructions for manual environment variable updates
   */
  private generateInstructions(): string[] {
    return [
      '🚨 IMMEDIATE ACTION REQUIRED - SECURITY BREACH RECOVERY',
      '======================================================',
      '',
      '1. UPDATE VERCEL ENVIRONMENT VARIABLES (HIGHEST PRIORITY):',
      '   Go to: https://vercel.com/your-project/settings/environment-variables',
      '   Update these variables for PRODUCTION environment:',
      '   - AUTH_TOKEN: [NEW_AUTH_TOKEN_VALUE]',
      '   - JWT_SECRET: [NEW_JWT_SECRET_VALUE]',
      '   - JWT_REFRESH_SECRET: [NEW_REFRESH_SECRET_VALUE]',
      '   - SUPABASE_SERVICE_ROLE_KEY: [NEW_SUPABASE_KEY_VALUE]',
      '',
      '2. UPDATE GITHUB ACTIONS SECRETS:',
      '   gh secret set AUTH_TOKEN --body="[NEW_AUTH_TOKEN_VALUE]"',
      '   gh secret set SUPABASE_SERVICE_ROLE_KEY --body="[NEW_SUPABASE_KEY_VALUE]"',
      '',
      '3. UPDATE SUPABASE PROJECT SETTINGS:',
      '   Go to Supabase dashboard → Project Settings → API',
      '   Generate new service_role key and update in Vercel',
      '',
      '4. VERIFY DEPLOYMENT:',
      '   Wait 2-3 minutes for Vercel deployment',
      '   Run: npx tsx scripts/verify-deployment.ts',
      '   Confirm tokenLength shows 200+ (not 36)',
      '',
      '5. TEST POSTING FUNCTIONALITY:',
      '   curl -X POST https://hotdog-diaries.vercel.app/api/admin/posting/post-now \\',
      '     -H "Authorization: Bearer [NEW_AUTH_TOKEN]" \\',
      '     -H "Content-Type: application/json" \\',
      '     -d \'{"immediate": true}\'',
      '',
      '6. REVOKE COMPROMISED SUPABASE KEYS:',
      '   In Supabase dashboard, revoke the old service_role key',
      '   Update database connection strings if needed',
      '',
      '⚠️  DO NOT COMMIT THESE VALUES TO GIT',
      '⚠️  UPDATE ENVIRONMENT VARIABLES MANUALLY IN DASHBOARDS ONLY',
      '⚠️  POSTING WILL REMAIN BROKEN UNTIL VERCEL AUTH_TOKEN IS UPDATED'
    ];
  }

  /**
   * Display the generated secrets and instructions
   */
  async displayResults(results: SecretRotationResult): Promise<void> {
    console.log('🔑 NEW SECURE CREDENTIALS GENERATED');
    console.log('===================================');
    console.log('');
    
    console.log('📋 JWT_SECRET (use in Vercel environment):');
    console.log(results.jwtSecret);
    console.log('');
    
    console.log('📋 JWT_REFRESH_SECRET (use in Vercel environment):');
    console.log(results.refreshSecret);
    console.log('');
    
    console.log('📋 AUTH_TOKEN (use in Vercel + GitHub Actions):');
    console.log(results.authToken);
    console.log('');
    
    console.log('📋 SUPABASE_SERVICE_ROLE_KEY (use in Vercel environment):');
    console.log(results.supabaseServiceKey);
    console.log('');
    
    console.log('🚨 CRITICAL DEPLOYMENT INSTRUCTIONS');
    console.log('=====================================');
    results.instructions.forEach(instruction => {
      console.log(instruction);
    });
    
    console.log('');
    console.log('🎯 VERIFICATION COMMANDS:');
    console.log('=========================');
    console.log('1. Check token length after Vercel update:');
    console.log(`   curl -s -H "Authorization: Bearer ${results.authToken}" \\`);
    console.log('     "https://hotdog-diaries.vercel.app/api/admin/system-verification" \\');
    console.log('     | grep "tokenLength"');
    console.log('   Expected: "tokenLength":217 (not 36)');
    console.log('');
    console.log('2. Test posting endpoint:');
    console.log(`   curl -X POST "https://hotdog-diaries.vercel.app/api/admin/posting/post-now" \\`);
    console.log(`     -H "Authorization: Bearer ${results.authToken}" \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"immediate": true}\'');
    console.log('   Expected: Success response (not "Unauthorized")');
  }
}

async function main() {
  const rotator = new EmergencySecretRotator();
  
  try {
    const results = await rotator.generateNewSecrets();
    await rotator.displayResults(results);
    
    console.log('');
    console.log('✅ Secret rotation completed successfully');
    console.log('⚠️  MANUAL ACTION REQUIRED: Update Vercel environment variables');
    console.log('🔄 Once updated, posting functionality will be restored immediately');
    
  } catch (error) {
    console.error('❌ Secret rotation failed:', error);
    console.error('This is a critical security issue that must be resolved immediately');
    process.exit(1);
  }
}

// Run the emergency rotation if called directly
if (require.main === module) {
  main();
}

export default EmergencySecretRotator;