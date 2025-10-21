#!/usr/bin/env tsx

/**
 * Runtime JWT Mint/Validate Utility for CI Gates
 * 
 * Replaces static AUTH_TOKEN with runtime-minted JWTs from JWT_SECRET.
 * Supports CLI interface and programmatic usage.
 */

import * as crypto from 'crypto'

export interface JWTPayload {
  sub: string
  aud: string
  iss: string
  iat: number
  exp: number
  jti?: string
}

export interface JWTHeader {
  alg: 'HS256'
  typ: 'JWT'
  kid?: string
}

export interface MintOptions {
  sub?: string
  aud?: string
  iss?: string
  ttl?: string
  jti?: string
}

export interface DecodedJWT {
  header: JWTHeader
  payload: JWTPayload
  signature: string
}

/**
 * Parse TTL string to seconds
 * Supports: "15m", "1h", "30s", "1d", or raw seconds
 */
function parseTTL(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd]?)$/)
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}. Use format like "15m", "1h", "30s", "1d"`)
  }
  
  const value = parseInt(match[1], 10)
  const unit = match[2] || 's'
  
  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  }
  
  return value * multipliers[unit as keyof typeof multipliers]
}

/**
 * Validate JWT_SECRET strength
 */
function validateJWTSecret(secret: string): void {
  if (!secret) {
    throw new Error('JWT_SECRET is required but not provided')
  }
  
  // Must be at least 64 hex chars (32 bytes)
  if (secret.length < 64) {
    throw new Error(`JWT_SECRET too weak: ${secret.length} chars < 64 required (32 bytes minimum)`)
  }
  
  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(secret)) {
    throw new Error('JWT_SECRET must be hexadecimal format')
  }
}

/**
 * Base64URL encode (JWT standard)
 */
function base64urlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Base64URL decode (JWT standard)
 */
function base64urlDecode(data: string): string {
  // Add padding if needed
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Mint a new JWT token
 */
export function mintToken(options: MintOptions = {}): string {
  const {
    sub = 'ci',
    aud = 'ci', 
    iss = 'hotdog-diaries',
    ttl = '15m',
    jti
  } = options
  
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  
  validateJWTSecret(jwtSecret)
  
  const now = Math.floor(Date.now() / 1000)
  const exp = now + parseTTL(ttl)
  
  // Create header
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  // Add kid if JWT_KEY_VERSION is set
  if (process.env.JWT_KEY_VERSION) {
    header.kid = process.env.JWT_KEY_VERSION
  }
  
  // Create payload
  const payload: JWTPayload = {
    sub,
    aud,
    iss,
    iat: now,
    exp,
    ...(jti && { jti })
  }
  
  // Encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header))
  const encodedPayload = base64urlEncode(JSON.stringify(payload))
  
  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = crypto
    .createHmac('sha256', Buffer.from(jwtSecret, 'hex'))
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  return `${signingInput}.${signature}`
}

/**
 * Decode JWT without verification (for debugging)
 */
export function decodeUnsafe(token: string): DecodedJWT {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: must have 3 parts separated by dots')
  }
  
  try {
    const header = JSON.parse(base64urlDecode(parts[0])) as JWTHeader
    const payload = JSON.parse(base64urlDecode(parts[1])) as JWTPayload
    const signature = parts[2]
    
    return { header, payload, signature }
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Verify JWT signature and expiration
 */
export function verifyToken(token: string): JWTPayload {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  
  const decoded = decodeUnsafe(token)
  
  // Verify signature
  const parts = token.split('.')
  const signingInput = `${parts[0]}.${parts[1]}`
  const expectedSignature = crypto
    .createHmac('sha256', Buffer.from(jwtSecret, 'hex'))
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  if (decoded.signature !== expectedSignature) {
    throw new Error('Invalid JWT signature')
  }
  
  // Verify expiration
  const now = Math.floor(Date.now() / 1000)
  if (decoded.payload.exp < now) {
    throw new Error('JWT token has expired')
  }
  
  return decoded.payload
}

/**
 * CLI interface for minting and decoding tokens
 */
async function cli() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    // Documentation examples only - not real secrets (configured in .gitguardian.yml)
    console.log(`
Usage:
  pnpm tsx scripts/ci/lib/jwt.ts mint [options]    Mint a new JWT token
  pnpm tsx scripts/ci/lib/jwt.ts decode --token    Decode JWT token (unsafe)
  pnpm tsx scripts/ci/lib/jwt.ts verify --token    Verify JWT token
  
Mint options:
  --ttl <duration>     Token TTL (default: 15m, formats: 15m, 1h, 30s, 1d)
  --sub <subject>      Token subject (default: ci)
  --aud <audience>     Token audience (default: ci)  
  --iss <issuer>       Token issuer (default: hotdog-diaries)
  --jti <id>           Unique token ID
  
Decode/Verify options:
  --token <jwt>        JWT token to decode/verify
  
Environment:
  JWT_SECRET           Required: hex-encoded secret (≥64 chars)
  JWT_KEY_VERSION      Optional: key version for rotation
`)
    process.exit(1)
  }
  
  const command = args[0]
  
  try {
    if (command === 'mint') {
      const options: MintOptions = {}
      
      for (let i = 1; i < args.length; i += 2) {
        const flag = args[i]
        const value = args[i + 1]
        
        switch (flag) {
          case '--ttl':
            options.ttl = value
            break
          case '--sub':
            options.sub = value
            break
          case '--aud':
            options.aud = value
            break
          case '--iss':
            options.iss = value
            break
          case '--jti':
            options.jti = value
            break
          default:
            throw new Error(`Unknown flag: ${flag}`)
        }
      }
      
      const token = mintToken(options)
      console.log(token)
      
    } else if (command === 'decode') {
      const tokenIndex = args.indexOf('--token')
      if (tokenIndex === -1 || !args[tokenIndex + 1]) {
        throw new Error('--token flag is required for decode command')
      }
      
      const token = args[tokenIndex + 1]
      const decoded = decodeUnsafe(token)
      
      console.log(JSON.stringify({
        header: decoded.header,
        payload: {
          ...decoded.payload,
          iat_iso: new Date(decoded.payload.iat * 1000).toISOString(),
          exp_iso: new Date(decoded.payload.exp * 1000).toISOString(),
          ttl_seconds: decoded.payload.exp - decoded.payload.iat,
          expires_in_seconds: decoded.payload.exp - Math.floor(Date.now() / 1000)
        },
        signature_preview: decoded.signature.substring(0, 16) + '...'
      }, null, 2))
      
    } else if (command === 'verify') {
      const tokenIndex = args.indexOf('--token')
      if (tokenIndex === -1 || !args[tokenIndex + 1]) {
        throw new Error('--token flag is required for verify command')
      }
      
      const token = args[tokenIndex + 1]
      const payload = verifyToken(token)
      
      console.log(JSON.stringify({
        valid: true,
        payload: {
          ...payload,
          iat_iso: new Date(payload.iat * 1000).toISOString(),
          exp_iso: new Date(payload.exp * 1000).toISOString(),
          expires_in_seconds: payload.exp - Math.floor(Date.now() / 1000)
        }
      }, null, 2))
      
    } else {
      throw new Error(`Unknown command: ${command}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli()
}