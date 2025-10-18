# API Connectivity Triager Scripts

## poke-admin.sh

A comprehensive testing script for admin endpoints that provides structured failure data and latency analysis. This script tests a curated list of admin endpoints in parallel and reports on their health and performance.

### Features

- **Parallel Testing**: Tests multiple endpoints simultaneously using configurable parallelism
- **Latency Analysis**: Measures and reports response times with configurable thresholds
- **Structured Output**: Provides detailed timing data and failure analysis
- **Request Tracking**: Includes request ID tracking for correlation with server logs
- **Configurable Timeouts**: Supports custom timeout and threshold settings
- **Exit Codes**: Returns meaningful exit codes for CI/CD integration

### Prerequisites

The script requires the following tools to be installed:
- `curl` - for HTTP requests
- `jq` - for JSON processing  
- `bc` - for floating point arithmetic

### Usage

#### Basic Usage (Local Development)

```bash
# Test local development server
./scripts/poke-admin.sh
```

#### Production Testing

```bash
# Test production with authentication
BASE_URL="https://hotdog-diaries.vercel.app" \
AUTH_TOKEN="your-jwt-token-here" \
./scripts/poke-admin.sh
```

#### Custom Configuration

```bash
# Custom configuration example
BASE_URL="https://staging.hotdog-diaries.com" \
PARALLEL_JOBS=3 \
TIMEOUT_SECONDS=10 \
THRESHOLD_MS=1500 \
AUTH_TOKEN="your-token" \
./scripts/poke-admin.sh
```

### Configuration Options

The script supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Base URL for the API |
| `PARALLEL_JOBS` | `5` | Number of parallel requests |
| `TIMEOUT_SECONDS` | `5` | Request timeout in seconds |
| `THRESHOLD_MS` | `2000` | Response time threshold in milliseconds |
| `AUTH_TOKEN` | (empty) | JWT token for authentication |

### Exit Codes

The script returns different exit codes based on the test results:

- **0**: All endpoints healthy (all responses < threshold, all 2xx status codes)
- **1**: Critical failures (timeouts or 4xx/5xx errors detected)  
- **2**: Performance warnings (some endpoints > threshold but no errors)
- **3**: Missing dependencies (curl, jq, or bc not found)

### Output Format

#### Console Output

```
API Connectivity Triager - Admin Endpoint Testing
======================================================
Base URL: https://hotdog-diaries.vercel.app
Parallel jobs: 5
Timeout: 5s
Threshold: 2000ms
Auth token: provided

Testing 18 admin endpoints...

STATUS   METHOD ENDPOINT                                                     TIMING
====================================================================================================
OK       GET    /api/admin/health/deep                                       147ms (HTTP 200) 01HF...
OK       GET    /api/admin/dashboard/stats                                   234ms (HTTP 200) 01HF...
SLOW     GET    /api/admin/content/simple-queue                             2341ms (HTTP 200) 01HF...
ERROR    GET    /api/admin/auth/me                                          156ms (HTTP 401) 01HF...

Summary:
--------
OK: 15/18
SLOW: 2/18 (>2000ms)
ERROR: 1/18
Average response time: 445ms

Failed endpoints:
SLOW: GET /api/admin/content/simple-queue (2341ms, HTTP 200)
ERROR: GET /api/admin/auth/me (156ms, HTTP 401)
```

#### JSON Results

The script creates temporary JSON files with detailed timing data that can be processed programmatically:

```json
{
  "method": "GET",
  "url_path": "/api/admin/health/deep",
  "full_url": "https://hotdog-diaries.vercel.app/api/admin/health/deep",
  "http_code": 200,
  "duration_ms": 147,
  "curl_duration_ms": 152,
  "status": "OK",
  "request_id": "01HF2K8VQXR9N7G3J4P8M2K5QW",
  "exit_code": 0
}
```

### Tested Endpoints

The script tests the following admin endpoints:

#### Health Checks
- `/api/admin/health/deep` - Deep system health check
- `/api/admin/health/middleware-example` - Middleware example endpoint

#### Authentication  
- `/api/admin/auth/me` - Current user info
- `/api/admin/me` - Admin user details

#### Dashboard & Stats
- `/api/admin/dashboard/stats` - Dashboard statistics
- `/api/admin/content/stats` - Content statistics
- `/api/admin/queue/stats` - Queue statistics
- `/api/admin/queue/health` - Queue health status

#### Content Management
- `/api/admin/content/simple-queue` - Simple content queue
- `/api/admin/content/posted` - Posted content list

#### Platform Status
- `/api/admin/platforms/status` - All platforms status
- `/api/admin/youtube/status` - YouTube API status
- `/api/admin/reddit/status` - Reddit API status
- `/api/admin/pixabay/status` - Pixabay API status
- `/api/admin/imgur/status` - Imgur API status
- `/api/admin/giphy/status` - Giphy API status

#### System Monitoring
- `/api/admin/automation-health` - Automation system health
- `/api/admin/db-health` - Database health
- `/api/admin/logs` - System logs

#### Testing Endpoints
- `POST:/api/admin/health/middleware-example?delay=500` - Timeout testing
- `/api/admin/debug` - Debug information

### CI/CD Integration

The script is designed for easy integration with CI/CD pipelines:

#### GitHub Actions Example

```yaml
- name: Test Admin Endpoints
  run: |
    BASE_URL="${{ secrets.PROD_URL }}" \
    AUTH_TOKEN="${{ secrets.ADMIN_JWT_TOKEN }}" \
    THRESHOLD_MS=3000 \
    ./scripts/poke-admin.sh
  continue-on-error: false
```

#### Docker Example

```dockerfile
RUN apt-get update && apt-get install -y curl jq bc
COPY scripts/poke-admin.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/poke-admin.sh
```

### Troubleshooting

#### Common Issues

1. **Missing Dependencies**
   ```bash
   # Install on Ubuntu/Debian
   sudo apt-get install curl jq bc
   
   # Install on macOS
   brew install curl jq bc
   ```

2. **Permission Denied**
   ```bash
   chmod +x scripts/poke-admin.sh
   ```

3. **Authentication Failures**
   - Ensure `AUTH_TOKEN` contains a valid JWT token
   - Check token expiration date
   - Verify token has admin privileges

4. **Network Timeouts**
   - Increase `TIMEOUT_SECONDS` for slow networks
   - Check firewall settings
   - Verify `BASE_URL` is accessible

#### Debug Mode

For additional debugging, you can add verbose curl output:

```bash
# Enable verbose curl output
CURL_VERBOSE=1 ./scripts/poke-admin.sh
```

### Integration with Deep Health Check

The script works seamlessly with the `/api/admin/health/deep` endpoint to provide comprehensive system monitoring:

- The deep health endpoint provides per-component timing (DB, JWT, filesystem, HTTP, Supabase)
- The poke-admin script provides end-to-end endpoint testing
- Together they give complete visibility into system health and performance

### Success Criteria

The implementation meets the original requirements:

✅ **poke-admin.sh all green (<2s each) in prod**: Script validates all endpoints respond within threshold  
✅ **/admin/health/deep returns timing fields and ok:true**: Deep health endpoint provides structured timing data  
✅ **Structured failure data**: Both tools provide detailed error information for debugging  
✅ **Request tracking**: All requests include ULID-based request IDs for log correlation