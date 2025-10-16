# Hotdog Diaries

A website that automatically scans social media platforms for hotdog-related content and posts it 6 times daily using intelligent scheduling and platform diversity algorithms.

## 🔗 Quick Links

- **📚 [API Documentation](docs/api.md)** - Complete API reference with curl examples
- **📄 [OpenAPI Specification](docs/openapi.yaml)** - Machine-readable API spec
- **📋 [SRE Runbook](docs/runbook.md)** - Operations and incident response guide
- **🔥 [Live Site](https://hotdog-diaries.vercel.app)** - Production deployment
- **⚙️ [Admin Panel](https://hotdog-diaries.vercel.app/admin)** - Content management interface

## 🏗️ Architecture

- **Frontend:** Next.js 15.4.1 with React 19
- **Database:** Supabase PostgreSQL (production) / SQLite (development)
- **Authentication:** JWT with EdgeAuthUtils
- **Deployment:** Vercel with automatic deployments
- **Monitoring:** GitHub Actions workflows with health checks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- For development: SQLite
- For production: Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hotdog-diaries.git
cd hotdog-diaries

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys and configuration

# Initialize development database
npm run db:init

# Create admin user
npm run admin:create

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## 🔧 Development

### Environment Setup

Create `.env.local` with the following variables:

```bash
# Database
NODE_ENV=development
DATABASE_URL_SQLITE=./hotdog_diaries_dev.db

# Authentication
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=StrongAdminPass123!
ADMIN_EMAIL=admin@hotdogdiaries.com

# API Keys (optional for development)
YOUTUBE_API_KEY=your-youtube-api-key
REDDIT_CLIENT_ID=your-reddit-client-id
IMGUR_CLIENT_ID=your-imgur-client-id
# ... other API keys
```

### Available Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server

# Database Management
npm run db:init                # Initialize SQLite database
npm run db:migrate             # Run database migrations
npm run admin:create           # Create admin user

# Testing
npm test                       # Run Jest tests
npm run test:e2e              # Run Playwright E2E tests
npm run api:validate          # Validate OpenAPI specification

# API Development
npm run api:inventory         # Generate API route inventory
npm run api:check-drift       # Check for API drift

# SRE Operations
npm run runbook:pdf           # Generate PDF runbook
./scripts/smoke.sh            # Run smoke tests
./scripts/backup-supabase.sh  # Create database backup
```

### Database Schema

The application uses the following main tables:

- `content_queue` - Scraped content awaiting review/posting
- `posted_content` - Content that has been published
- `scheduled_posts` - Scheduled content with timing
- `admin_users` - Administrative user accounts

### Content Sources

Supported platforms:
- Reddit (`/r/hotdogs`, `/r/food`)
- YouTube (search API)
- Imgur (gallery search)
- Giphy (GIF search)
- Bluesky (AT Protocol)
- Tumblr (public posts)
- Lemmy (federated instances)
- Pixabay (stock photos)

## 📊 Content Scheduling

The system posts content 6 times daily at standardized Eastern Time slots:

- **08:00 ET** - Morning post
- **12:00 ET** - Lunch post  
- **15:00 ET** - Afternoon post
- **18:00 ET** - Dinner post
- **21:00 ET** - Evening post
- **23:30 ET** - Late night post

### Platform Diversity

The scheduler ensures platform diversity by:
- Preventing consecutive posts from the same platform
- Maintaining balanced distribution across sources
- Optimizing content type variety (text, image, video)

## 🔐 Authentication

### Admin Access

The admin panel requires JWT authentication:

```bash
# Generate a service token
npm run generate:service-token

# Use in API requests
curl -H "Authorization: Bearer $TOKEN" \
     https://hotdog-diaries.vercel.app/api/admin/health/deep
```

### API Authentication

Admin endpoints support dual authentication:
- `Authorization: Bearer <token>` header
- `x-admin-token: <token>` header

## 📋 Operations

### Health Monitoring

```bash
# Quick health check
./scripts/smoke.sh

# Admin endpoint testing  
./scripts/poke-admin.sh

# Comprehensive system health
curl https://hotdog-diaries.vercel.app/api/admin/health/deep \
     -H "Authorization: Bearer $TOKEN"
```

### Database Operations

```bash
# Create backup
./scripts/backup-supabase.sh

# Restore from backup (dry run)
./scripts/restore-supabase.sh --backup-date 2025-10-15

# Restore (execute)
./scripts/restore-supabase.sh --backup-date 2025-10-15 --confirm
```

### Emergency Procedures

For production issues, consult the **[SRE Runbook](docs/runbook.md)** which includes:

- Incident response procedures
- Rollback instructions
- Common failure patterns and resolutions
- Emergency contact information

## 🧪 Testing

### Test Structure

```bash
# Unit tests
npm test

# API integration tests
npm run test -- __tests__/api/

# End-to-end tests
npm run test:e2e

# Smoke tests (production)
AUTH_TOKEN=$TOKEN ./scripts/smoke.sh
```

### Test Coverage

The test suite covers:
- API endpoint functionality
- Database operations
- Authentication flows
- Content scheduling algorithms
- Platform diversity logic

## 📦 Deployment

### Production Deployment

The application auto-deploys to Vercel on pushes to `main`:

1. **Pre-deploy checks:**
   - All tests pass
   - OpenAPI spec validates
   - No API drift detected

2. **Post-deploy verification:**
   - Smoke tests run automatically
   - Health checks validate system status

3. **Rollback if needed:**
   ```bash
   vercel rollback https://hotdog-diaries.vercel.app
   ```

### Environment Variables

Set these in Vercel for production:

```bash
# Core
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=production-secret

# API Keys
YOUTUBE_API_KEY=...
REDDIT_CLIENT_ID=...
# (see docs/secrets.md for complete list)
```

## 🛠️ Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Verify environment
curl https://hotdog-diaries.vercel.app/api/admin/health/deep \
     -H "Authorization: Bearer $TOKEN"
```

**Authentication Failures:**
```bash
# Generate new token
npm run generate:service-token

# Validate token
curl https://hotdog-diaries.vercel.app/api/admin/health/auth-token \
     -H "Authorization: Bearer $NEW_TOKEN"
```

**Content Queue Issues:**
```bash
# Check queue status
curl https://hotdog-diaries.vercel.app/api/system/metrics

# Manual refill
curl -X POST https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/refill \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"date": "2025-10-16", "mode": "force-recreate", "twoDays": true}'
```

For detailed troubleshooting, see the **[SRE Runbook](docs/runbook.md)**.

## 📚 Documentation

### Available Documentation

- **[API Reference](docs/api.md)** - Complete API documentation with examples
- **[OpenAPI Spec](docs/openapi.yaml)** - Machine-readable API specification  
- **[SRE Runbook](docs/runbook.md)** - Operations and incident response
- **[Secrets Management](docs/secrets.md)** - Environment variables and rotation

### Documentation Tools

```bash
# Generate API documentation
npm run api:inventory

# Validate OpenAPI spec
npm run api:validate

# Generate runbook PDF
npm run runbook:pdf

# Check for API drift
npm run api:check-drift
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Check API compatibility: `npm run api:check-drift`
6. Submit a pull request

### Code Quality

The project uses:
- TypeScript for type safety
- Jest for unit testing
- Playwright for E2E testing
- ESLint for code quality
- OpenAPI for API documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

1. **Documentation:** Check the [SRE Runbook](docs/runbook.md) and [API docs](docs/api.md)
2. **Issues:** Create a GitHub issue with detailed reproduction steps
3. **Emergency:** Follow incident response procedures in the runbook

### Monitoring

- **Status:** Weekly smoke tests run automatically
- **Health:** Real-time monitoring via `/api/system/metrics`
- **Alerts:** Failed smoke tests automatically create GitHub issues

---

**🌭 Made with ❤️ for hotdog enthusiasts everywhere!**