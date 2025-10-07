# API Error Handling Documentation

## Overview

This document describes the standardized error handling approach implemented across all API route handlers in the Hotdog Diaries application. The error handling system ensures consistent, secure, and informative error responses while preventing application crashes due to undefined references or unhandled exceptions.

## Error Handling Architecture

### Core Components

1. **Shared Error Handler** (`/lib/utils/errorHandler.ts`)
   - Centralized error processing and formatting
   - Edge-compatible implementation for Vercel deployment
   - Consistent error response structure

2. **API Middleware** (`/lib/api-middleware.ts`)
   - Request validation utilities
   - Error creation and handling helpers
   - Common response formatting functions

3. **Legacy Error Handler** (`/lib/middleware/error-handler.ts`)
   - Complex middleware-based error handling
   - Used by some routes for advanced error processing

### Error Response Structure

All API endpoints return errors in a consistent JSON format:

```json
{
  "error": "Human-readable error message",
  "status": 500,
  "timestamp": "2025-01-XX:XX:XX.XXXZ",
  "details": {
    "name": "ErrorType",
    "stack": "Error stack trace (development only)"
  },
  "context": {
    "operation": "specific_operation_name",
    "additionalInfo": "..."
  }
}
```

### Standard HTTP Status Codes

| Status Code | Usage | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request data, missing required fields |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Valid auth but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource conflict (e.g., duplicate creation) |
| 429 | Too Many Requests | Rate limiting exceeded |
| 500 | Internal Server Error | Unexpected server errors |
| 503 | Service Unavailable | External service dependency failure |

## Implementation Patterns

### Pattern 1: Simple Error Handler (Recommended)

Used in most routes for straightforward error handling:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { errorHandler } from '@/lib/utils/errorHandler'

export async function GET(request: NextRequest) {
  try {
    // Your route logic here
    const data = await someOperation()
    
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return errorHandler(error, 500, { operation: 'get_data' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validation
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field: requiredField' },
        { status: 400 }
      )
    }
    
    // Your route logic here
    const result = await someOperation(body)
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return errorHandler(error, 500, { operation: 'create_data' })
  }
}
```

### Pattern 2: API Middleware (Advanced)

Used in authentication and complex validation scenarios:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'

async function myRouteHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Your route logic here
    const data = await someOperation()
    
    return createSuccessResponse(data, 'Operation completed successfully')
  } catch (error) {
    throw createApiError('Operation failed', 500, 'OPERATION_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    validateRequestMethod(request, ['GET'])
    return await myRouteHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/endpoint')
  }
}
```

### Pattern 3: Middleware-Wrapped (Legacy)

Used in some existing routes with complex error handling requirements:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  // Your route logic here
  const data = await someOperation()
  
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  })
})
```

## Route-Specific Error Handling

### Authentication Routes

Authentication routes should handle:
- Invalid credentials (401)
- Missing authentication tokens (401)
- Expired tokens (401)
- Account disabled/locked (403)

Example:
```typescript
// /app/api/admin/auth/login/route.ts
if (!user || !validPassword) {
  return NextResponse.json(
    { error: 'Invalid credentials' },
    { status: 401 }
  )
}

if (!user.is_active) {
  return NextResponse.json(
    { error: 'Account is disabled' },
    { status: 403 }
  )
}
```

### Database Operations

Database routes should handle:
- Connection failures (503)
- Query errors (500)
- Data validation errors (400)
- Resource not found (404)

Example:
```typescript
// Check database health first
const healthCheck = await db.healthCheck()
if (!healthCheck.connected) {
  return NextResponse.json({
    error: 'Database connection failed',
    details: healthCheck.error
  }, { status: 503 })
}
```

### External API Integrations

Routes that call external APIs should handle:
- Service unavailable (503)
- Rate limiting (429)
- API key errors (401)
- Timeout errors (504)

Example:
```typescript
try {
  const response = await externalApiCall()
  return response
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    return NextResponse.json(
      { error: 'External service rate limit exceeded' },
      { status: 429 }
    )
  }
  return errorHandler(error, 503, { service: 'external_api' })
}
```

## Validation and Testing

### Automated Testing

The error handling system is validated through:

1. **Static Analysis**: Checks for undefined `errorHandler` references
2. **Unit Tests**: Tests individual error scenarios
3. **Integration Tests**: Tests complete error flows
4. **CI Validation**: Automated checks in GitHub Actions

### Test File: `__tests__/api/errorHandling.test.ts`

This comprehensive test suite:
- Dynamically imports all 195+ route files
- Simulates errors in each route handler
- Validates error response structure
- Checks for proper HTTP status codes
- Verifies no undefined references exist

### Running Error Handling Tests

```bash
# Run all error handling tests
npm test -- __tests__/api/errorHandling.test.ts

# Run with verbose output
npm test -- __tests__/api/errorHandling.test.ts --verbose

# Run in CI environment
npm test -- __tests__/api/errorHandling.test.ts --verbose --silent=false
```

## Common Issues and Solutions

### Issue 1: Undefined errorHandler References

**Problem**: Routes using `errorHandler` without proper import
```typescript
// ❌ WRONG - undefined reference
export async function GET() {
  try {
    // ...
  } catch (error) {
    return errorHandler(error, 500) // ReferenceError: errorHandler is not defined
  }
}
```

**Solution**: Add proper import
```typescript
// ✅ CORRECT
import { errorHandler } from '@/lib/utils/errorHandler'

export async function GET() {
  try {
    // ...
  } catch (error) {
    return errorHandler(error, 500)
  }
}
```

### Issue 2: Inconsistent Error Responses

**Problem**: Different routes returning different error formats
```typescript
// ❌ WRONG - inconsistent format
return new Response('Error message', { status: 500 })
```

**Solution**: Use standardized error handling
```typescript
// ✅ CORRECT
return errorHandler(error, 500, { operation: 'specific_operation' })
```

### Issue 3: Missing Try-Catch Blocks

**Problem**: Route handlers without error handling
```typescript
// ❌ WRONG - no error handling
export async function POST(request: NextRequest) {
  const data = await riskyOperation() // Could throw
  return NextResponse.json(data)
}
```

**Solution**: Wrap in try-catch
```typescript
// ✅ CORRECT
export async function POST(request: NextRequest) {
  try {
    const data = await riskyOperation()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorHandler(error, 500, { operation: 'risky_operation' })
  }
}
```

### Issue 4: Exposing Sensitive Information

**Problem**: Leaking internal details in production
```typescript
// ❌ WRONG - exposes internal details
return NextResponse.json({
  error: error.stack, // Contains file paths, etc.
  database: 'postgresql://user:pass@host/db'
}, { status: 500 })
```

**Solution**: Use environment-aware error handling
```typescript
// ✅ CORRECT - errorHandler handles this automatically
return errorHandler(error, 500, { operation: 'database_query' })
```

## Monitoring and Debugging

### Error Logging

All errors are logged with structured information:
```typescript
console.error(`[API ERROR] ${message}`, {
  status,
  error: {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  },
  context,
  timestamp: new Date().toISOString()
})
```

### Development vs Production

- **Development**: Full error details, stack traces, internal context
- **Production**: Sanitized messages, no sensitive information, generic internal errors

### Error Tracking

Consider integrating error tracking services:
- Sentry for error monitoring
- LogRocket for session replay
- DataDog for application monitoring

## Maintenance Guidelines

### Adding New Routes

When creating new API routes:

1. **Always** include try-catch blocks
2. **Import** appropriate error handling utilities
3. **Validate** input parameters
4. **Use** consistent status codes
5. **Test** error scenarios

### Updating Existing Routes

When modifying routes:

1. **Preserve** existing error handling patterns
2. **Test** that changes don't break error flows
3. **Update** tests if error behavior changes
4. **Document** any new error conditions

### Code Review Checklist

- [ ] Route has proper error handling imports
- [ ] All async operations are wrapped in try-catch
- [ ] Error responses use consistent format
- [ ] Appropriate HTTP status codes are used
- [ ] No sensitive information is exposed
- [ ] Error context is provided for debugging

## Reference

### Error Handler Functions

#### `errorHandler(error, status?, context?)`
- **Purpose**: Main error handling function
- **Parameters**:
  - `error`: The error object or message
  - `status`: HTTP status code (default: 500)
  - `context`: Additional debugging context
- **Returns**: NextResponse with standardized error format

#### `createApiError(message, status, code)`
- **Purpose**: Create typed API errors
- **Parameters**:
  - `message`: Error message
  - `status`: HTTP status code
  - `code`: Error code for categorization
- **Returns**: Structured error object

#### `handleApiError(error, request, endpoint)`
- **Purpose**: Handle API errors with request context
- **Parameters**:
  - `error`: The error to handle
  - `request`: NextRequest object
  - `endpoint`: API endpoint path
- **Returns**: NextResponse with error details

### Related Files

- `/lib/utils/errorHandler.ts` - Main error handler
- `/lib/api-middleware.ts` - API middleware utilities
- `/lib/middleware/error-handler.ts` - Legacy error middleware
- `__tests__/api/errorHandling.test.ts` - Error handling tests
- `/scripts/audit-api-routes.ts` - Route auditing tool

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Maintained By**: Development Team