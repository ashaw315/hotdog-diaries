# Secrets & Rotation Audit

## Overview

This document catalogs all secrets used in the Hotdog Diaries application, their purposes, rotation requirements, and management procedures.

## Secret Inventory

### Authentication & Authorization

| Name | Purpose | Scope | Rotation Interval | Storage Location | Owner | Last Rotated |
|------|---------|-------|------------------|------------------|-------|--------------|
| `JWT_SECRET` | JWT token signing/verification | dev/ci/prod | 90 days | Vercel Env Vars, GitHub Secrets | Security Team | 2025-01-15 |
| `AUTH_TOKEN` | Admin API authentication | ci/prod | 30 days | GitHub Secrets | DevOps Team | 2025-01-10 |
| `CRON_TOKEN` | Scheduled job authentication | prod | 30 days | Vercel Env Vars | DevOps Team | 2025-01-10 |
| `ADMIN_PASSWORD` | Default admin user password | dev/prod | 60 days | Vercel Env Vars | Security Team | 2025-01-01 |

### Database & Infrastructure

| Name | Purpose | Scope | Rotation Interval | Storage Location | Owner | Last Rotated |
|------|---------|-------|------------------|------------------|-------|--------------|
| `DATABASE_URL` | Primary database connection | prod | Manual | Vercel Env Vars | Infrastructure Team | 2024-12-15 |
| `POSTGRES_URL` | Supabase Postgres connection | prod | Manual | Vercel Env Vars | Infrastructure Team | 2024-12-15 |
| `POSTGRES_URL_NON_POOLING` | Direct Postgres connection | prod | Manual | Vercel Env Vars | Infrastructure Team | 2024-12-15 |
| `SUPABASE_URL` | Supabase project URL | prod | Manual | Vercel Env Vars | Infrastructure Team | N/A |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access | prod | 90 days | Vercel Env Vars | Infrastructure Team | 2024-12-20 |
| `SUPABASE_SERVICE_KEY` | Supabase service access (legacy) | prod | 90 days | Vercel Env Vars | Infrastructure Team | 2024-12-20 |

### External API Keys

| Name | Purpose | Scope | Rotation Interval | Storage Location | Owner | Last Rotated |
|------|---------|-------|------------------|------------------|-------|--------------|
| `YOUTUBE_API_KEY` | YouTube content scanning | dev/prod | 180 days | Vercel Env Vars | Content Team | 2024-11-01 |
| `REDDIT_CLIENT_ID` | Reddit API access | dev/prod | 365 days | Vercel Env Vars | Content Team | 2024-09-01 |
| `REDDIT_CLIENT_SECRET` | Reddit API secret | dev/prod | 365 days | Vercel Env Vars | Content Team | 2024-09-01 |
| `REDDIT_USERNAME` | Reddit account username | dev/prod | Manual | Vercel Env Vars | Content Team | N/A |
| `REDDIT_PASSWORD` | Reddit account password | dev/prod | 90 days | Vercel Env Vars | Content Team | 2024-12-01 |
| `GIPHY_API_KEY` | Giphy content scanning | dev/prod | 365 days | Vercel Env Vars | Content Team | 2024-08-01 |
| `PIXABAY_API_KEY` | Pixabay image scanning | dev/prod | 365 days | Vercel Env Vars | Content Team | 2024-07-01 |
| `IMGUR_CLIENT_ID` | Imgur image scanning | dev/prod | 365 days | Vercel Env Vars | Content Team | 2024-06-01 |
| `BLUESKY_IDENTIFIER` | Bluesky account identifier | dev/prod | Manual | Vercel Env Vars | Content Team | N/A |
| `BLUESKY_APP_PASSWORD` | Bluesky app-specific password | dev/prod | 90 days | Vercel Env Vars | Content Team | 2024-12-01 |

### Development & CI/CD

| Name | Purpose | Scope | Rotation Interval | Storage Location | Owner | Last Rotated |
|------|---------|-------|------------------|------------------|-------|--------------|
| `GITHUB_TOKEN` | GitHub API access for automation | ci | 365 days | GitHub Secrets | DevOps Team | 2024-10-01 |
| `VERCEL_TOKEN` | Vercel deployment automation | ci | 365 days | GitHub Secrets | DevOps Team | 2024-10-01 |
| `DATABASE_USER` | Local dev database user | dev | Manual | .env.local | Developers | N/A |
| `DATABASE_PASSWORD` | Local dev database password | dev | Manual | .env.local | Developers | N/A |

## Rotation Procedures

### Automated Rotation

Secrets with rotation intervals ≤ 90 days should use automated rotation:

```bash
# Generate new tokens
npm run rotate-tokens

# For CI environments
npm run rotate-tokens -- --create-pr
```

### Manual Rotation Checklist

For secrets requiring manual rotation:

1. **Pre-Rotation**
   - [ ] Identify all services using the secret
   - [ ] Schedule maintenance window if needed
   - [ ] Prepare rollback plan

2. **Rotation**
   - [ ] Generate new secret value
   - [ ] Update primary storage location
   - [ ] Update backup storage locations
   - [ ] Test with new secret

3. **Post-Rotation**
   - [ ] Verify all services functioning
   - [ ] Update documentation
   - [ ] Log rotation in audit trail
   - [ ] Schedule next rotation

### Emergency Rotation

In case of suspected compromise:

1. **Immediate**
   - [ ] Rotate affected secret immediately
   - [ ] Revoke old secret if possible
   - [ ] Monitor for unauthorized access

2. **Investigation**
   - [ ] Review access logs
   - [ ] Identify scope of compromise
   - [ ] Document incident

3. **Recovery**
   - [ ] Update all affected systems
   - [ ] Review security procedures
   - [ ] Implement additional safeguards

## Security Requirements

### Token Strength Requirements

All secrets must meet minimum security standards:

- **Length**: Minimum 32 characters for generated tokens
- **Entropy**: Must use cryptographically secure random generation
- **Format**: Hex encoding for internal tokens, follow provider requirements for external APIs
- **Patterns**: Must not contain common patterns (sequential chars, repeated patterns)

### Storage Security

- **Environment Variables**: Use platform-specific secure storage (Vercel Env Vars, GitHub Secrets)
- **Local Development**: Use `.env.local` files, never commit to git
- **Documentation**: Reference secrets by name only, never include actual values
- **Access Control**: Limit access to secrets on need-to-know basis

### Audit Trail

All secret rotations must be logged with:

- Secret name
- Rotation timestamp
- Rotation method (manual/automated)
- Rotated by (user/system)
- Verification status

## Monitoring & Alerting

### Health Probes

The application includes health probes to verify secret validity:

- `/api/admin/health/auth-token` - Validates AUTH_TOKEN against production
- `/api/admin/health/deep` - Validates database connections and JWT secrets

### CI/CD Gates

Deployment pipeline includes secret validation:

- Token strength validation
- Environment variable completeness check
- Production secret verification probe

### Alerts

Set up monitoring for:

- Failed authentication attempts with admin tokens
- Secret rotation failures
- Weak secret detection in CI
- Health probe failures

## Team Responsibilities

### Security Team
- JWT_SECRET rotation and management
- ADMIN_PASSWORD rotation
- Security audit and compliance
- Incident response for compromised secrets

### DevOps Team  
- AUTH_TOKEN and CRON_TOKEN rotation
- CI/CD pipeline secret management
- Deployment gate maintenance
- Infrastructure secret management

### Infrastructure Team
- Database connection string management
- Supabase secret rotation
- Platform infrastructure secrets

### Content Team
- External API key management
- Social media account credentials
- API quota and rate limit monitoring

## Compliance & Audit

### Rotation Tracking

Maintain audit log in `docs/rotation-log.md` with:

```markdown
## 2025-01-15 - JWT_SECRET Rotation
- **Rotated by**: Security Team (automated)
- **Method**: scripts/rotate-token.ts
- **Verification**: ✅ All services functioning
- **Next rotation**: 2025-04-15

## 2025-01-10 - AUTH_TOKEN Rotation  
- **Rotated by**: DevOps Team (manual)
- **Method**: GitHub Secrets UI
- **Verification**: ✅ Deploy gate passing
- **Next rotation**: 2025-02-10
```

### Security Reviews

Quarterly security reviews should assess:

- Secret inventory completeness
- Rotation compliance
- Access control effectiveness
- Incident response readiness

### Penetration Testing

Include secret management in security assessments:

- Weak secret detection
- Secret exposure in logs/repos
- Authentication bypass attempts
- Privilege escalation via tokens

## Migration Path

For existing secrets not meeting current standards:

1. **Assessment** (Week 1)
   - Audit current secret strength
   - Identify non-compliant secrets
   - Plan rotation sequence

2. **Implementation** (Weeks 2-4)
   - Rotate weak secrets to strong alternatives
   - Implement automated rotation for eligible secrets
   - Update documentation and procedures

3. **Validation** (Week 5)
   - Verify all secrets meet standards
   - Test rotation procedures
   - Conduct security review

## Tools & Scripts

- `scripts/rotate-token.ts` - Automated token rotation
- `scripts/validate-secrets.ts` - Secret strength validation
- `.github/workflows/secret-audit.yml` - CI secret validation
- `/api/admin/health/auth-token` - Production token health probe

## References

- [NIST Special Publication 800-57](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) - Key Management Guidelines
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Vercel Environment Variables Documentation](https://vercel.com/docs/projects/environment-variables)
- [GitHub Encrypted Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)